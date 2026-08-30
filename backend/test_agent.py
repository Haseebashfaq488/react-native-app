import sys
import traceback
from app import support_agent

try:
    print("Testing analyze_ticket...")
    res = support_agent.analyze_ticket(
        ticket_id=1,
        name="John Doe",
        email="john@example.com",
        subject="Payment problem",
        message="I paid for premium plan yesterday but my account still says free plan."
    )
    print("RESULT:")
    print(res)
except Exception as e:
    print("EXCEPTION OCCURRED:")
    traceback.print_exc()
