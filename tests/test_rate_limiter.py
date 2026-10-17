"""Tests for in-memory rate limiter and abuse protection."""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.rate_limiter import InMemoryRateLimiter, limiter, get_client_ip
from backend.schemas import FollowupDraftResponse, FollowupTone


class DummyGemma:
    def generate_followup(self, request):
        return FollowupDraftResponse(
            invoice_id=request.invoice_id,
            customer_name=request.customer_name,
            tone=request.tone,
            drafted_message="Friendly reminder regarding your invoice.",
            inference_provider="MockGemma",
        )


@pytest.fixture(autouse=True)
def mock_gemma_for_rate_limiting(monkeypatch):
    """Mock AI inference so rate limit tests run instantaneously without network credits."""
    monkeypatch.setattr("backend.main.get_gemma_provider", lambda: DummyGemma())



def test_in_memory_rate_limiter_unit():
    """Unit test for InMemoryRateLimiter sliding window tracking."""
    r_limiter = InMemoryRateLimiter()
    client_id = "test_client_1"

    # Allow up to 3 requests
    for i in range(3):
        allowed, remaining, retry = r_limiter.check(client_id, max_requests=3, window_seconds=60)
        assert allowed is True
        assert remaining == 2 - i
        assert retry == 0

    # 4th request must be rejected
    allowed, remaining, retry = r_limiter.check(client_id, max_requests=3, window_seconds=60)
    assert allowed is False
    assert remaining == 0
    assert retry > 0

    # Reset clears tracking
    r_limiter.reset()
    allowed, remaining, retry = r_limiter.check(client_id, max_requests=3, window_seconds=60)
    assert allowed is True


def test_api_rate_limiter_http_429_enforcement(monkeypatch):
    """Test that exceeding endpoint rate limit returns HTTP 429 with Retry-After header."""
    limiter.reset()
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    
    # Configure low limit for testing
    from backend.main import rate_limit_followup
    original_limit = rate_limit_followup.requests_per_minute
    rate_limit_followup.requests_per_minute = 2

    client = TestClient(app)
    payload = {
        "invoice_id": "INV-RL-01",
        "customer_name": "RateLimit Test",
        "invoice_amount": 1000.0,
        "tone": "gentle",
    }

    try:
        # Request 1: OK
        res1 = client.post("/api/v1/followups/draft", json=payload)
        assert res1.status_code == 200

        # Request 2: OK
        res2 = client.post("/api/v1/followups/draft", json=payload)
        assert res2.status_code == 200

        # Request 3: HTTP 429 Too Many Requests
        res3 = client.post("/api/v1/followups/draft", json=payload)
        assert res3.status_code == 429
        data = res3.json()
        assert data["detail"]["error_type"] == "ClientRateLimitError"
        assert "Retry-After" in res3.headers
    finally:
        rate_limit_followup.requests_per_minute = original_limit
        limiter.reset()


def test_api_rate_limiter_bypass_when_disabled(monkeypatch):
    """Verify rate limiter is bypassed when settings.rate_limit_enabled is False."""
    limiter.reset()
    monkeypatch.setattr(settings, "rate_limit_enabled", False)

    from backend.main import rate_limit_followup
    original_limit = rate_limit_followup.requests_per_minute
    rate_limit_followup.requests_per_minute = 1

    client = TestClient(app)
    payload = {
        "invoice_id": "INV-RL-02",
        "customer_name": "Bypass Test",
        "invoice_amount": 1000.0,
        "tone": "gentle",
    }

    try:
        # Should allow multiple requests without 429
        res1 = client.post("/api/v1/followups/draft", json=payload)
        assert res1.status_code == 200
        res2 = client.post("/api/v1/followups/draft", json=payload)
        assert res2.status_code == 200
    finally:
        rate_limit_followup.requests_per_minute = original_limit
        limiter.reset()


def test_get_client_ip_prioritizes_cf_connecting_ip():
    """Verify that Cloudflare's CF-Connecting-IP takes precedence over client-supplied headers."""
    # Dummy request with both CF-Connecting-IP and spoofed X-Forwarded-For
    scope = {
        "type": "http",
        "headers": [
            (b"cf-connecting-ip", b"203.0.113.195"),
            (b"x-forwarded-for", b"10.0.0.1, 10.0.0.2"),
            (b"x-real-ip", b"10.0.0.3"),
        ],
        "client": ("127.0.0.1", 50000),
    }
    request = Request(scope)
    resolved_ip = get_client_ip(request)
    assert resolved_ip == "203.0.113.195"


def test_get_client_ip_prevents_x_forwarded_for_spoofing():
    """Verify that when behind a reverse proxy, the proxy-appended rightmost IP is selected."""
    # Attacker injects 1.2.3.4, proxy appends real client IP 198.51.100.42
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"1.2.3.4, 198.51.100.42"),
        ],
        "client": ("10.0.0.5", 50000),
    }
    request = Request(scope)
    resolved_ip = get_client_ip(request)
    assert resolved_ip == "198.51.100.42"


def test_get_client_ip_filters_malformed_ips():
    """Verify that malformed or malicious non-IP header strings are discarded."""
    scope = {
        "type": "http",
        "headers": [
            (b"cf-connecting-ip", b"not-an-ip-address"),
            (b"x-forwarded-for", b"<script>alert(1)</script>, 192.168.1.100"),
        ],
        "client": ("127.0.0.1", 50000),
    }
    request = Request(scope)
    resolved_ip = get_client_ip(request)
    assert resolved_ip == "192.168.1.100"


def test_rate_limiter_blocks_spoofed_x_forwarded_for_bypass(monkeypatch):
    """End-to-end test: an attacker rotating leftmost X-Forwarded-For cannot bypass rate limits."""
    limiter.reset()
    monkeypatch.setattr(settings, "rate_limit_enabled", True)

    from backend.main import rate_limit_followup
    original_limit = rate_limit_followup.requests_per_minute
    rate_limit_followup.requests_per_minute = 2

    client = TestClient(app)
    payload = {
        "invoice_id": "INV-RL-SPOOF",
        "customer_name": "Spoof Test",
        "invoice_amount": 1000.0,
        "tone": "gentle",
    }

    real_ip = "198.51.100.88"

    try:
        # Request 1: Attacker sends fake IP 10.0.0.1, proxy appends 198.51.100.88
        res1 = client.post(
            "/api/v1/followups/draft",
            json=payload,
            headers={"X-Forwarded-For": f"10.0.0.1, {real_ip}"},
        )
        assert res1.status_code == 200

        # Request 2: Attacker attempts bypass by changing fake IP to 10.0.0.2
        res2 = client.post(
            "/api/v1/followups/draft",
            json=payload,
            headers={"X-Forwarded-For": f"10.0.0.2, {real_ip}"},
        )
        assert res2.status_code == 200

        # Request 3: Attacker attempts bypass by changing fake IP to 10.0.0.3 -> MUST be blocked!
        res3 = client.post(
            "/api/v1/followups/draft",
            json=payload,
            headers={"X-Forwarded-For": f"10.0.0.3, {real_ip}"},
        )
        assert res3.status_code == 429
        assert res3.json()["detail"]["error_type"] == "ClientRateLimitError"
    finally:
        rate_limit_followup.requests_per_minute = original_limit
        limiter.reset()

