"""Feature extraction and privacy isolation for CashNudge Risk Engine."""

from typing import Tuple, List, Dict, Any
import pandas as pd
import numpy as np

from backend.schemas import InvoiceStatus


PREDICTIVE_FEATURES: List[str] = [
    "project_category",
    "client_tier",
    "invoice_amount",
    "payment_terms_days",
    "revision_count",
    "past_late_count",
]

CATEGORICAL_FEATURES: List[str] = [
    "project_category",
    "client_tier",
]

NUMERICAL_FEATURES: List[str] = [
    "invoice_amount",
    "payment_terms_days",
    "revision_count",
    "past_late_count",
]

EXCLUDED_COLUMNS: List[str] = [
    "invoice_id",         # Transaction identifier (prevents non-generalizing memorization)
    "client_name",        # Direct customer identifier / PII (privacy & leak prevention)
    "status",             # Current status (target leakage)
    "actual_days_to_pay", # Post-hoc realized duration (leakage)
    "due_date",           # External date field (excluded from TabPFN tabular vector)
]


class FeatureLeakageError(ValueError):
    """Raised if an identifier, customer name, or outcome column leaks into the feature matrix."""
    pass


def extract_features_and_targets(
    df: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.DataFrame]:
    """Partition validated invoice DataFrame into training and prediction sets.
    
    Returns:
        X_train: Predictive features for historical paid invoices (no PII or outcome leakage).
        y_train: Binary labels for historical invoices (1 = paid_late, 0 = paid_on_time).
        X_predict: Predictive features for outstanding open invoices.
        open_invoices_meta: Metadata for open invoices (invoice_id, client_name, invoice_amount, payment_terms_days)
                            preserved purely for UI output mapping.
    """
    # 1. Partition historical vs outstanding
    historical_mask = df["status"].isin([InvoiceStatus.PAID_ON_TIME.value, InvoiceStatus.PAID_LATE.value])
    open_mask = df["status"] == InvoiceStatus.OPEN.value

    df_hist = df[historical_mask].copy()
    df_open = df[open_mask].copy()

    # 2. Construct binary target: 1 if paid_late, 0 if paid_on_time
    y_train = (df_hist["status"] == InvoiceStatus.PAID_LATE.value).astype(int)

    # 3. Build feature matrices strictly restricted to PREDICTIVE_FEATURES
    X_train = df_hist[PREDICTIVE_FEATURES].copy()
    X_predict = df_open[PREDICTIVE_FEATURES].copy()

    # 4. Strictly audit against any leakage or PII inclusion
    for forbidden in EXCLUDED_COLUMNS:
        if forbidden in X_train.columns:
            raise FeatureLeakageError(
                f"Privacy/Leakage violation: '{forbidden}' found in training feature matrix!"
            )
        if forbidden in X_predict.columns:
            raise FeatureLeakageError(
                f"Privacy/Leakage violation: '{forbidden}' found in prediction feature matrix!"
            )

    # 5. Format categorical features as category dtypes for TabPFN
    for cat_col in CATEGORICAL_FEATURES:
        X_train[cat_col] = X_train[cat_col].astype("category")
        X_predict[cat_col] = X_predict[cat_col].astype("category")

    # 6. Preserve open invoice metadata for final reporting
    open_meta_cols = ["invoice_id", "client_name", "invoice_amount", "payment_terms_days"]
    if "due_date" in df_open.columns:
        open_meta_cols.append("due_date")
    open_invoices_meta = df_open[open_meta_cols].copy()

    return X_train, y_train, X_predict, open_invoices_meta


def get_feature_metadata() -> Dict[str, Any]:
    """Return schema information on features and privacy guarantees."""
    return {
        "predictive_features": PREDICTIVE_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numerical_features": NUMERICAL_FEATURES,
        "excluded_columns": EXCLUDED_COLUMNS,
        "pii_transmitted_to_cloud": False,
        "direct_identifiers_transmitted": False,
    }
