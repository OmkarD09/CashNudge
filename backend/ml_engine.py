"""Core machine learning risk analysis engine for CashNudge."""

from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd

from backend.config import settings, Settings
from backend.schemas import (
    InvoiceStatus,
    RiskTier,
    InvoicePrediction,
    LedgerCashFlowSummary,
    LedgerAnalysisResult,
)
from backend.data_validator import validate_invoice_dataframe, InvoiceValidationError
from backend.feature_extractor import extract_features_and_targets, get_feature_metadata
from backend.model_provider import BaseRiskClassifier, get_risk_classifier
from backend.date_utils import compute_invoice_date_facts, get_synthetic_demo_due_date


class InsufficientHistoricalDataError(ValueError):
    """Raised when the ledger does not contain enough historical records to train."""
    pass


class InsufficientClassDiversityError(ValueError):
    """Raised when historical records contain only one payment outcome class."""
    pass


def _derive_risk_factors(
    row: pd.Series,
    prob: float,
    median_hist_amount: float
) -> List[str]:
    """Derive transparent, human-readable explanatory indicators for late payment risk."""
    factors: List[str] = []

    past_late = int(row.get("past_late_count", 0))
    if past_late >= 2:
        factors.append(f"Client history shows {past_late} prior late payments")
    elif past_late == 1:
        factors.append("Client history shows 1 prior late payment")
    else:
        factors.append("Client has a clean payment history (0 past late payments)")

    terms = int(row.get("payment_terms_days", 30))
    if terms >= 45:
        factors.append(f"Long contractual terms ({terms} days) heighten payment latency risk")
    elif terms <= 14:
        factors.append(f"Short contractual terms ({terms} days) enforce rapid turnaround")

    revisions = int(row.get("revision_count", 0))
    if revisions >= 3:
        factors.append(f"High scope volatility ({revisions} revisions) correlated with approval delays")

    amt = float(row.get("invoice_amount", 0.0))
    if median_hist_amount > 0 and amt >= median_hist_amount * 1.5:
        factors.append(f"Invoice amount (${amt:,.2f}) significantly exceeds historical median (${median_hist_amount:,.2f})")

    tier = str(row.get("client_tier", "")).strip()
    if tier.lower() in {"seed-startup", "early-stage", "individual", "solo-founder"}:
        factors.append(f"Client tier ({tier}) has higher runway and cash-flow sensitivity")
    elif tier.lower() in {"enterprise", "corporate"}:
        factors.append(f"Client tier ({tier}) typically requires multi-stage accounts payable cycles")

    return factors


def assign_risk_tier(prob: float, threshold_low: float, threshold_high: float) -> RiskTier:
    """Map probability of late payment to an interpretable categorical risk tier."""
    if prob < threshold_low:
        return RiskTier.LOW
    elif prob < threshold_high:
        return RiskTier.MEDIUM
    else:
        return RiskTier.HIGH


def analyze_ledger(
    df: pd.DataFrame,
    classifier: Optional[BaseRiskClassifier] = None,
    cfg: Optional[Settings] = None,
    is_synthetic: bool = False,
    reference_date: Optional[Any] = None,
) -> LedgerAnalysisResult:
    """Analyze an invoice ledger, fit TabPFN on historical paid invoices, and estimate risk for open invoices.
    
    Args:
        df: Input DataFrame conforming to CashNudge schema.
        classifier: Optional risk classifier instance (defaults to auto-detected provider).
        cfg: Optional Settings override.
        is_synthetic: Flag indicating whether input data is from a synthetic benchmark.
        reference_date: Optional explicit reference date for deterministic overdue calculations.
    
    Returns:
        LedgerAnalysisResult containing deterministic cash flow summary and model-stratified predictions.
    """
    app_settings = cfg or settings
    
    # 1. Schema Validation
    clean_df, errors = validate_invoice_dataframe(df)
    if errors:
        raise InvoiceValidationError("Ledger validation failed.", errors=errors)

    # 2. Partition historical vs outstanding
    hist_mask = clean_df["status"].isin([InvoiceStatus.PAID_ON_TIME.value, InvoiceStatus.PAID_LATE.value])
    open_mask = clean_df["status"] == InvoiceStatus.OPEN.value

    df_hist = clean_df[hist_mask]
    df_open = clean_df[open_mask]

    hist_count = len(df_hist)
    open_count = len(df_open)

    # 3. Check historical data requirements
    if hist_count < app_settings.min_historical_samples:
        raise InsufficientHistoricalDataError(
            f"Insufficient historical data: ledger contains {hist_count} historical paid invoice(s), "
            f"but at least {app_settings.min_historical_samples} are required to reliably train the risk model."
        )

    hist_on_time = int((df_hist["status"] == InvoiceStatus.PAID_ON_TIME.value).sum())
    hist_late = int((df_hist["status"] == InvoiceStatus.PAID_LATE.value).sum())

    if hist_on_time == 0 or hist_late == 0:
        raise InsufficientClassDiversityError(
            f"Historical payment data must contain both on-time and late outcomes to train binary risk classifier. "
            f"Current distribution: {hist_on_time} on-time, {hist_late} late."
        )

    # 4. Feature Extraction & Privacy Isolation
    X_train, y_train, X_predict, open_meta = extract_features_and_targets(clean_df)

    # 5. Model Inference on Outstanding Invoices
    predictions: List[InvoicePrediction] = []
    clf = classifier or get_risk_classifier()

    median_amount = float(df_hist["invoice_amount"].median()) if not df_hist.empty else 0.0

    if open_count > 0:
        # Fit classifier on historical outcomes
        clf.fit(X_train, y_train)
        
        # Predict class probabilities: column 1 is probability of late payment
        probs = clf.predict_proba(X_predict)
        if probs.shape[1] >= 2:
            late_probs = probs[:, 1]
        else:
            late_probs = probs[:, 0]

        # Ensure probabilities are bounded in [0.0, 1.0]
        late_probs = np.clip(late_probs, 0.0, 1.0)

        for i, (orig_idx, meta_row) in enumerate(open_meta.iterrows()):
            prob = float(round(late_probs[i], 4))
            tier = assign_risk_tier(
                prob,
                threshold_low=app_settings.risk_threshold_low,
                threshold_high=app_settings.risk_threshold_high,
            )
            raw_row = df_open.loc[orig_idx]
            factors = _derive_risk_factors(raw_row, prob, median_amount)

            inv_id = str(meta_row["invoice_id"])
            raw_due = raw_row.get("due_date") if "due_date" in raw_row else None
            if pd.notna(raw_due) and str(raw_due).strip():
                due_val = str(raw_due).strip()
            elif is_synthetic:
                due_val = get_synthetic_demo_due_date(inv_id, reference_date=reference_date)
            else:
                due_val = None

            date_facts = compute_invoice_date_facts(
                due_date=due_val,
                reference_date=reference_date,
            )

            predictions.append(
                InvoicePrediction(
                    invoice_id=inv_id,
                    client_name=str(meta_row["client_name"]),
                    invoice_amount=float(meta_row["invoice_amount"]),
                    payment_terms_days=int(meta_row["payment_terms_days"]),
                    late_probability=prob,
                    risk_tier=tier,
                    top_risk_factors=factors,
                    due_date=date_facts.due_date,
                    days_overdue=date_facts.days_overdue,
                    due_status=date_facts.status,
                )
            )


    # 6. Calculate Deterministic and Risk-Stratified Cash-Flow Metrics
    total_outstanding = float(df_open["invoice_amount"].sum()) if open_count > 0 else 0.0
    
    high_risk_amount = sum(p.invoice_amount for p in predictions if p.risk_tier == RiskTier.HIGH)
    medium_risk_amount = sum(p.invoice_amount for p in predictions if p.risk_tier == RiskTier.MEDIUM)
    low_risk_amount = sum(p.invoice_amount for p in predictions if p.risk_tier == RiskTier.LOW)
    at_risk_amount = high_risk_amount + medium_risk_amount

    late_rate = float(round(hist_late / hist_count, 4)) if hist_count > 0 else 0.0

    summary = LedgerCashFlowSummary(
        total_invoices=len(clean_df),
        historical_invoices_count=hist_count,
        historical_on_time_count=hist_on_time,
        historical_late_count=hist_late,
        historical_late_rate=late_rate,
        outstanding_invoices_count=open_count,
        total_outstanding_amount=round(total_outstanding, 2),
        at_risk_amount=round(at_risk_amount, 2),
        high_risk_amount=round(high_risk_amount, 2),
        medium_risk_amount=round(medium_risk_amount, 2),
        low_risk_amount=round(low_risk_amount, 2),
    )

    metadata: Dict[str, Any] = {
        "model_provider": clf.provider_name,
        "is_synthetic_data": is_synthetic,
        "risk_thresholds": {
            "low": app_settings.risk_threshold_low,
            "high": app_settings.risk_threshold_high,
        },
        "privacy_guarantee": (
            "Direct identifiers ('client_name', 'invoice_id') are stripped locally "
            "and never transmitted to external cloud inference APIs."
        ),
        "limitations": (
            "TabPFN estimations are probabilistic prior-data approximations based on historical "
            "invoice features. They do not constitute financial guarantees or debt collection advice."
        ),
        "feature_schema": get_feature_metadata(),
    }

    return LedgerAnalysisResult(
        summary=summary,
        predictions=predictions,
        metadata=metadata,
    )
