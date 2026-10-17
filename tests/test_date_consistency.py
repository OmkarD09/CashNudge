"""Regression tests for invoice date consistency, status derivation, and prompt truthfulness."""

from datetime import date, timedelta
import pytest

from backend.date_utils import (
    compute_invoice_date_facts,
    get_synthetic_demo_due_date,
    SYNTHETIC_OPEN_INVOICE_OFFSETS,
    parse_date_safe,
)
from backend.schemas import FollowupDraftRequest, FollowupTone, InvoicePrediction, RiskTier
from backend.prompt_builder import build_gemma_prompt
from backend.gemma_provider import MockGemmaProvider
from backend.ml_engine import analyze_ledger
from backend.data_validator import load_and_validate_csv
from pathlib import Path

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_upcoming_invoice_deterministic_calculation():
    """Verify an invoice with a due date in the future relative to reference date is classified as upcoming."""
    fixed_ref = "2026-10-18"
    future_due = "2026-10-24"  # 6 days in future
    
    facts = compute_invoice_date_facts(due_date=future_due, reference_date=fixed_ref)
    
    assert facts.status == "upcoming"
    assert facts.is_upcoming is True
    assert facts.is_overdue is False
    assert facts.is_due_today is False
    assert facts.days_until_due == 6
    assert facts.days_overdue == 0
    assert facts.due_date == "2026-10-24"
    assert facts.reference_date == "2026-10-18"
    assert "Upcoming: due in 6 day(s)" in facts.status_label


def test_due_today_invoice_deterministic_calculation():
    """Verify an invoice due on the exact reference date is classified as due today."""
    fixed_ref = "2026-10-18"
    today_due = "2026-10-18"
    
    facts = compute_invoice_date_facts(due_date=today_due, reference_date=fixed_ref)
    
    assert facts.status == "due_today"
    assert facts.is_due_today is True
    assert facts.is_upcoming is False
    assert facts.is_overdue is False
    assert facts.days_until_due == 0
    assert facts.days_overdue == 0
    assert facts.due_date == "2026-10-18"
    assert "Due today" in facts.status_label


def test_overdue_invoice_by_known_days():
    """Verify an invoice due in the past relative to reference date is classified as overdue."""
    fixed_ref = "2026-10-18"
    past_due = "2026-10-04"  # 14 days in past
    
    facts = compute_invoice_date_facts(due_date=past_due, reference_date=fixed_ref)
    
    assert facts.status == "overdue"
    assert facts.is_overdue is True
    assert facts.is_upcoming is False
    assert facts.is_due_today is False
    assert facts.days_overdue == 14
    assert facts.days_until_due is None
    assert facts.due_date == "2026-10-04"
    assert "Overdue by 14 day(s)" in facts.status_label


def test_missing_due_date_handled_safely():
    """Verify an invoice with no due date is classified as unspecified without hallucinating overdue status."""
    fixed_ref = "2026-10-18"
    
    facts = compute_invoice_date_facts(due_date=None, reference_date=fixed_ref)
    
    assert facts.status == "unspecified"
    assert facts.is_overdue is False
    assert facts.is_upcoming is False
    assert facts.is_due_today is False
    assert facts.days_overdue is None
    assert facts.days_until_due is None
    assert facts.due_date is None
    assert "Open invoice (due date not specified)" in facts.status_label


def test_missing_due_date_with_explicit_days_overdue():
    """Verify explicit days overdue is preserved when due date string is absent."""
    fixed_ref = "2026-10-18"
    
    facts = compute_invoice_date_facts(due_date=None, reference_date=fixed_ref, explicit_days_overdue=20)
    
    assert facts.status == "overdue"
    assert facts.is_overdue is True
    assert facts.days_overdue == 20
    assert facts.due_date is None


def test_never_describe_past_due_date_as_upcoming():
    """Critical guardrail: an invoice with a 2024 due date checked against 2026 MUST be overdue."""
    ref_2026 = "2026-10-18"
    due_2024 = "2024-10-24"
    
    facts = compute_invoice_date_facts(due_date=due_2024, reference_date=ref_2026)
    
    # Must NOT be upcoming
    assert facts.status != "upcoming"
    assert facts.is_upcoming is False
    assert facts.status == "overdue"
    assert facts.is_overdue is True
    assert facts.days_overdue > 700  # Exactly ~724 days overdue


def test_prompt_builder_passes_verified_facts_and_strict_directives():
    """Verify build_gemma_prompt includes verified facts and explicit directives."""
    # Upcoming case
    req_upcoming = FollowupDraftRequest(
        invoice_id="INV-2026-001",
        customer_name="Future Tech",
        invoice_amount=5000.00,
        due_date="2026-10-24",
        reference_date="2026-10-18",
        tone=FollowupTone.GENTLE,
    )
    prompt_upcoming = build_gemma_prompt(req_upcoming)
    assert "- Invoice Due Date: 2026-10-24" in prompt_upcoming
    assert "Upcoming (due in 6 day(s) on 2026-10-24)" in prompt_upcoming
    assert "NOT overdue" in prompt_upcoming
    assert "Do NOT state or imply that payment is late, overdue, or delayed" in prompt_upcoming

    # Overdue case
    req_overdue = FollowupDraftRequest(
        invoice_id="INV-2026-002",
        customer_name="Late Corp",
        invoice_amount=8000.00,
        due_date="2026-10-04",
        reference_date="2026-10-18",
        tone=FollowupTone.FIRM,
    )
    prompt_overdue = build_gemma_prompt(req_overdue)
    assert "- Invoice Due Date: 2026-10-04" in prompt_overdue
    assert "Past due by 14 day(s)" in prompt_overdue
    assert "Never describe this invoice as upcoming" in prompt_overdue


def test_mock_gemma_provider_honors_deterministic_date_facts():
    """Verify MockGemmaProvider drafts messages strictly aligned with verified date facts."""
    provider = MockGemmaProvider()
    
    # Upcoming gentle reminder
    resp_upcoming = provider.generate_followup(
        FollowupDraftRequest(
            invoice_id="INV-UPCOMING",
            customer_name="Alpha Client",
            invoice_amount=3500.0,
            due_date="2026-10-25",
            reference_date="2026-10-18",
            tone=FollowupTone.GENTLE,
        )
    )
    assert "scheduled for payment on 2026-10-25 (upcoming in 7 day(s))" in resp_upcoming.drafted_message
    assert "past due" not in resp_upcoming.drafted_message.lower()
    assert resp_upcoming.date_facts["status"] == "upcoming"
    assert resp_upcoming.date_facts["days_until_due"] == 7

    # Overdue firm notice
    resp_overdue = provider.generate_followup(
        FollowupDraftRequest(
            invoice_id="INV-OVERDUE",
            customer_name="Beta Client",
            invoice_amount=7000.0,
            due_date="2026-10-08",
            reference_date="2026-10-18",
            tone=FollowupTone.FIRM,
        )
    )
    assert "is now 10 day(s) past the agreed due date (2026-10-08)" in resp_overdue.drafted_message
    assert resp_overdue.date_facts["status"] == "overdue"
    assert resp_overdue.date_facts["days_overdue"] == 10


def test_synthetic_demo_ledger_date_coherency():
    """Verify that synthetic demo open invoices receive coherent, current-relative dates."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    ref_date = "2026-10-18"
    
    result = analyze_ledger(df, is_synthetic=True, reference_date=ref_date)
    
    # Check open predictions have coherent dates matching the relative offsets
    pred_map = {p.invoice_id: p for p in result.predictions}
    
    # INV-2024-020 (offset +6 days -> upcoming)
    inv_20 = pred_map["INV-2024-020"]
    assert inv_20.due_date == "2026-10-24"
    assert inv_20.due_status == "upcoming"
    assert inv_20.days_overdue == 0
    
    # INV-2024-021 (offset -14 days -> overdue)
    inv_21 = pred_map["INV-2024-021"]
    assert inv_21.due_date == "2026-10-04"
    assert inv_21.due_status == "overdue"
    assert inv_21.days_overdue == 14
    
    # INV-2024-022 (offset 0 days -> due today)
    inv_22 = pred_map["INV-2024-022"]
    assert inv_22.due_date == "2026-10-18"
    assert inv_22.due_status == "due_today"
    assert inv_22.days_overdue == 0
