"""Unit tests for feature selection, privacy isolation, and outcome leakage prevention."""

from pathlib import Path
import pytest
import pandas as pd

from backend.data_validator import load_and_validate_csv
from backend.feature_extractor import (
    PREDICTIVE_FEATURES,
    EXCLUDED_COLUMNS,
    extract_features_and_targets,
    FeatureLeakageError,
)

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_feature_selection_excludes_all_forbidden_columns():
    """Verify that invoice_id, client_name, status, and actual_days_to_pay are strictly absent from model features."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    X_train, y_train, X_predict, open_meta = extract_features_and_targets(df)

    # Check X_train
    for forbidden in EXCLUDED_COLUMNS:
        assert forbidden not in X_train.columns, f"Leaked forbidden column '{forbidden}' in X_train"
        assert forbidden not in X_predict.columns, f"Leaked forbidden column '{forbidden}' in X_predict"

    # Check exact matching of feature columns
    assert list(X_train.columns) == PREDICTIVE_FEATURES
    assert list(X_predict.columns) == PREDICTIVE_FEATURES


def test_client_name_and_identifiers_isolated_to_meta_only():
    """Verify client_name and invoice_id are only present in UI metadata."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    _, _, _, open_meta = extract_features_and_targets(df)

    assert "client_name" in open_meta.columns
    assert "invoice_id" in open_meta.columns
    assert len(open_meta) == (df["status"] == "open").sum()


def test_target_vector_is_binary_and_aligned():
    """Verify target vector y is strictly 0 and 1, matching paid_late status."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    X_train, y_train, _, _ = extract_features_and_targets(df)

    assert len(X_train) == len(y_train)
    assert set(y_train.unique()).issubset({0, 1})
    assert (y_train == 1).sum() == (df["status"] == "paid_late").sum()
    assert (y_train == 0).sum() == (df["status"] == "paid_on_time").sum()


def test_leakage_assertion_triggers_if_forbidden_column_injected():
    """Verify that an intentional attempt to include client_name raises FeatureLeakageError."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Monkey-patch PREDICTIVE_FEATURES temporarily to test safety barrier
    from backend import feature_extractor
    original_features = feature_extractor.PREDICTIVE_FEATURES
    try:
        feature_extractor.PREDICTIVE_FEATURES = original_features + ["client_name"]
        with pytest.raises(FeatureLeakageError) as exc_info:
            extract_features_and_targets(df)
        assert "Privacy/Leakage violation" in str(exc_info.value)
    finally:
        feature_extractor.PREDICTIVE_FEATURES = original_features
