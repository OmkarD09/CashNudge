"""Invoice data loader and strict schema validator for CashNudge."""

import io
from pathlib import Path
from typing import List, Union, Tuple, Set
import pandas as pd
import numpy as np

from backend.schemas import ValidationErrorDetail, InvoiceStatus


REQUIRED_COLUMNS = [
    "invoice_id",
    "client_name",
    "project_category",
    "client_tier",
    "invoice_amount",
    "payment_terms_days",
    "revision_count",
    "past_late_count",
    "status",
    "actual_days_to_pay",
]

SUPPORTED_HISTORICAL_STATUSES = {
    InvoiceStatus.PAID_ON_TIME.value,
    InvoiceStatus.PAID_LATE.value,
}
SUPPORTED_OUTSTANDING_STATUSES = {
    InvoiceStatus.OPEN.value,
}
ALL_SUPPORTED_STATUSES = SUPPORTED_HISTORICAL_STATUSES | SUPPORTED_OUTSTANDING_STATUSES


class InvoiceValidationError(ValueError):
    """Raised when one or more rows fail invoice schema validation."""

    def __init__(self, message: str, errors: List[ValidationErrorDetail]):
        super().__init__(message)
        self.errors = errors

    def __str__(self) -> str:
        error_lines = [f"Validation failed with {len(self.errors)} error(s):"]
        for err in self.errors[:10]:
            row_info = f"Row {err.row_index} " if err.row_index is not None else ""
            inv_info = f"[{err.invoice_id}] " if err.invoice_id else ""
            error_lines.append(f"  - {row_info}{inv_info}Column '{err.column}': {err.message} ({err.error_type})")
        if len(self.errors) > 10:
            error_lines.append(f"  ... and {len(self.errors) - 10} more error(s)")
        return "\n".join(error_lines)


def validate_invoice_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[ValidationErrorDetail]]:
    """Strictly validate an invoice DataFrame against the CashNudge schema.
    
    Returns:
        Tuple of (clean_validated_df, list_of_errors).
        If list_of_errors is non-empty, clean_validated_df should not be used for modeling.
    """
    errors: List[ValidationErrorDetail] = []

    if df is None or df.empty:
        errors.append(
            ValidationErrorDetail(
                column="__schema__",
                error_type="EMPTY_DATASET",
                message="Invoice ledger is empty. At least one invoice row is required.",
            )
        )
        return df, errors

    # 1. Check for missing required columns
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(
            ValidationErrorDetail(
                column="__schema__",
                error_type="MISSING_COLUMNS",
                message=f"Missing required columns: {', '.join(missing_cols)}",
            )
        )
        return df, errors

    # Work with a copy and preserve string representation for validation
    df_clean = df.copy()

    # 2. Duplicate invoice identifiers check
    # Strip whitespace if string
    invoice_ids = df_clean["invoice_id"].astype(str).str.strip()
    duplicates = df_clean[invoice_ids.duplicated(keep=False)]
    if not duplicates.empty:
        for idx, row in duplicates.iterrows():
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=str(row["invoice_id"]),
                    column="invoice_id",
                    error_type="DUPLICATE_INVOICE_ID",
                    message=f"Duplicate invoice_id '{row['invoice_id']}' detected.",
                )
            )

    # 3. Row-by-row field validation
    for idx, row in df_clean.iterrows():
        inv_id_raw = str(row["invoice_id"]).strip() if pd.notna(row["invoice_id"]) else ""
        inv_id_display = inv_id_raw or None

        # invoice_id empty check
        if not inv_id_raw or inv_id_raw.lower() in {"nan", "none", "null"}:
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=None,
                    column="invoice_id",
                    error_type="EMPTY_IDENTIFIER",
                    message="invoice_id cannot be null or empty.",
                )
            )

        # client_name check
        client_name = str(row["client_name"]).strip() if pd.notna(row["client_name"]) else ""
        if not client_name or client_name.lower() in {"nan", "none", "null"}:
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="client_name",
                    error_type="EMPTY_CLIENT_NAME",
                    message="client_name cannot be null or empty.",
                )
            )

        # project_category check
        category = str(row["project_category"]).strip() if pd.notna(row["project_category"]) else ""
        if not category or category.lower() in {"nan", "none", "null"}:
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="project_category",
                    error_type="EMPTY_CATEGORY",
                    message="project_category cannot be null or empty.",
                )
            )

        # client_tier check
        tier = str(row["client_tier"]).strip() if pd.notna(row["client_tier"]) else ""
        if not tier or tier.lower() in {"nan", "none", "null"}:
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="client_tier",
                    error_type="EMPTY_CLIENT_TIER",
                    message="client_tier cannot be null or empty.",
                )
            )

        # status check
        status_val = str(row["status"]).strip().lower() if pd.notna(row["status"]) else ""
        if status_val not in ALL_SUPPORTED_STATUSES:
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="status",
                    error_type="UNSUPPORTED_STATUS",
                    message=(
                        f"Unsupported status '{row['status']}'. "
                        f"Must be one of: {', '.join(sorted(ALL_SUPPORTED_STATUSES))}."
                    ),
                )
            )

        # invoice_amount check: MUST be numeric and > 0. NEVER silently convert to zero!
        raw_amt = row["invoice_amount"]
        try:
            if pd.isna(raw_amt) or str(raw_amt).strip() == "":
                raise ValueError("Missing value")
            amt = float(raw_amt)
            if np.isnan(amt) or np.isinf(amt) or amt <= 0.0:
                errors.append(
                    ValidationErrorDetail(
                        row_index=int(idx),
                        invoice_id=inv_id_display,
                        column="invoice_amount",
                        error_type="INVALID_AMOUNT",
                        message=f"invoice_amount must be greater than zero, got {raw_amt}.",
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="invoice_amount",
                    error_type="INVALID_AMOUNT",
                    message=f"Malformed invoice_amount '{raw_amt}'. Must be a valid positive number.",
                )
            )

        # payment_terms_days check: integer > 0
        raw_terms = row["payment_terms_days"]
        try:
            if pd.isna(raw_terms) or str(raw_terms).strip() == "":
                raise ValueError("Missing value")
            terms_f = float(raw_terms)
            terms = int(terms_f)
            if terms_f != terms or terms <= 0:
                errors.append(
                    ValidationErrorDetail(
                        row_index=int(idx),
                        invoice_id=inv_id_display,
                        column="payment_terms_days",
                        error_type="INVALID_PAYMENT_TERMS",
                        message=f"payment_terms_days must be a positive integer, got {raw_terms}.",
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="payment_terms_days",
                    error_type="INVALID_PAYMENT_TERMS",
                    message=f"Malformed payment_terms_days '{raw_terms}'. Must be an integer > 0.",
                )
            )

        # revision_count check: integer >= 0
        raw_rev = row["revision_count"]
        try:
            if pd.isna(raw_rev) or str(raw_rev).strip() == "":
                raise ValueError("Missing value")
            rev_f = float(raw_rev)
            rev = int(rev_f)
            if rev_f != rev or rev < 0:
                errors.append(
                    ValidationErrorDetail(
                        row_index=int(idx),
                        invoice_id=inv_id_display,
                        column="revision_count",
                        error_type="INVALID_REVISION_COUNT",
                        message=f"revision_count must be a non-negative integer, got {raw_rev}.",
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="revision_count",
                    error_type="INVALID_REVISION_COUNT",
                    message=f"Malformed revision_count '{raw_rev}'. Must be an integer >= 0.",
                )
            )

        # past_late_count check: integer >= 0
        raw_late = row["past_late_count"]
        try:
            if pd.isna(raw_late) or str(raw_late).strip() == "":
                raise ValueError("Missing value")
            late_f = float(raw_late)
            late = int(late_f)
            if late_f != late or late < 0:
                errors.append(
                    ValidationErrorDetail(
                        row_index=int(idx),
                        invoice_id=inv_id_display,
                        column="past_late_count",
                        error_type="INVALID_PAST_LATE_COUNT",
                        message=f"past_late_count must be a non-negative integer, got {raw_late}.",
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                ValidationErrorDetail(
                    row_index=int(idx),
                    invoice_id=inv_id_display,
                    column="past_late_count",
                    error_type="INVALID_PAST_LATE_COUNT",
                    message=f"Malformed past_late_count '{raw_late}'. Must be an integer >= 0.",
                )
            )

        # actual_days_to_pay check:
        # If paid: required and >= 0. If open: may be blank/null.
        raw_days = row["actual_days_to_pay"]
        if status_val in SUPPORTED_HISTORICAL_STATUSES:
            if pd.isna(raw_days) or str(raw_days).strip() == "" or str(raw_days).strip().lower() in {"nan", "none", "null"}:
                errors.append(
                    ValidationErrorDetail(
                        row_index=int(idx),
                        invoice_id=inv_id_display,
                        column="actual_days_to_pay",
                        error_type="MISSING_ACTUAL_DAYS",
                        message=f"Paid invoice with status '{status_val}' must have actual_days_to_pay populated.",
                    )
                )
            else:
                try:
                    days_f = float(raw_days)
                    if np.isnan(days_f) or np.isinf(days_f) or days_f < 0:
                        errors.append(
                            ValidationErrorDetail(
                                row_index=int(idx),
                                invoice_id=inv_id_display,
                                column="actual_days_to_pay",
                                error_type="INVALID_ACTUAL_DAYS",
                                message=f"actual_days_to_pay must be non-negative, got {raw_days}.",
                            )
                        )
                except (ValueError, TypeError):
                    errors.append(
                        ValidationErrorDetail(
                            row_index=int(idx),
                            invoice_id=inv_id_display,
                            column="actual_days_to_pay",
                            error_type="INVALID_ACTUAL_DAYS",
                            message=f"Malformed actual_days_to_pay '{raw_days}'. Must be a number >= 0.",
                        )
                    )

        # Optional due_date check if column is present in CSV
        if "due_date" in df_clean.columns:
            raw_due = row["due_date"]
            if pd.notna(raw_due) and str(raw_due).strip() and str(raw_due).strip().lower() not in {"nan", "none", "null"}:
                from backend.date_utils import parse_date_safe
                if parse_date_safe(str(raw_due).strip()) is None:
                    errors.append(
                        ValidationErrorDetail(
                            row_index=int(idx),
                            invoice_id=inv_id_display,
                            column="due_date",
                            error_type="INVALID_DUE_DATE",
                            message=f"Malformed due_date '{raw_due}'. Must be a valid date format (e.g. YYYY-MM-DD).",
                        )
                    )

    return df_clean, errors


def normalize_and_impute_csv_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column headers and auto-impute optional columns for broad CSV compatibility."""
    if df is None or df.empty:
        return df

    df_norm = df.copy()

    # 1. Normalize column names (strip whitespace and lower-case)
    col_map = {col: str(col).strip().lower().replace(" ", "_") for col in df_norm.columns}
    df_norm.rename(columns=col_map, inplace=True)

    # 2. Map standard aliases
    alias_map = {
        "id": "invoice_id",
        "invoice_number": "invoice_id",
        "invoice_no": "invoice_id",
        "inv_id": "invoice_id",
        "client": "client_name",
        "customer": "client_name",
        "customer_name": "client_name",
        "amount": "invoice_amount",
        "total": "invoice_amount",
        "balance": "invoice_amount",
        "terms": "payment_terms_days",
        "payment_terms": "payment_terms_days",
        "net_terms": "payment_terms_days",
        "category": "project_category",
        "tier": "client_tier",
        "revisions": "revision_count",
    }
    for old_name, new_name in alias_map.items():
        if old_name in df_norm.columns and new_name not in df_norm.columns:
            df_norm.rename(columns={old_name: new_name}, inplace=True)

    # 3. Handle status vs is_paid_late / paid
    if "status" not in df_norm.columns:
        if "is_paid_late" in df_norm.columns:
            def map_paid_late(val):
                if pd.isna(val) or str(val).strip() == "" or str(val).strip().lower() in {"nan", "none", "null"}:
                    return InvoiceStatus.OPEN.value
                try:
                    num = float(val)
                    if num == 1.0:
                        return InvoiceStatus.PAID_LATE.value
                    elif num == 0.0:
                        return InvoiceStatus.PAID_ON_TIME.value
                except (ValueError, TypeError):
                    pass
                val_str = str(val).strip().lower()
                if val_str in {"1", "1.0", "true", "yes", "late", "paid_late"}:
                    return InvoiceStatus.PAID_LATE.value
                elif val_str in {"0", "0.0", "false", "no", "on_time", "paid", "paid_on_time"}:
                    return InvoiceStatus.PAID_ON_TIME.value
                return InvoiceStatus.OPEN.value
            df_norm["status"] = df_norm["is_paid_late"].apply(map_paid_late)
        elif "paid" in df_norm.columns:
            def map_paid(val):
                if pd.isna(val) or str(val).strip() == "" or str(val).strip().lower() in {"nan", "none", "null"}:
                    return InvoiceStatus.OPEN.value
                try:
                    num = float(val)
                    if num == 0.0:
                        return InvoiceStatus.OPEN.value
                    elif num == 1.0:
                        return InvoiceStatus.PAID_ON_TIME.value
                except (ValueError, TypeError):
                    pass
                val_str = str(val).strip().lower()
                if val_str in {"0", "0.0", "false", "no", "unpaid", "open"}:
                    return InvoiceStatus.OPEN.value
                return InvoiceStatus.PAID_ON_TIME.value
            df_norm["status"] = df_norm["paid"].apply(map_paid)

    # 4. Normalize status aliases if status column exists
    if "status" in df_norm.columns:
        def clean_status(val):
            if pd.isna(val) or str(val).strip() == "":
                return InvoiceStatus.OPEN.value
            s = str(val).strip().lower().replace("-", "_").replace(" ", "_")
            if s in {InvoiceStatus.PAID_ON_TIME.value, InvoiceStatus.PAID_LATE.value, InvoiceStatus.OPEN.value}:
                return s
            if s in {"paid", "settled", "completed", "closed", "on_time"}:
                return InvoiceStatus.PAID_ON_TIME.value
            if s in {"late", "overdue_paid", "delayed"}:
                return InvoiceStatus.PAID_LATE.value
            if s in {"pending", "unpaid", "outstanding", "active", "draft"}:
                return InvoiceStatus.OPEN.value
            return s
        df_norm["status"] = df_norm["status"].apply(clean_status)

    # 5. Impute optional secondary columns if missing
    if "project_category" not in df_norm.columns and "client_name" in df_norm.columns:
        df_norm["project_category"] = "General Services"

    if "client_tier" not in df_norm.columns and "client_name" in df_norm.columns:
        df_norm["client_tier"] = "Standard Client"

    if "revision_count" not in df_norm.columns:
        df_norm["revision_count"] = 0

    if "past_late_count" not in df_norm.columns:
        if "client_name" in df_norm.columns and "status" in df_norm.columns:
            late_clients = df_norm[df_norm["status"] == InvoiceStatus.PAID_LATE.value]["client_name"].value_counts().to_dict()
            df_norm["past_late_count"] = df_norm["client_name"].map(lambda c: late_clients.get(c, 0)).fillna(0).astype(int)
        else:
            df_norm["past_late_count"] = 0

    if "actual_days_to_pay" not in df_norm.columns and "status" in df_norm.columns:
        def impute_days(row):
            st = str(row.get("status", "")).lower()
            try:
                t = int(row.get("payment_terms_days", 30))
            except Exception:
                t = 30
            if st == InvoiceStatus.OPEN.value:
                return np.nan
            elif st == InvoiceStatus.PAID_LATE.value:
                return t + 15
            else:
                return max(1, t - 2)
        df_norm["actual_days_to_pay"] = df_norm.apply(impute_days, axis=1)

    return df_norm


def load_and_validate_csv(csv_source: Union[str, Path, io.StringIO, io.BytesIO]) -> pd.DataFrame:
    """Load a CSV file or buffer and validate against schema.
    
    Raises:
        InvoiceValidationError: if any validation error is detected.
    Returns:
        Clean, validated pandas DataFrame with correct column types.
    """
    try:
        df = pd.read_csv(csv_source)
    except Exception as e:
        raise InvoiceValidationError(
            f"Failed to parse CSV file: {str(e)}",
            errors=[
                ValidationErrorDetail(
                    column="__schema__",
                    error_type="CSV_PARSE_ERROR",
                    message=f"CSV parsing error: {str(e)}",
                )
            ],
        )

    df_normalized = normalize_and_impute_csv_dataframe(df)
    df_clean, errors = validate_invoice_dataframe(df_normalized)
    if errors:
        raise InvoiceValidationError(
            f"Invoice ledger validation failed with {len(errors)} error(s).",
            errors=errors,
        )

    # Cast types cleanly for modeling
    df_clean["invoice_id"] = df_clean["invoice_id"].astype(str).str.strip()
    df_clean["client_name"] = df_clean["client_name"].astype(str).str.strip()
    df_clean["project_category"] = df_clean["project_category"].astype(str).str.strip()
    df_clean["client_tier"] = df_clean["client_tier"].astype(str).str.strip()
    df_clean["invoice_amount"] = df_clean["invoice_amount"].astype(float)
    df_clean["payment_terms_days"] = df_clean["payment_terms_days"].astype(int)
    df_clean["revision_count"] = df_clean["revision_count"].astype(int)
    df_clean["past_late_count"] = df_clean["past_late_count"].astype(int)
    df_clean["status"] = df_clean["status"].astype(str).str.strip().str.lower()
    df_clean["actual_days_to_pay"] = pd.to_numeric(df_clean["actual_days_to_pay"], errors="coerce")
    if "due_date" in df_clean.columns:
        df_clean["due_date"] = df_clean["due_date"].astype(str).str.strip().replace({"nan": None, "None": None, "": None})

    return df_clean
