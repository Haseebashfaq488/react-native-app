"""Pydantic request/response schemas + validation of LLM output."""
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class TicketCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=100)
    customer_email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class ChatTurn(BaseModel):
    role: str  # "user" or "ai"
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn]
    customer_email: Optional[EmailStr] = None
    conversation_id: Optional[int] = None


class ConvertChatRequest(BaseModel):
    conversation_id: int
    customer_email: str
    subject: str


class RespondRequest(BaseModel):
    response_text: str = Field(min_length=1, max_length=20000)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class TicketAnalysis(BaseModel):
    intent: str
    category: str
    priority: str
    confidence: float
    reasoning_summary: str
    recommended_action: str
    suggested_response: str
    knowledge_used: list[str] = []


def validate_analysis(raw: dict) -> TicketAnalysis:
    """Strict validation of what the LLM returned.

    If this fails we retry once and then fall back to human review -
    a malformed AI answer can never corrupt system state.
    """
    raw["category"] = str(raw.get("category", "")).strip().upper()
    raw["priority"] = str(raw.get("priority", "")).strip().upper()
    raw["recommended_action"] = str(raw.get("recommended_action", "")).strip().upper()

    if raw["category"] not in (
        "ACCOUNT", "BILLING", "TECHNICAL", "REFUND",
        "SECURITY", "FEATURE_REQUEST", "GENERAL", "OTHER",
    ):
        raise ValueError(f"invalid category: {raw['category']}")
    if raw["priority"] not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        raise ValueError(f"invalid priority: {raw['priority']}")
    if raw["recommended_action"] not in ("AUTOMATIC_RESPONSE", "HUMAN_REVIEW", "ESCALATE"):
        raise ValueError(f"invalid action: {raw['recommended_action']}")

    conf = float(raw.get("confidence", -1))
    if not 0.0 <= conf <= 1.0:
        raise ValueError("confidence out of range")
    raw["confidence"] = conf

    return TicketAnalysis(**raw)
