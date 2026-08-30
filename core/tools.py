"""Agent tools — controlled, read-only access to Supabase data.

The agent NEVER gets database credentials or raw query access.
It can only call these narrow functions, and each function returns
only the minimum fields needed for support. Passwords, tokens and
secrets are never returned by any tool here.
"""
from . import knowledge
from core.supabase_client import get_admin_client


def _sb():
    return get_admin_client()


def get_customer(email: str) -> dict:
    """Support-relevant customer fields ONLY (no secrets ever)."""
    try:
        res = _sb().rpc("get_customer_by_email", {"p_email": email.lower()}).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return {
        "name": None,
        "email": email.lower(),
        "plan": "free",
        "account_status": "unknown",
        "payment_status": "unknown",
        "subscription_status": "unknown",
        "last_payment_date": None,
    }


def get_customer_by_id(customer_id: int) -> dict:
    """Get customer by ID (used when we have the ID from a ticket)."""
    try:
        res = _sb().rpc("get_customer_by_id", {"p_customer_id": customer_id}).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return {}


def get_customer_history(email: str) -> list:
    """Get previous tickets for a customer."""
    customer = get_customer(email)
    cid = customer.get("id")
    if not cid:
        return []
    try:
        res = _sb().rpc("get_customer_history", {"p_customer_id": cid}).execute()
        return res.data or []
    except Exception:
        return []


def search_knowledge(query: str) -> list:
    """Search the company knowledge base (lives in Python, not DB)."""
    docs = knowledge.search_knowledge(query)
    return [
        {"id": d["id"], "title": d["title"], "content": d["content"]} for d in docs
    ]


def get_ticket(ticket_id: int) -> dict:
    """Get a ticket with its customer and latest AI analysis."""
    try:
        res = _sb().rpc("get_ticket_with_analysis", {"p_ticket_id": ticket_id}).execute()
        if res.data:
            return res.data
    except Exception:
        pass
    return {}


def search_tickets(status=None, priority=None, category=None) -> list:
    """Search tickets with filters."""
    try:
        res = _sb().rpc("search_tickets", {
            "p_status": status,
            "p_priority": priority,
            "p_category": category,
            "p_limit": 50,
        }).execute()
        return res.data or []
    except Exception:
        return []


def create_ticket(customer_id: int, subject: str, message: str, conversation_id: int = None) -> dict:
    """Create a new support ticket in Supabase."""
    row = {
        "customer_id": customer_id,
        "subject": subject,
        "message": message,
        "status": "OPEN",
    }
    if conversation_id:
        row["conversation_id"] = conversation_id
    try:
        res = _sb().table("support_tickets").insert(row).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def update_ticket(ticket_id: int, updates: dict) -> dict:
    """Update ticket status/priority/category."""
    try:
        res = _sb().table("support_tickets").update(updates).eq("id", ticket_id).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def save_ai_analysis(ticket_id: int, analysis: dict) -> dict:
    """Persist the AI analysis result for traceability."""
    row = {
        "ticket_id": ticket_id,
        "intent": analysis.get("intent"),
        "category": analysis.get("category"),
        "priority": analysis.get("priority"),
        "confidence": analysis.get("confidence"),
        "reasoning_summary": analysis.get("reasoning_summary"),
        "recommended_action": analysis.get("recommended_action"),
        "final_decision": analysis.get("final_decision"),
        "suggested_response": analysis.get("suggested_response"),
        "knowledge_used": analysis.get("knowledge_used", []),
        "model_used": analysis.get("model_used", "gemini-3.6-flash"),
        "ai_failed": analysis.get("ai_failed", False),
    }
    try:
        res = _sb().table("ai_analyses").insert(row).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def log_activity(ticket_id: int, actor: str, action: str, details: dict = None) -> dict:
    """Record an activity log entry."""
    row = {
        "ticket_id": ticket_id,
        "actor": actor,
        "action": action,
        "details": details or {},
    }
    try:
        res = _sb().table("activity_logs").insert(row).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def create_conversation(customer_email: str) -> dict:
    """Create a new conversation for live chat."""
    try:
        res = _sb().table("conversations").insert({"customer_email": customer_email}).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def save_message(conversation_id: int, sender_type: str, content: str) -> dict:
    """Save a message to a conversation."""
    row = {
        "conversation_id": conversation_id,
        "sender_type": sender_type,
        "content": content,
    }
    try:
        res = _sb().table("messages").insert(row).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        return {"error": str(e)}


def get_conversation_messages(conversation_id: int) -> list:
    """Get all messages in a conversation."""
    try:
        res = (
            _sb().table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return res.data or []
    except Exception:
        return []


def get_or_create_customer(email: str, name: str = None) -> dict:
    """Get customer by email or create a record if it does not exist."""
    clean_email = (email or "guest@novaware.dev").lower()
    customer = get_customer(clean_email)
    if customer.get("id"):
        return customer

    try:
        cust_name = name or clean_email.split("@")[0].capitalize()
        res = _sb().table("customers").insert({"name": cust_name, "email": clean_email}).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return customer


def convert_chat_to_ticket(conversation_id: int, customer_email: str, subject: str) -> dict:
    """Convert a live chat conversation into a ticket."""
    customer = get_or_create_customer(customer_email)
    cid = customer.get("id")

    # Get conversation messages for context
    messages = get_conversation_messages(conversation_id)
    message_text = (
        "\n".join(f"[{m['sender_type']}]: {m['content']}" for m in messages)
        if messages
        else subject
    )

    # Create ticket
    ticket = create_ticket(
        customer_id=cid,
        subject=subject,
        message=message_text,
        conversation_id=conversation_id,
    )

    # Link conversation to ticket
    if ticket.get("id"):
        try:
            _sb().table("conversations").update(
                {"ticket_id": ticket["id"]}
            ).eq("id", conversation_id).execute()
        except Exception:
            pass

    return ticket


def get_or_create_customer_profile(email: str) -> dict:
    """Return the full customers row for an email, creating a default row if missing.

    Used by the profile page so any signed-in user always has an editable row.
    """
    email = (email or "").strip().lower()
    if not email:
        return {}
    try:
        res = _sb().table("customers").select("*").eq("email", email).execute()
        if res.data:
            return res.data[0]
        ins = (
            _sb()
            .table("customers")
            .insert({"name": email.split("@")[0], "email": email})
            .execute()
        )
        if ins.data:
            return ins.data[0]
    except Exception:
        pass
    # Fallback so the UI can still render if the DB is unreachable.
    return {
        "id": None,
        "name": email.split("@")[0],
        "email": email,
        "plan": "free",
        "account_status": "active",
        "payment_status": "none",
        "subscription_status": "free_plan",
        "created_at": None,
    }


def update_customer_profile(email: str, fields: dict) -> dict:
    """Update editable profile columns on the customers row."""
    email = (email or "").strip().lower()
    allowed = {"name", "plan", "account_status", "payment_status", "subscription_status"}
    payload = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not payload:
        return {"error": "no valid fields to update"}
    try:
        res = _sb().table("customers").update(payload).eq("email", email).execute()
        if res.data:
            return res.data[0]
        return {"error": "customer not found"}
    except Exception as e:
        return {"error": str(e)}

