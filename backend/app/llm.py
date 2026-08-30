"""Thin wrapper around the Groq API (OpenAI-compatible).

The LLM is ONLY the reasoning component. It never touches the database
and never sees credentials. Everything it receives is assembled by our
backend (context builder) and everything it returns is validated by us.
"""
import json
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()
API_URL = "https://api.groq.com/openai/v1/chat/completions"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    f"/{GEMINI_MODEL}:generateContent"
)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").strip().lower()


class LLMError(Exception):
    """Raised when the LLM call fails or returns unusable output."""


def _groq_headers():
    if not GROQ_API_KEY:
        raise LLMError(
            "GROQ_API_KEY is not set. Copy backend/.env.example to "
            "backend/.env and add your key from https://console.groq.com/keys"
        )
    return {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}


def post_payload(payload: dict) -> dict:
    """Send an OpenAI-format chat payload to the configured LLM and return the raw response."""
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY.startswith("AIzaSy"):
        return _post_gemini(payload)

    timeout = int(os.getenv("LLM_TIMEOUT", "30"))
    try:
        resp = httpx.post(API_URL, headers=_groq_headers(), json=payload, timeout=timeout)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise LLMError(f"Groq API error {exc.response.status_code}: {exc.response.text[:300]}") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach Groq API: {exc}") from exc

    try:
        return resp.json()
    except ValueError as exc:
        raise LLMError("Invalid JSON from Groq API") from exc


def _post_gemini(payload: dict) -> dict:
    """Optional fallback when LLM_PROVIDER is 'gemini' (takes an OpenAI-format payload)."""
    if not GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY is not set but LLM_PROVIDER is 'gemini'.")
    system_text = "\n".join(
        m["content"] for m in payload.get("messages", []) if m["role"] == "system"
    )
    body = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in payload.get("messages", []) if m["role"] != "system"
        ],
        "generationConfig": {
            "temperature": payload.get("temperature", 0.4),
            "maxOutputTokens": payload.get("max_tokens", 2048),
        },
    }
    timeout = int(os.getenv("LLM_TIMEOUT", "30"))
    try:
        resp = httpx.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=body, timeout=timeout)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise LLMError(f"Gemini API error {exc.response.status_code}: {exc.response.text[:300]}") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach Gemini API: {exc}") from exc
    try:
        return resp.json()
    except ValueError as exc:
        raise LLMError("Invalid JSON from Gemini API") from exc


def _extract_text(data: dict) -> str:
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        pass
    # Gemini fallback shape
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("Unexpected LLM response shape: " + json.dumps(data)[:300]) from exc


def _chat(messages: list, temperature: float, max_tokens: int) -> str:
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    return _extract_text(post_payload(payload)).strip()


def llm_text(system_prompt: str, contents: list, temperature: float = 0.4) -> str:
    """Plain-text generation. `contents` is a list of {role, parts} (Gemini-style)."""
    messages = [{"role": "system", "content": system_prompt}]
    for content in contents:
        role = "assistant" if content.get("role") == "model" else "user"
        text = "\n".join(p.get("text", "") for p in content.get("parts", []) if p.get("text"))
        messages.append({"role": role, "content": text})
    return _chat(messages, temperature, 1024)


def llm_json(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> dict:
    """JSON generation. `user_prompt` is a plain string of context + instructions."""
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048,
        "response_format": {"type": "json_object"},
    }
    raw = _extract_text(post_payload(payload)).strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(raw)
