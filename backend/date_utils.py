"""Deterministic invoice date calculations and status derivation for CashNudge."""

from datetime import date, datetime, timedelta
from typing import Optional, Union, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class InvoiceDateFacts(BaseModel):
    """Deterministic date verification facts for an invoice."""
    model_config = ConfigDict(frozen=True)

    due_date: Optional[str] = Field(None, description="ISO format due date string (YYYY-MM-DD)")
    reference_date: str = Field(..., description="ISO format reference date string (YYYY-MM-DD)")
    days_overdue: Optional[int] = Field(None, ge=0, description="Calculated days overdue (None if upcoming or unspecified)")
    days_until_due: Optional[int] = Field(None, ge=0, description="Calculated days until due (None if overdue or unspecified)")
    status: str = Field(..., description="One of: 'upcoming', 'due_today', 'overdue', 'unspecified'")
    status_label: str = Field(..., description="Human-readable status summary")
    is_overdue: bool = False
    is_upcoming: bool = False
    is_due_today: bool = False


def parse_date_safe(val: Optional[Union[str, date, datetime]]) -> Optional[date]:
    """Safely parse a date string or object into a datetime.date instance."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    
    val_str = str(val).strip()
    if not val_str or val_str.lower() in {"none", "null", "nan", ""}:
        return None

    # Handle standard ISO YYYY-MM-DD
    try:
        return date.fromisoformat(val_str[:10])
    except (ValueError, TypeError):
        pass

    # Try common fallback date formats
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except (ValueError, TypeError):
            continue

    return None


def compute_invoice_date_facts(
    due_date: Optional[Union[str, date, datetime]],
    reference_date: Optional[Union[str, date, datetime]] = None,
    explicit_days_overdue: Optional[int] = None,
) -> InvoiceDateFacts:
    """Deterministically derive days overdue and upcoming/overdue status.
    
    Args:
        due_date: Target invoice due date (string or date).
        reference_date: Explicit reference date for calculations (defaults to today).
        explicit_days_overdue: Precomputed days overdue if due_date is absent or unspecified.
        
    Returns:
        InvoiceDateFacts containing verified deterministic facts.
    """
    ref_d = parse_date_safe(reference_date) or date.today()
    ref_str = ref_d.isoformat()

    due_d = parse_date_safe(due_date)

    if due_d is not None:
        due_str = due_d.isoformat()
        delta_days = (ref_d - due_d).days

        if delta_days > 0:
            # Due date is in the past -> Overdue
            return InvoiceDateFacts(
                due_date=due_str,
                reference_date=ref_str,
                days_overdue=delta_days,
                days_until_due=None,
                status="overdue",
                status_label=f"Overdue by {delta_days} day(s) (was due on {due_str})",
                is_overdue=True,
                is_upcoming=False,
                is_due_today=False,
            )
        elif delta_days == 0:
            # Due date is today -> Due today
            return InvoiceDateFacts(
                due_date=due_str,
                reference_date=ref_str,
                days_overdue=0,
                days_until_due=0,
                status="due_today",
                status_label=f"Due today ({due_str})",
                is_overdue=False,
                is_upcoming=False,
                is_due_today=True,
            )
        else:
            # Due date is in the future -> Upcoming
            days_until = abs(delta_days)
            return InvoiceDateFacts(
                due_date=due_str,
                reference_date=ref_str,
                days_overdue=0,
                days_until_due=days_until,
                status="upcoming",
                status_label=f"Upcoming: due in {days_until} day(s) on {due_str}",
                is_overdue=False,
                is_upcoming=True,
                is_due_today=False,
            )

    # If due_date is not provided, check explicit_days_overdue
    if explicit_days_overdue is not None and explicit_days_overdue > 0:
        return InvoiceDateFacts(
            due_date=None,
            reference_date=ref_str,
            days_overdue=explicit_days_overdue,
            days_until_due=None,
            status="overdue",
            status_label=f"Overdue by {explicit_days_overdue} day(s) (due date not specified)",
            is_overdue=True,
            is_upcoming=False,
            is_due_today=False,
        )

    # Missing due date and no overdue count
    return InvoiceDateFacts(
        due_date=None,
        reference_date=ref_str,
        days_overdue=None,
        days_until_due=None,
        status="unspecified",
        status_label="Open invoice (due date not specified)",
        is_overdue=False,
        is_upcoming=False,
        is_due_today=False,
    )


# Relative day offsets for synthetic demo open invoices
SYNTHETIC_OPEN_INVOICE_OFFSETS: Dict[str, int] = {
    "INV-2024-019": 21,   # Upcoming, 21 days until due (Net 60 terms)
    "INV-2024-020": 6,    # Upcoming, 6 days until due (Net 30 terms, gentle check-in)
    "INV-2024-021": -14,  # Overdue by 14 days (Net 30 terms, firm follow-up)
    "INV-2024-022": 0,    # Due today (Net 14 terms)
    "INV-2024-023": 12,   # Upcoming, 12 days until due (Net 30 terms)
    "INV-2024-024": -3,   # Overdue by 3 days (Net 30 terms)
}


def get_synthetic_demo_due_date(
    invoice_id: str,
    reference_date: Optional[Union[str, date, datetime]] = None,
) -> str:
    """Generate a coherent, current-relative due date for synthetic demo invoices.
    
    Guarantees that demo invoices always have coherent relative dates regardless of the
    calendar year in which the application runs.
    """
    ref_d = parse_date_safe(reference_date) or date.today()
    offset = SYNTHETIC_OPEN_INVOICE_OFFSETS.get(invoice_id, 7)
    target_d = ref_d + timedelta(days=offset)
    return target_d.isoformat()
