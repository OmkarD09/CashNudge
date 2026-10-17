"""Data schemas and Pydantic models for CashNudge Risk Engine."""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class InvoiceStatus(str, Enum):
    """Supported invoice statuses."""
    PAID_ON_TIME = "paid_on_time"
    PAID_LATE = "paid_late"
    OPEN = "open"


class RiskTier(str, Enum):
    """Categorical risk tiers for late payment probability."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ValidationErrorDetail(BaseModel):
    """Detailed validation issue for an invoice row or schema structure."""
    model_config = ConfigDict(frozen=True)

    row_index: Optional[int] = Field(None, description="0-based CSV row index, if applicable")
    invoice_id: Optional[str] = Field(None, description="Invoice identifier if available")
    column: str = Field(..., description="Affected column name or '__schema__'")
    error_type: str = Field(..., description="Machine-readable error category")
    message: str = Field(..., description="Human-readable explanation of validation error")


class InvoicePrediction(BaseModel):
    """Risk prediction result for a single outstanding invoice."""
    model_config = ConfigDict(frozen=True)

    invoice_id: str
    client_name: str = Field(..., description="Preserved for display only; excluded from model input")
    invoice_amount: float
    payment_terms_days: int
    late_probability: float = Field(..., ge=0.0, le=1.0, description="Estimated probability of late payment")
    risk_tier: RiskTier
    top_risk_factors: List[str] = Field(default_factory=list, description="Primary explanatory drivers")
    due_date: Optional[str] = Field(None, description="ISO format due date string (YYYY-MM-DD)")
    days_overdue: Optional[int] = Field(None, ge=0, description="Calculated days overdue if past due")
    due_status: Optional[str] = Field(None, description="Deterministic status: 'upcoming', 'due_today', 'overdue', or 'unspecified'")


class LedgerCashFlowSummary(BaseModel):
    """Deterministic and risk-weighted cash-flow summary metrics."""
    model_config = ConfigDict(frozen=True)

    total_invoices: int
    historical_invoices_count: int
    historical_on_time_count: int
    historical_late_count: int
    historical_late_rate: float
    outstanding_invoices_count: int
    total_outstanding_amount: float
    at_risk_amount: float = Field(..., description="Total outstanding dollars in medium and high risk tiers")
    high_risk_amount: float
    medium_risk_amount: float
    low_risk_amount: float


class LedgerAnalysisResult(BaseModel):
    """Complete output payload for analyze_ledger."""
    model_config = ConfigDict(frozen=True)

    summary: LedgerCashFlowSummary
    predictions: List[InvoicePrediction]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FollowupTone(str, Enum):
    """Supported reminder tones."""
    GENTLE = "gentle"
    FIRM = "firm"


class FollowupDraftRequest(BaseModel):
    """Request payload for Gemma payment follow-up drafting."""
    model_config = ConfigDict(extra="forbid")

    invoice_id: str = Field(..., description="Invoice identifier (e.g. INV-2024-001)")
    customer_name: str = Field(..., min_length=1, description="Client or company name")
    invoice_amount: Optional[float] = Field(None, gt=0, description="Total invoice amount")
    currency: str = Field("USD", description="Currency symbol or code (e.g. USD, EUR, GBP)")
    project_category: Optional[str] = Field(None, description="Type of work delivered")
    payment_terms_days: Optional[int] = Field(None, gt=0, description="Payment terms in days")
    due_date: Optional[str] = Field(None, description="Due date string if known (e.g. '2026-10-24')")
    reference_date: Optional[str] = Field(None, description="Explicit ISO reference date for calculating date facts (defaults to today)")
    days_overdue: Optional[int] = Field(None, ge=0, description="Number of days past due date if known")
    risk_tier: Optional[RiskTier] = Field(None, description="Internal TabPFN risk tier assessment")
    late_probability: Optional[float] = Field(None, ge=0.0, le=1.0, description="Estimated late probability")
    tone: FollowupTone = Field(default=FollowupTone.GENTLE, description="Desired communication tone ('gentle' or 'firm')")
    business_name: Optional[str] = Field(None, description="Freelancer's business or agency name")
    user_context: Optional[str] = Field(None, description="Optional custom notes or context")


class FollowupDraftResponse(BaseModel):
    """Structured response containing AI-drafted reminder message."""
    model_config = ConfigDict(frozen=True)

    invoice_id: str
    customer_name: str
    tone: FollowupTone
    drafted_message: str
    inference_provider: str
    warnings: List[str] = Field(default_factory=list)
    human_approval_required: bool = Field(True, description="Enforces that all messages require human review before sending")
    date_facts: Optional[Dict[str, Any]] = Field(None, description="Deterministic date verification summary")
    metadata: Dict[str, Any] = Field(default_factory=dict)

