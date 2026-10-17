"""Unit tests for the CashNudge ML risk analysis engine and cash-flow aggregations."""

from pathlib import Path
import pytest
import pandas as pd
import numpy as np

from backend.schemas import RiskTier, InvoiceStatus
from backend.data_validator import load_and_validate_csv
from backend.ml_engine import (
    analyze_ledger,
    assign_risk_tier,
    InsufficientHistoricalDataError,
    InsufficientClassDiversityError,
)
from backend.model_provider import MockTabPFNProvider
from backend.config import Settings

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_analyze_ledger_end_to_end_on_synthetic_data():
    """Verify complete analysis pipeline on synthetic ledger using calibrated mock provider."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    result = analyze_ledger(df, is_synthetic=True)

    # 1. Verify summary counts
    assert result.summary.total_invoices == 24
    assert result.summary.historical_invoices_count == 18
    assert result.summary.outstanding_invoices_count == 6
    assert result.summary.historical_on_time_count == 11
    assert result.summary.historical_late_count == 7
    assert result.summary.historical_late_rate == round(7 / 18, 4)

    # 2. Verify deterministic cash-flow totals
    expected_open_sum = round(float(df[df["status"] == "open"]["invoice_amount"].sum()), 2)
    assert result.summary.total_outstanding_amount == expected_open_sum

    # 3. Verify risk-stratified cash-flow reconciles to total outstanding
    stratified_sum = round(
        result.summary.low_risk_amount + result.summary.medium_risk_amount + result.summary.high_risk_amount,
        2
    )
    assert stratified_sum == result.summary.total_outstanding_amount
    assert result.summary.at_risk_amount == round(
        result.summary.medium_risk_amount + result.summary.high_risk_amount, 2
    )

    # 4. Verify prediction structure and bounds
    assert len(result.predictions) == 6
    for pred in result.predictions:
        assert pred.invoice_id.startswith("INV-")
        assert len(pred.client_name) > 0
        assert pred.invoice_amount > 0
        assert pred.payment_terms_days > 0
        assert 0.0 <= pred.late_probability <= 1.0
        assert pred.risk_tier in {RiskTier.LOW, RiskTier.MEDIUM, RiskTier.HIGH}
        assert isinstance(pred.top_risk_factors, list)
        assert len(pred.top_risk_factors) >= 1

    # 5. Verify metadata transparency
    assert result.metadata["is_synthetic_data"] is True
    assert "privacy_guarantee" in result.metadata
    assert "limitations" in result.metadata


def test_risk_tier_assignment_boundaries():
    """Verify exact boundary behavior for risk tier classifications."""
    low_thresh = 0.35
    high_thresh = 0.70

    assert assign_risk_tier(0.00, low_thresh, high_thresh) == RiskTier.LOW
    assert assign_risk_tier(0.3499, low_thresh, high_thresh) == RiskTier.LOW
    assert assign_risk_tier(0.35, low_thresh, high_thresh) == RiskTier.MEDIUM
    assert assign_risk_tier(0.50, low_thresh, high_thresh) == RiskTier.MEDIUM
    assert assign_risk_tier(0.6999, low_thresh, high_thresh) == RiskTier.MEDIUM
    assert assign_risk_tier(0.70, low_thresh, high_thresh) == RiskTier.HIGH
    assert assign_risk_tier(0.99, low_thresh, high_thresh) == RiskTier.HIGH
    assert assign_risk_tier(1.00, low_thresh, high_thresh) == RiskTier.HIGH


def test_deterministic_predictions_with_mock_probabilities():
    """Verify tier assignment and amounts when given controlled mock probabilities."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Open invoices: 6 invoices. Assign: [0.10, 0.40, 0.85, 0.20, 0.55, 0.90]
    # Corresponding tiers: [LOW, MEDIUM, HIGH, LOW, MEDIUM, HIGH]
    controlled_probs = [0.10, 0.40, 0.85, 0.20, 0.55, 0.90]
    clf = MockTabPFNProvider(precomputed_probs=controlled_probs)

    result = analyze_ledger(df, classifier=clf)

    tiers = [p.risk_tier for p in result.predictions]
    assert tiers == [
        RiskTier.LOW,
        RiskTier.MEDIUM,
        RiskTier.HIGH,
        RiskTier.LOW,
        RiskTier.MEDIUM,
        RiskTier.HIGH,
    ]

    open_df = df[df["status"] == "open"].reset_index(drop=True)
    expected_low = open_df.loc[[0, 3], "invoice_amount"].sum()
    expected_med = open_df.loc[[1, 4], "invoice_amount"].sum()
    expected_high = open_df.loc[[2, 5], "invoice_amount"].sum()

    assert result.summary.low_risk_amount == round(expected_low, 2)
    assert result.summary.medium_risk_amount == round(expected_med, 2)
    assert result.summary.high_risk_amount == round(expected_high, 2)
    assert result.summary.at_risk_amount == round(expected_med + expected_high, 2)


def test_insufficient_historical_rows_raises_error():
    """Verify error is raised when historical paid records are fewer than min_historical_samples."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Keep only 3 historical rows and 2 open rows
    hist_subset = df[df["status"] != "open"].head(3)
    open_subset = df[df["status"] == "open"].head(2)
    small_df = pd.concat([hist_subset, open_subset], ignore_index=True)

    with pytest.raises(InsufficientHistoricalDataError) as exc_info:
        analyze_ledger(small_df)
    assert "Insufficient historical data" in str(exc_info.value)


def test_insufficient_class_diversity_all_on_time():
    """Verify error is raised when historical data has no late outcomes (only on-time)."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Convert all historical to paid_on_time
    df.loc[df["status"] == "paid_late", "status"] = "paid_on_time"

    with pytest.raises(InsufficientClassDiversityError) as exc_info:
        analyze_ledger(df)
    assert "must contain both on-time and late outcomes" in str(exc_info.value)


def test_insufficient_class_diversity_all_late():
    """Verify error is raised when historical data has no on-time outcomes (only late)."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Convert all historical to paid_late
    df.loc[df["status"] == "paid_on_time", "status"] = "paid_late"

    with pytest.raises(InsufficientClassDiversityError) as exc_info:
        analyze_ledger(df)
    assert "must contain both on-time and late outcomes" in str(exc_info.value)


def test_empty_outstanding_invoices_returns_gracefully():
    """Verify pipeline handles an empty set of outstanding invoices gracefully."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Filter out all open invoices
    historical_only_df = df[df["status"] != "open"].copy()

    result = analyze_ledger(historical_only_df)
    assert result.summary.outstanding_invoices_count == 0
    assert result.summary.total_outstanding_amount == 0.0
    assert result.summary.at_risk_amount == 0.0
    assert result.summary.high_risk_amount == 0.0
    assert result.summary.medium_risk_amount == 0.0
    assert result.summary.low_risk_amount == 0.0
    assert result.predictions == []
    assert result.summary.historical_invoices_count == len(historical_only_df)
