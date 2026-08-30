"""Backend policy engine.

The AI only RECOMMENDS an action. This module is the actual authority
that decides what happens. The AI cannot bypass these rules.
"""

ALLOWED_CATEGORIES = {
    "ACCOUNT",
    "BILLING",
    "TECHNICAL",
    "REFUND",
    "SECURITY",
    "FEATURE_REQUEST",
    "GENERAL",
    "OTHER",
}
ALLOWED_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

# Categories that can NEVER be auto-answered, regardless of confidence
ALWAYS_REVIEW_CATEGORIES = {"REFUND", "SECURITY"}

# Below this confidence the ticket goes to a human
CONFIDENCE_THRESHOLD = 0.6


def apply_policy(analysis: dict) -> dict:
    """Enforce business rules on top of the AI recommendation."""
    reasons = []

    if analysis.get("category") in ALWAYS_REVIEW_CATEGORIES:
        reasons.append(
            f"{analysis['category']} issues always require human approval"
        )
    if analysis.get("priority") == "CRITICAL":
        reasons.append("CRITICAL priority requires human review")
    if isinstance(analysis.get("confidence"), (int, float)):
        if analysis["confidence"] < CONFIDENCE_THRESHOLD:
            reasons.append(
                f"Confidence {analysis['confidence']:.0%} is below the "
                f"{CONFIDENCE_THRESHOLD:.0%} threshold"
            )
    if analysis.get("recommended_action") in ("HUMAN_REVIEW", "ESCALATE"):
        reasons.append(f"AI itself recommended {analysis['recommended_action']}")

    decision = "HUMAN_REVIEW" if reasons else "AUTO_RESPONSE"
    return {
        "decision": decision,
        # Map to actual DB status values
        "status": "IN_PROGRESS" if decision == "HUMAN_REVIEW" else "RESOLVED",
        "policy_reasons": reasons,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }
