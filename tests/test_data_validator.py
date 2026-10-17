"""Unit tests for invoice data validation and schema integrity."""

import io
from pathlib import Path
import pytest
import pandas as pd

from backend.data_validator import (
    REQUIRED_COLUMNS,
    InvoiceValidationError,
    validate_invoice_dataframe,
    load_and_validate_csv,
)

SAMPLE_CSV_PATH = Path(__file__).resolve().parent.parent / "backend" / "sample_data" / "synthetic_freelancer_invoices.csv"


def test_valid_synthetic_csv_loads_cleanly():
    """Verify that the official synthetic sample dataset passes all validation rules."""
    assert SAMPLE_CSV_PATH.exists(), f"Sample dataset missing at {SAMPLE_CSV_PATH}"
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    assert not df.empty
    assert len(df) == 24
    assert set(REQUIRED_COLUMNS).issubset(df.columns)
    assert (df["invoice_amount"] > 0).all()
    assert (df["payment_terms_days"] > 0).all()


def test_empty_dataframe_raises_validation_error():
    """Verify empty DataFrame triggers an explicit schema error."""
    df_empty = pd.DataFrame()
    _, errors = validate_invoice_dataframe(df_empty)
    assert len(errors) == 1
    assert errors[0].error_type == "EMPTY_DATASET"

    # Also verify load_and_validate_csv raises InvoiceValidationError on empty CSV content
    with pytest.raises(InvoiceValidationError) as exc_info:
        load_and_validate_csv(io.StringIO(""))
    err_types = [e.error_type for e in exc_info.value.errors]
    assert "EMPTY_DATASET" in err_types or "CSV_PARSE_ERROR" in err_types


def test_missing_required_columns():
    """Verify missing required columns are detected with specific column names."""
    df_missing = pd.DataFrame({
        "invoice_id": ["INV-001"],
        "client_name": ["Client A"],
        "invoice_amount": [1000.0],
    })
    _, errors = validate_invoice_dataframe(df_missing)
    assert len(errors) == 1
    assert errors[0].error_type == "MISSING_COLUMNS"
    assert "payment_terms_days" in errors[0].message
    assert "status" in errors[0].message


def test_duplicate_invoice_identifiers():
    """Verify duplicate invoice IDs are flagged."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # Introduce duplicate
    df.loc[1, "invoice_id"] = df.loc[0, "invoice_id"]
    _, errors = validate_invoice_dataframe(df)
    dup_errors = [e for e in errors if e.error_type == "DUPLICATE_INVOICE_ID"]
    assert len(dup_errors) >= 2


def test_malformed_amounts_never_silently_converted_to_zero():
    """Verify non-numeric or malformed invoice amounts trigger errors and are never coerced to zero."""
    invalid_amounts = ["invalid_text", "-500.00", "0", "$1,500.00", "NaN", "   "]
    for bad_amt in invalid_amounts:
        df = load_and_validate_csv(SAMPLE_CSV_PATH)
        df.loc[0, "invoice_amount"] = bad_amt
        _, errors = validate_invoice_dataframe(df)
        amt_errors = [e for e in errors if e.error_type == "INVALID_AMOUNT"]
        assert len(amt_errors) >= 1, f"Expected INVALID_AMOUNT for input: {bad_amt}"


def test_unsupported_statuses():
    """Verify non-supported statuses (e.g., 'draft', 'cancelled') trigger validation errors."""
    unsupported = ["draft", "cancelled", "void", "pending", "in_dispute"]
    for bad_status in unsupported:
        df = load_and_validate_csv(SAMPLE_CSV_PATH)
        df.loc[0, "status"] = bad_status
        _, errors = validate_invoice_dataframe(df)
        status_errors = [e for e in errors if e.error_type == "UNSUPPORTED_STATUS"]
        assert len(status_errors) >= 1, f"Expected UNSUPPORTED_STATUS for status: {bad_status}"


def test_paid_invoice_missing_actual_days_to_pay():
    """Verify historical paid invoices require actual_days_to_pay."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    df.loc[0, "status"] = "paid_on_time"
    df.loc[0, "actual_days_to_pay"] = None
    _, errors = validate_invoice_dataframe(df)
    missing_day_errors = [e for e in errors if e.error_type == "MISSING_ACTUAL_DAYS"]
    assert len(missing_day_errors) >= 1


def test_open_invoice_permits_blank_actual_days():
    """Verify open invoices can leave actual_days_to_pay blank without error."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    # All open invoices in sample dataset have blank actual_days_to_pay
    open_invoices = df[df["status"] == "open"]
    assert len(open_invoices) > 0
    _, errors = validate_invoice_dataframe(df)
    assert len(errors) == 0


def test_invalid_payment_terms_and_revision_counts():
    """Verify negative or non-integer terms and counts fail validation."""
    df = load_and_validate_csv(SAMPLE_CSV_PATH)
    df.loc[0, "payment_terms_days"] = -15
    df.loc[1, "revision_count"] = -1
    df.loc[2, "past_late_count"] = -3
    _, errors = validate_invoice_dataframe(df)
    err_types = {e.error_type for e in errors}
    assert "INVALID_PAYMENT_TERMS" in err_types
    assert "INVALID_REVISION_COUNT" in err_types
    assert "INVALID_PAST_LATE_COUNT" in err_types
