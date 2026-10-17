"""Smoke integration test with live Prior Labs TabPFN cloud API (optional)."""

import os
from pathlib import Path
import pytest

from backend.data_validator import load_and_validate_csv
from backend.ml_engine import analyze_ledger
from backend.model_provider import HostedTabPFNProvider
from backend.config import settings

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_live_tabpfn_cloud_inference():
    """Execute live cloud inference against Prior Labs TabPFN API if TABPFN_TOKEN is configured."""
    token = os.getenv("TABPFN_TOKEN") or settings.tabpfn_token
    if not token or token.strip() == "" or token == "your_tabpfn_api_token_here":
        pytest.skip(
            "TABPFN_TOKEN is not set or contains placeholder. "
            "To test live cloud inference, obtain an API key from https://platform.priorlabs.ai/account/api-keys "
            "and set TABPFN_TOKEN in your environment or .env file."
        )

    # Initialize live hosted provider
    hosted_clf = HostedTabPFNProvider(token=token.strip())
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    
    # Run analysis with live provider
    result = analyze_ledger(df, classifier=hosted_clf, is_synthetic=True)

    assert result.metadata["model_provider"] == "Prior Labs Hosted TabPFN API"
    assert len(result.predictions) == 6
    for pred in result.predictions:
        assert 0.0 <= pred.late_probability <= 1.0
        assert pred.risk_tier in {"low", "medium", "high"}
