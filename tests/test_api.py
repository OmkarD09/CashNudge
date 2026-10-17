"""Integration tests for CashNudge FastAPI endpoints and Gemma follow-up service."""

import os
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import httpx

from backend.main import app
from backend.config import settings

client = TestClient(app)
SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


# ---------------------------------------------------------------------------
# Health & Sample Ledger Endpoints
# ---------------------------------------------------------------------------

def test_health_endpoint():
    """Verify GET /health confirms API service status without exposing credentials."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "CashNudge API"
    assert "token" not in str(data).lower()
    assert "key" not in str(data).lower()
    assert "X-Request-ID" in resp.headers
    assert "providers" in data


def test_get_sample_ledger_analysis():
    """Verify GET /api/v1/ledger/sample analyzes the synthetic dataset correctly."""
    resp = client.get("/api/v1/ledger/sample")
    assert resp.status_code == 200
    data = resp.json()

    assert "summary" in data
    assert "predictions" in data
    assert "metadata" in data

    summary = data["summary"]
    assert summary["total_invoices"] == 24
    assert summary["outstanding_invoices_count"] == 6
    assert summary["total_outstanding_amount"] == 42000.0

    assert len(data["predictions"]) == 6
    assert data["metadata"]["is_synthetic_data"] is True
    assert "TabPFN" in data["metadata"]["model_provider"] or "MockTabPFN" in data["metadata"]["model_provider"]


# ---------------------------------------------------------------------------
# Ledger Upload & Validation Endpoints
# ---------------------------------------------------------------------------

def test_upload_valid_csv():
    """Verify POST /api/v1/ledger/analyze processes a valid uploaded CSV in-memory."""
    with open(SAMPLE_CSV_PATH, "rb") as f:
        resp = client.post(
            "/api/v1/ledger/analyze",
            files={"file": ("synthetic_freelancer_invoices.csv", f, "text/csv")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_invoices"] == 24
    assert len(data["predictions"]) == 6


def test_upload_non_csv_extension_rejected():
    """Verify files without a .csv extension are rejected with HTTP 400."""
    fake_file = io.BytesIO(b"invoice_id,client_name\nINV-1,Acme")
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("invoices.json", fake_file, "application/json")},
    )
    assert resp.status_code == 400
    assert "must be a valid CSV document with a .csv extension" in resp.json()["detail"]


def test_upload_empty_file_rejected():
    """Verify empty uploads are rejected with HTTP 422."""
    empty_file = io.BytesIO(b"")
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("empty.csv", empty_file, "text/csv")},
    )
    assert resp.status_code == 422
    assert "Uploaded CSV file is empty" in resp.json()["detail"]


def test_upload_oversized_file_rejected():
    """Verify uploads exceeding max_upload_size_bytes return HTTP 413."""
    orig_limit = settings.max_upload_size_bytes
    try:
        settings.max_upload_size_bytes = 50  # Set strict 50-byte limit
        large_content = b"invoice_id,client_name,project_category,client_tier,invoice_amount,payment_terms_days,revision_count,past_late_count,status,actual_days_to_pay\n" * 5
        resp = client.post(
            "/api/v1/ledger/analyze",
            files={"file": ("large.csv", io.BytesIO(large_content), "text/csv")},
        )
        assert resp.status_code == 413
        assert "exceeds maximum permitted size" in resp.json()["detail"]
    finally:
        settings.max_upload_size_bytes = orig_limit


def test_upload_missing_columns_validation_error():
    """Verify uploaded CSV with missing required columns returns 422 with error details."""
    csv_missing = "invoice_id,client_name,invoice_amount\nINV-001,Acme,1500.00\n"
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("missing.csv", io.BytesIO(csv_missing.encode("utf-8")), "text/csv")},
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert "errors" in detail
    assert any(e["error_type"] == "MISSING_COLUMNS" for e in detail["errors"])


def test_upload_malformed_amounts_validation_error():
    """Verify malformed amounts return 422 and are never silently converted to zero."""
    with open(SAMPLE_CSV_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Corrupt an invoice amount
    bad_content = content.replace("6500.00", "INVALID_AMT", 1)
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("bad_amount.csv", io.BytesIO(bad_content.encode("utf-8")), "text/csv")},
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert any(e["error_type"] == "INVALID_AMOUNT" for e in detail["errors"])


def test_upload_duplicate_ids_validation_error():
    """Verify duplicate invoice IDs in upload return 422."""
    with open(SAMPLE_CSV_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Duplicate first ID
    bad_content = content.replace("INV-2024-002", "INV-2024-001", 1)
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("duplicates.csv", io.BytesIO(bad_content.encode("utf-8")), "text/csv")},
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert any(e["error_type"] == "DUPLICATE_INVOICE_ID" for e in detail["errors"])


def test_upload_insufficient_historical_rows():
    """Verify upload with insufficient historical rows returns 422."""
    header = "invoice_id,client_name,project_category,client_tier,invoice_amount,payment_terms_days,revision_count,past_late_count,status,actual_days_to_pay\n"
    rows = (
        "INV-1,Client A,Web,Mid-Market,1000.00,30,0,0,paid_on_time,20\n"
        "INV-2,Client B,Web,Mid-Market,2000.00,30,1,1,paid_late,45\n"
        "INV-3,Client C,Web,Mid-Market,3000.00,30,0,0,open,\n"
    )
    resp = client.post(
        "/api/v1/ledger/analyze",
        files={"file": ("insufficient.csv", io.BytesIO((header + rows).encode("utf-8")), "text/csv")},
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["error_type"] == "InsufficientHistoricalDataError"


# ---------------------------------------------------------------------------
# Gemma Follow-Up Drafting Endpoints
# ---------------------------------------------------------------------------

def test_draft_followup_gentle_tone(monkeypatch):
    """Verify POST /api/v1/followups/draft creates a gentle, collaborative check-in."""
    monkeypatch.setenv("GEMMA_PROVIDER", "mock")
    payload = {
        "invoice_id": "INV-2024-019",
        "customer_name": "Silverline Fintech",
        "invoice_amount": 15500.00,
        "currency": "USD",
        "project_category": "Full-Stack Web App",
        "payment_terms_days": 60,
        "due_date": "2026-10-24",
        "reference_date": "2026-10-18",
        "days_overdue": 0,
        "risk_tier": "high",
        "late_probability": 0.85,
        "tone": "gentle",
        "business_name": "Antigravity Studios",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["invoice_id"] == "INV-2024-019"
    assert data["customer_name"] == "Silverline Fintech"
    assert data["tone"] == "gentle"
    assert data["human_approval_required"] is True
    assert "friendly check-in" in data["drafted_message"].lower()
    assert "$15,500.00" in data["drafted_message"] or "15,500.00" in data["drafted_message"]
    # Verify internal risk scores are NOT disclosed to the client in the message
    assert "85%" not in data["drafted_message"]
    assert "risk score" not in data["drafted_message"].lower()


def test_draft_followup_firm_tone(monkeypatch):
    """Verify POST /api/v1/followups/draft creates a firm, professional reminder for overdue payments."""
    monkeypatch.setenv("GEMMA_PROVIDER", "mock")
    payload = {
        "invoice_id": "INV-2024-021",
        "customer_name": "Umbra Games",
        "invoice_amount": 9200.00,
        "currency": "USD",
        "project_category": "Mobile App Development",
        "payment_terms_days": 30,
        "due_date": "2026-10-04",
        "reference_date": "2026-10-18",
        "days_overdue": 14,
        "risk_tier": "high",
        "late_probability": 0.95,
        "tone": "firm",
        "business_name": "Apex Freelance",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["tone"] == "firm"
    msg = data["drafted_message"].lower()
    assert "outstanding" in msg
    assert "14 day(s) past" in msg or "past" in msg
    assert data["human_approval_required"] is True
    # Ensure no unverified aggressive legal threats
    assert "lawyer" not in msg
    assert "sue" not in msg


def test_draft_followup_missing_due_date_does_not_hallucinate(monkeypatch):
    """Verify follow-up works when due-date is missing and does not falsely claim the invoice is overdue."""
    monkeypatch.setenv("GEMMA_PROVIDER", "mock")
    payload = {
        "invoice_id": "INV-2024-022",
        "customer_name": "Vanguard PR",
        "invoice_amount": 2100.00,
        "currency": "USD",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    msg = data["drafted_message"].lower()
    assert "overdue" not in msg


def test_draft_followup_unsupported_tone_rejected():
    """Verify non-supported tones return HTTP 422."""
    payload = {
        "invoice_id": "INV-101",
        "customer_name": "Test Corp",
        "tone": "aggressive",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 422


def test_draft_followup_missing_required_fields_rejected():
    """Verify missing invoice_id or customer_name returns HTTP 422."""
    payload = {
        "invoice_amount": 1000.00,
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 422


def test_draft_followup_explicit_mock_provider(monkeypatch):
    """Verify Mock provider is accurately identified and not masked as real Gemma."""
    monkeypatch.setenv("GEMMA_PROVIDER", "mock")
    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "MockGemmaProvider" in data["inference_provider"]
    assert any("Mock Gemma provider" in w for w in data["warnings"])


# ---------------------------------------------------------------------------
# Gemma Error Handling & Failure Scenarios (No Silent Fallbacks)
# ---------------------------------------------------------------------------

def test_ollama_connection_error_raises_503(monkeypatch):
    """Verify connection failure to Ollama returns actionable 503 and NEVER silently falls back to mock."""
    monkeypatch.setenv("GEMMA_PROVIDER", "ollama")

    import backend.gemma_provider as gp

    class MockClientConnectError:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            raise httpx.ConnectError("Connection refused to Ollama server")

    monkeypatch.setattr(gp.httpx, "Client", MockClientConnectError)

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaConnectionError"
    assert "Unable to connect to Ollama" in detail["message"]
    assert "ollama serve" in detail["message"]


def test_ollama_model_not_found_raises_502(monkeypatch):
    """Verify 404 from Ollama returns 502 with actionable pull instructions."""
    monkeypatch.setenv("GEMMA_PROVIDER", "ollama")

    import backend.gemma_provider as gp

    class MockClient404:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            class MockResponse:
                status_code = 404
                text = "model 'gemma2:2b' not found"
            return MockResponse()

    monkeypatch.setattr(gp.httpx, "Client", MockClient404)

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaModelNotFoundError"
    assert "ollama pull" in detail["message"]


def test_ollama_timeout_raises_504(monkeypatch):
    """Verify Ollama timeout returns HTTP 504."""
    monkeypatch.setenv("GEMMA_PROVIDER", "ollama")

    import backend.gemma_provider as gp

    class MockClientTimeout:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            raise httpx.TimeoutException("Connection timed out waiting for Ollama")

    monkeypatch.setattr(gp.httpx, "Client", MockClientTimeout)

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 504
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaTimeoutError"
    assert "timed out" in detail["message"]


def test_hosted_gemma_missing_credentials_raises_500(monkeypatch):
    """Verify hosted Gemma provider without API key raises HTTP 500 configuration error."""
    monkeypatch.setenv("GEMMA_PROVIDER", "hosted")
    monkeypatch.delenv("GEMMA_HOSTED_API_KEY", raising=False)
    monkeypatch.setenv("GEMMA_HOSTED_BASE_URL", "https://api.groq.com/openai/v1")

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 500
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaConfigurationError"
    assert "Missing GEMMA_HOSTED_API_KEY" in detail["message"]


def test_hosted_gemma_rate_limit_raises_429(monkeypatch):
    """Verify hosted Gemma provider 429 returns HTTP 429 Too Many Requests."""
    monkeypatch.setenv("GEMMA_PROVIDER", "hosted")
    monkeypatch.setenv("GEMMA_HOSTED_API_KEY", "test-key-mock")
    monkeypatch.setenv("GEMMA_HOSTED_BASE_URL", "https://openrouter.ai/api/v1")

    import httpx

    class Mock429Response:
        status_code = 429
        text = '{"error": {"message": "Rate limit exceeded"}}'

    class Mock429Client:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            return Mock429Response()

    monkeypatch.setattr(httpx, "Client", Mock429Client)

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaRateLimitError"
    assert "Rate limit exceeded" in detail["message"]


def test_hosted_gemma_model_not_found_raises_502(monkeypatch):
    """Verify hosted Gemma provider 404 returns HTTP 502 with GemmaModelNotFoundError."""
    monkeypatch.setenv("GEMMA_PROVIDER", "hosted")
    monkeypatch.setenv("GEMMA_HOSTED_API_KEY", "test-key-mock")
    monkeypatch.setenv("GEMMA_HOSTED_BASE_URL", "https://openrouter.ai/api/v1")

    import httpx

    class Mock404Response:
        status_code = 404
        text = '{"error": {"message": "Model not found"}}'

    class Mock404Client:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            return Mock404Response()

    monkeypatch.setattr(httpx, "Client", Mock404Client)

    payload = {
        "invoice_id": "INV-001",
        "customer_name": "Test Client",
        "tone": "gentle",
    }
    resp = client.post("/api/v1/followups/draft", json=payload)
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail["error_type"] == "GemmaModelNotFoundError"
    assert "was not found" in detail["message"]
