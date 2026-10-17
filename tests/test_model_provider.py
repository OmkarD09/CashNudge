"""Unit tests for TabPFN provider adapters, credential errors, and mock inference."""

import os
import pytest
import pandas as pd
import numpy as np

from backend.config import TabPFNConfigurationError, Settings
from backend.model_provider import (
    HostedTabPFNProvider,
    MockTabPFNProvider,
    get_risk_classifier,
)
from backend.feature_extractor import extract_features_and_targets
from backend.data_validator import load_and_validate_csv
from pathlib import Path

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_hosted_provider_missing_credentials_raises_clean_error():
    """Verify that HostedTabPFNProvider raises TabPFNConfigurationError when token is missing or placeholder."""
    # Ensure TABPFN_TOKEN is temporarily unset in env
    orig_token = os.environ.get("TABPFN_TOKEN")
    try:
        os.environ["TABPFN_TOKEN"] = ""
        with pytest.raises(TabPFNConfigurationError) as exc_info:
            HostedTabPFNProvider(token="")
        assert "Missing Prior Labs TabPFN access token" in str(exc_info.value)
    finally:
        if orig_token is not None:
            os.environ["TABPFN_TOKEN"] = orig_token


def test_mock_provider_fits_and_predicts_valid_probabilities():
    """Verify MockTabPFNProvider fits cleanly and outputs probabilities summing to 1.0."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    X_train, y_train, X_predict, _ = extract_features_and_targets(df)

    mock_clf = MockTabPFNProvider()
    mock_clf.fit(X_train, y_train)

    probs = mock_clf.predict_proba(X_predict)
    assert probs.shape == (len(X_predict), 2)
    assert (probs >= 0.0).all() and (probs <= 1.0).all()
    # Check row sums are approximately 1.0
    np.testing.assert_allclose(probs.sum(axis=1), np.ones(len(X_predict)), atol=1e-5)


def test_mock_provider_with_precomputed_probabilities():
    """Verify MockTabPFNProvider supports precomputed probs for deterministic test scenarios."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    _, _, X_predict, _ = extract_features_and_targets(df)

    n_rows = len(X_predict)
    expected_probs = [0.10, 0.45, 0.85, 0.20, 0.60, 0.90]
    mock_clf = MockTabPFNProvider(precomputed_probs=expected_probs[:n_rows])
    
    probs = mock_clf.predict_proba(X_predict)
    assert len(probs) == n_rows
    np.testing.assert_allclose(probs[:, 1], expected_probs[:n_rows])
    np.testing.assert_allclose(probs[:, 0], 1.0 - np.array(expected_probs[:n_rows]))


def test_factory_returns_mock_when_no_token_present():
    """Verify get_risk_classifier defaults to MockTabPFNProvider when no credentials are configured."""
    orig_token = os.environ.get("TABPFN_TOKEN")
    try:
        os.environ["TABPFN_TOKEN"] = ""
        clf = get_risk_classifier()
        assert isinstance(clf, MockTabPFNProvider)
    finally:
        if orig_token is not None:
            os.environ["TABPFN_TOKEN"] = orig_token
