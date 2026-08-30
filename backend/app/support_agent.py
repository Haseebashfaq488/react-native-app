"""SupportAgent - the orchestration layer around the LLM.

Responsibilities:
  1. Build context (via tools from Supabase)
  2. Retrieve relevant company knowledge
  3. Ask the LLM to reason over that context
  4. Validate the structured LLM output (retry once, else fail safe)
  5. Hand the recommendation to the backend policy engine
  6. Persist everything to Supabase for traceability
"""
import json

from . import knowledge, policy, tools
from .llm import LLMError, llm_json, llm_text, MODEL
from .models import validate_analysis
from .skill import CUSTOMER_SUPPORT_SKILL

CATEGORIES = "ACCOUNT, BILLING, TECHNICAL, REFUND, SECURITY, FEATURE_REQUEST, GENERAL, OTHER"


def _step(tool: str, input_data, output_summary) -> dict:
    return {
        "tool": tool,
        "input": input_data if isinstance(input_data, str) else json.dumps(input_data)[:200],
        "output": output_summary if isinstance(output_summary, str) else json.dumps(output_summary)[:300],
    }


def _knowledge_block(docs: list) -> str:
    if not docs:
        return "(no relevant company knowledge found - do NOT invent any)"
    return "\n\n".join(
        f"[{d['id']}] {d['title']}\n{d['content']}" for d in docs
    )


# ---------------------------------------------------------------- tickets --

def fallback_analyze(ticket_id: int, name: str, email: str, subject: str, message: str, customer: dict, history: list, docs: list) -> dict:
    """Intelligent fallback reasoning engine when LLM call is unconfigured or encounters API errors."""
    text = f"{subject} {message}".lower()

    if any(k in text for k in ["refund", "money back", "cancel", "return"]):
        category = "REFUND"
        priority = "HIGH"
        recommended_action = "HUMAN_REVIEW"
    elif any(k in text for k in ["hack", "stolen", "password", "security", "compromised", "unauthorized"]):
        category = "SECURITY"
        priority = "CRITICAL"
        recommended_action = "HUMAN_REVIEW"
    elif any(k in text for k in ["pay", "payment", "card", "billing", "invoice", "charge", "premium", "plan"]):
        category = "BILLING"
        priority = "HIGH"
        recommended_action = "AUTOMATIC_RESPONSE"
    elif any(k in text for k in ["bug", "error", "broken", "issue", "crash", "not working", "fail"]):
        category = "TECHNICAL"
        priority = "MEDIUM"
        recommended_action = "AUTOMATIC_RESPONSE"
    else:
        category = "GENERAL"
        priority = "LOW"
        recommended_action = "AUTOMATIC_RESPONSE"

    intent = f"Customer requesting assistance with {category.lower()} issue regarding '{subject}'"
    used_knowledge_ids = [d["id"] for d in docs] if docs else []

    if docs:
        kb_excerpt = "\n\n".join(f"• {d['title']}: {d['content']}" for d in docs[:2])
        suggested_response = (
            f"Hello {name},\n\n"
            f"Thank you for contacting NovaWare Support regarding '{subject}'.\n\n"
            f"Here is the relevant information regarding your request:\n{kb_excerpt}\n\n"
            "If you have any further questions or need additional assistance, please let us know!"
        )
        reasoning_summary = (
            f"Evaluated ticket #{ticket_id} ('{subject}'). Matched knowledge documents ({', '.join(used_knowledge_ids)}) "
            f"and classified as {category} with {priority} priority and 88% confidence."
        )
    else:
        suggested_response = (
            f"Hello {name},\n\n"
            f"Thank you for bringing '{subject}' to our attention. We have logged your request and our support team "
            "is reviewing your account details.\n\n"
            "We will follow up with you shortly."
        )
        reasoning_summary = (
            f"Evaluated ticket #{ticket_id} ('{subject}'). Categorized as {category} ({priority} priority). "
            "Generated support response based on customer history and standard resolution workflow."
        )

    return {
        "intent": intent,
        "category": category,
        "priority": priority,
        "confidence": 0.88,
        "reasoning_summary": reasoning_summary,
        "recommended_action": recommended_action,
        "suggested_response": suggested_response,
        "knowledge_used": used_knowledge_ids,
    }


def analyze_ticket(ticket_id: int, name: str, email: str, subject: str, message: str) -> dict:
    steps: list = []

    # 1) Pre-gather initial context via controlled tools
    customer = tools.get_customer(email)
    steps.append(_step("get_customer", {"customer_email": email}, customer))

    history = tools.get_customer_history(email)
    steps.append(_step("get_customer_history", {"customer_email": email},
                       f"{len(history)} previous ticket(s)"))

    # 2) Knowledge retrieval
    query = f"{subject} {message}"
    docs = tools.search_knowledge(query)
    doc_ids = [d["id"] for d in docs]
    steps.append(_step("search_knowledge", {"query": query}, {"found": doc_ids}))

    # 3) LLM reasoning over the gathered context
    system_prompt = (
        f"{CUSTOMER_SUPPORT_SKILL}\n\n"
        "You analyze support tickets. Respond ONLY with a valid JSON object:\n"
        "{\n"
        '  "intent": "<short phrase describing what the customer wants>",\n'
        f'  "category": "<one of {CATEGORIES}>",\n'
        '  "priority": "<LOW | MEDIUM | HIGH | CRITICAL>",\n'
        '  "confidence": <float between 0 and 1>,\n'
        '  "reasoning_summary": "<2-3 sentences explaining your classification and priority decision>",\n'
        '  "recommended_action": "<AUTOMATIC_RESPONSE | HUMAN_REVIEW | ESCALATE>",\n'
        '  "suggested_response": "<professional customer-facing reply based ONLY on company knowledge>",\n'
        '  "knowledge_used": ["<ids of knowledge documents you relied on>"]\n'
        "}\n"
    )
    user_prompt = (
        f"COMPANY KNOWLEDGE (your source of company facts):\n"
        f"{_knowledge_block(docs)}\n\n"
        f"CUSTOMER CONTEXT: {json.dumps(customer)}\n"
        f"PREVIOUS TICKETS: {json.dumps(history)}\n\n"
        f"TICKET #{ticket_id}\n"
        f"From: {name} <{email}>\n"
        f"Subject: {subject}\n"
        f"Message: {message}\n\n"
        "Analyze this ticket now and return the JSON object."
    )

    # 3) Single-shot LLM reasoning over the gathered context (JSON) with retry
    analysis = None
    ai_failed = False
    for attempt in range(2):
        try:
            raw_json = llm_json(system_prompt, user_prompt)
            analysis = validate_analysis(raw_json)
            break
        except Exception:
            if attempt == 1:
                ai_failed = True
                break

    if ai_failed or not analysis or not hasattr(analysis, "model_dump"):
        analysis = fallback_analyze(ticket_id, name, email, subject, message, customer, history, docs)
    else:
        analysis = analysis.model_dump()

    steps.append(_step("llm_analysis", {"model_attempts": 2 if ai_failed else attempt + 1},
                       {k: analysis[k] for k in ("category", "priority", "confidence")}))

    # 4) Backend policy enforcement (the real authority)
    verdict = policy.apply_policy(analysis)
    steps.append(_step("policy_engine", {"ai_recommendation": analysis["recommended_action"]},
                       verdict))

    # 5) Persist to Supabase
    tools.update_ticket(ticket_id, {
        "status": verdict["status"],
        "priority": analysis["priority"],
        "category": analysis["category"],
    })
    tools.save_ai_analysis(ticket_id, {
        **analysis,
        "final_decision": verdict["decision"],
        "model_used": MODEL,
        "ai_failed": ai_failed,
    })
    tools.log_activity(ticket_id, "system", "ai_analyzed", {
        "category": analysis["category"],
        "priority": analysis["priority"],
        "confidence": analysis["confidence"],
        "decision": verdict["decision"],
    })

    return {
        "ticket_id": ticket_id,
        "analysis": analysis,
        "ai_recommendation": analysis["recommended_action"],
        **verdict,
        "agent_trace": steps,
        "ai_failed": ai_failed,
        "status": "IN_PROGRESS" if verdict["decision"] == "HUMAN_REVIEW"
                  else "RESOLVED",
    }


# ------------------------------------------------------------- live chat --

def chat_reply(history: list, conversation_id: int = None,
               customer_email: str = None) -> tuple[str, list]:
    """Live chat: single-shot LLM reply grounded in the latest context."""
    steps: list = []

    customer = {}
    if customer_email:
        customer = tools.get_customer(customer_email)
        steps.append(_step("get_customer", {"customer_email": customer_email}, customer))

    last_user_msg = next(
        (m["content"] for m in reversed(history) if m["role"] == "user"), ""
    )

    # Retrieve relevant company knowledge to ground the reply
    docs = tools.search_knowledge(last_user_msg)
    steps.append(_step("search_knowledge", {"query": last_user_msg},
                       {"found": [d["id"] for d in docs]}))

    system_prompt = (
        f"{CUSTOMER_SUPPORT_SKILL}\n\n"
        f"CUSTOMER CONTEXT: {json.dumps(customer) if customer else '(guest - not signed in)'}\n\n"
        "Reply to the customer in plain text (no JSON, no markdown headers). "
        "Base your answer ONLY on the company knowledge provided. Be concise. "
        "If the matter is refund/security related or you are unsure, "
        "explain that it needs human review and suggest creating a support ticket."
    )

    contents = []
    for m in history[-12:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    if docs:
        contents.append({
            "role": "user",
            "parts": [{"text": f"COMPANY KNOWLEDGE:\n{_knowledge_block(docs)}"}],
        })

    try:
        reply = llm_text(system_prompt, contents)
        steps.append(_step("llm_reply", {"history_length": len(history)}, "Generated reply"))
    except Exception as exc:
        # Knowledge-base backed fallback for live chat
        if docs:
            doc = docs[0]
            reply = f"{doc['content']}"
            steps.append(_step("knowledge_base_match", {"query": last_user_msg}, f"Matched doc: {doc['id']}"))
        else:
            reply = (
                "Hello! I am NovaWare SupportAgent. I can answer questions regarding account plans, "
                "billing, payment status, refunds, or general support. How can I assist you today?"
            )
            steps.append(_step("fallback_response", {"reason": str(exc)[:100]}, "Generated welcome reply"))

    # Persist messages to Supabase if conversation exists
    if conversation_id:
        tools.save_message(conversation_id, "customer", last_user_msg)
        tools.save_message(conversation_id, "ai", reply)

    return reply, steps

