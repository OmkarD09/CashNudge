"""Prompt construction and safety guardrails for Gemma follow-up drafting."""

from backend.schemas import FollowupDraftRequest, FollowupTone
from backend.date_utils import compute_invoice_date_facts, InvoiceDateFacts


SYSTEM_DIRECTIVE = """You are a professional payment follow-up assistant for freelancers and independent agencies.
Your sole job is to draft a polite, clear, professional email reminder regarding an invoice.

CRITICAL SAFETY & TRUTH RULES:
1. ONLY USE THE FACTUAL DETAILS PROVIDED BELOW. Never invent due dates, amounts, payment history, late fees, penalties, or payment links.
2. DO NOT DISCLOSE INTERNAL RISK SCORES OR ML PREDICTIONS. Never mention "TabPFN", "risk score", "high risk", or "late probability" to the client.
3. PRESERVE ACCURACY: Keep the invoice amount and currency exact.
4. NO LEGAL THREATS OR AGGRESSIVE LANGUAGE. Remain courteous and preserve the client relationship.
5. NO FABRICATED CLAIMS: Follow the verified date and status facts strictly. Never describe a past due date as upcoming, and never invent overdue claims for an upcoming invoice.
6. OUTPUT FORMAT: Output ONLY the email (Subject and Body). Do NOT include conversational meta-commentary like "Here is the email:".
"""


def build_gemma_prompt(req: FollowupDraftRequest) -> str:
    """Build a structured prompt instructing Gemma to draft a grounded payment reminder."""
    # Deterministically calculate verified date facts
    date_facts: InvoiceDateFacts = compute_invoice_date_facts(
        due_date=req.due_date,
        reference_date=req.reference_date,
        explicit_days_overdue=req.days_overdue,
    )

    # 1. Compile factual invoice details
    details = [f"- Invoice ID: {req.invoice_id}"]
    details.append(f"- Client / Recipient: {req.customer_name}")
    
    if req.invoice_amount is not None:
        details.append(f"- Amount Due: {req.currency} {req.invoice_amount:,.2f}")
    if req.project_category:
        details.append(f"- Project / Work Type: {req.project_category}")
    if req.payment_terms_days:
        details.append(f"- Agreed Payment Terms: Net {req.payment_terms_days} days")

    # Add verified deterministic date facts
    if date_facts.status == "upcoming":
        details.append(f"- Invoice Due Date: {date_facts.due_date}")
        details.append(f"- Payment Timing: Upcoming (due in {date_facts.days_until_due} day(s) on {date_facts.due_date})")
        details.append("- Current Status: NOT overdue. Within agreed payment terms.")
        date_directive = (
            "DATE DIRECTIVE: The invoice is UPCOMING and within terms. "
            f"Explicitly note that it is due on {date_facts.due_date}. "
            "Do NOT state or imply that payment is late, overdue, or delayed."
        )
    elif date_facts.status == "due_today":
        details.append(f"- Invoice Due Date: {date_facts.due_date} (Due today)")
        details.append("- Payment Timing: Due today")
        details.append("- Current Status: Scheduled for payment today.")
        date_directive = (
            "DATE DIRECTIVE: The invoice is DUE TODAY. "
            f"Politely note that payment is scheduled for today ({date_facts.due_date}). "
            "Do NOT claim the invoice is past due or delinquent."
        )
    elif date_facts.status == "overdue":
        due_str = date_facts.due_date or "the agreed due date"
        details.append(f"- Invoice Due Date: {due_str}")
        details.append(f"- Payment Timing: Past due by {date_facts.days_overdue} day(s)")
        details.append(f"- Current Status: Overdue by {date_facts.days_overdue} day(s).")
        date_directive = (
            f"DATE DIRECTIVE: The invoice is OVERDUE by {date_facts.days_overdue} day(s) (due {due_str}). "
            "Address the outstanding balance professionally. Never describe this invoice as upcoming."
        )
    else:  # unspecified
        details.append("- Invoice Due Date: Not specified")
        details.append("- Current Status: Open outstanding invoice.")
        date_directive = (
            "DATE DIRECTIVE: No specific due date was provided. "
            "Inquire about payment status politely without inventing a due date or overdue duration."
        )

    sender = req.business_name or "the freelancer"
    details.append(f"- Sender Business: {sender}")

    if req.user_context:
        details.append(f"- Additional User Context: {req.user_context}")

    facts_block = "\n".join(details)

    # 2. Tone directives
    if req.tone == FollowupTone.GENTLE:
        tone_instruction = (
            "TONE: GENTLE & COLLABORATIVE\n"
            "- Friendly, courteous check-in acknowledging their busy schedule.\n"
            "- Gently inquire if they received the invoice and if they require any clarifications or paperwork.\n"
            "- Light touch: avoid demanding urgency; invite them to confirm their payment schedule."
        )
    else:  # FollowupTone.FIRM
        tone_instruction = (
            "TONE: FIRM & DIRECT\n"
            "- Clear, focused professional notice regarding the outstanding balance.\n"
            "- Reiterate invoice identifier, amount, and agreed payment terms clearly.\n"
            "- Politely but firmly request an updated payment date or confirmation of processing.\n"
            "- Strictly avoid emotional language, harassment, or legal threats."
        )

    prompt = f"""{SYSTEM_DIRECTIVE}

FACTUAL INVOICE CONTEXT:
{facts_block}

{date_directive}

{tone_instruction}

Draft a clear, professional email now:
"""
    return prompt
