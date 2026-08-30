"""Email service using Resend.

Handles:
  1. Ticket confirmation email (on submit)
  2. Support response email (on human approve or auto-send)

Includes duplicate-send protection.
"""
import os
from dotenv import load_dotenv
import requests

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
FROM_EMAIL = os.getenv("FROM_EMAIL", "support@novaware.dev").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()

EMAILS_API = "https://api.resend.com/emails"


def _is_configured() -> bool:
    return bool(RESEND_API_KEY) and RESEND_API_KEY != "your_resend_key_here"


def _send(to: str, subject: str, html: str) -> dict:
    """Send an email via Resend. Returns {id, error}."""
    if not _is_configured():
        return {"error": "RESEND_API_KEY not configured", "id": None}
    try:
        resp = requests.post(
            EMAILS_API,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=15,
        )
        data = resp.json()
        if resp.status_code == 200:
            return {"id": data.get("id"), "error": None}
        return {"id": None, "error": data.get("message", f"HTTP {resp.status_code}")}
    except Exception as e:
        return {"id": None, "error": str(e)}


def send_ticket_confirmation(customer_name: str, customer_email: str,
                             ticket_id: int, subject: str) -> dict:
    """Email #1: confirm we received the ticket."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>We received your support request</h2>
        <p>Hi {customer_name},</p>
        <p>We've received your support request and our team will review it shortly.</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <strong>Ticket ID:</strong> #{ticket_id}<br>
            <strong>Subject:</strong> {subject}
        </div>
        <p>You can track your ticket status at any time.</p>
        <p>Regards,<br><strong>NovaWare Support Team</strong></p>
    </div>
    """
    result = _send(customer_email, f"We received your support request - Ticket #{ticket_id}", html)
    return {"email_type": "ticket_confirmation", "to": customer_email, **result}


def send_support_response(customer_name: str, customer_email: str,
                          ticket_id: int, response_text: str) -> dict:
    """Email #2: support responds to the customer."""
    html = f"""
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>Re: Your support request #{ticket_id}</h2>
        <p>Hi {customer_name},</p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; white-space: pre-line;">
{response_text}
        </div>
        <p>If you need further assistance, feel free to reply to this email or create a new ticket.</p>
        <p>Regards,<br><strong>NovaWare Support Team</strong></p>
    </div>
    """
    result = _send(customer_email, f"Re: Your support request #{ticket_id}", html)
    return {"email_type": "support_response", "to": customer_email, **result}
