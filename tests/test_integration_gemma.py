"""Smoke integration test with live hosted Gemma API (OpenRouter or OpenAI-compatible)."""

import os
import pytest

from backend.config import settings
from backend.schemas import FollowupDraftRequest, FollowupTone
from backend.gemma_provider import HostedGemmaProvider


def test_live_hosted_gemma_inference():
    """Execute live neural inference against hosted Gemma endpoint if GEMMA_HOSTED_API_KEY is configured."""
    api_key = os.getenv("GEMMA_HOSTED_API_KEY") or settings.gemma_hosted_api_key
    if not api_key or api_key.strip() == "" or api_key == "your_openrouter_or_hosted_api_key_here":
        pytest.skip(
            "GEMMA_HOSTED_API_KEY is not set or contains placeholder.\n"
            "To test live hosted Gemma inference:\n"
            "1. Obtain an API key from https://openrouter.ai/keys (free tier models available)\n"
            "2. Add to your .env:\n"
            "   GEMMA_PROVIDER=hosted\n"
            "   GEMMA_HOSTED_BASE_URL=https://openrouter.ai/api/v1\n"
            "   GEMMA_HOSTED_API_KEY=sk-or-v1-...\n"
            "   GEMMA_HOSTED_MODEL=google/gemma-4-26b-a4b-it:free\n"
            "Ordinary automated unit tests run offline with mock provider."
        )

    base_url = os.getenv("GEMMA_HOSTED_BASE_URL") or settings.gemma_hosted_base_url
    model = os.getenv("GEMMA_HOSTED_MODEL") or settings.gemma_hosted_model

    provider = HostedGemmaProvider(
        base_url=base_url,
        api_key=api_key.strip(),
        model=model.strip(),
        timeout=45.0,
    )

    # 1. Test Gentle Tone check-in (Upcoming invoice)
    req_gentle = FollowupDraftRequest(
        invoice_id="INV-2024-020",
        customer_name="Terraform Spatial",
        invoice_amount=6800.00,
        currency="USD",
        payment_terms_days=30,
        due_date="2026-10-24",
        reference_date="2026-10-18",
        tone=FollowupTone.GENTLE,
        business_name="North Star Studios",
    )
    resp_gentle = provider.generate_followup(req_gentle)

    assert resp_gentle.invoice_id == "INV-2024-020"
    assert resp_gentle.customer_name == "Terraform Spatial"
    assert resp_gentle.tone == FollowupTone.GENTLE
    assert len(resp_gentle.drafted_message.strip()) > 20
    assert "Gemma (Hosted:" in resp_gentle.inference_provider
    assert resp_gentle.human_approval_required is True
    assert resp_gentle.date_facts is not None
    assert resp_gentle.date_facts["status"] == "upcoming"
    assert resp_gentle.date_facts["days_until_due"] == 6

    # Confirm facts preserved
    msg_gentle = resp_gentle.drafted_message
    assert "INV-2024-020" in msg_gentle or "2024-020" in msg_gentle
    # Friendly check-in for upcoming invoice should not claim overdue
    assert "overdue" not in msg_gentle.lower()

    # 2. Test Firm Tone reminder (Overdue invoice)
    req_firm = FollowupDraftRequest(
        invoice_id="INV-2024-021",
        customer_name="Umbra Games",
        invoice_amount=9200.00,
        currency="USD",
        payment_terms_days=30,
        due_date="2026-10-04",
        reference_date="2026-10-18",
        tone=FollowupTone.FIRM,
        business_name="North Star Studios",
    )
    resp_firm = provider.generate_followup(req_firm)

    assert resp_firm.invoice_id == "INV-2024-021"
    assert resp_firm.customer_name == "Umbra Games"
    assert resp_firm.tone == FollowupTone.FIRM
    assert len(resp_firm.drafted_message.strip()) > 20
    assert "Gemma (Hosted:" in resp_firm.inference_provider
    assert resp_firm.human_approval_required is True
    assert resp_firm.date_facts is not None
    assert resp_firm.date_facts["status"] == "overdue"
    assert resp_firm.date_facts["days_overdue"] == 14

    msg_firm = resp_firm.drafted_message
    assert "INV-2024-021" in msg_firm or "2024-021" in msg_firm

