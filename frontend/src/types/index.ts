/**
 * TypeScript type definitions corresponding to CashNudge backend schemas.
 */

export type RiskTier = "low" | "medium" | "high";

export type FollowupTone = "gentle" | "firm";

export interface InvoicePrediction {
  invoice_id: string;
  client_name: string;
  invoice_amount: number;
  payment_terms_days: number;
  late_probability: number;
  risk_tier: RiskTier;
  top_risk_factors: string[];
  due_date?: string;
  days_overdue?: number;
  due_status?: "upcoming" | "due_today" | "overdue" | "unspecified";
}


export interface LedgerCashFlowSummary {
  total_invoices: number;
  historical_invoices_count: number;
  historical_on_time_count: number;
  historical_late_count: number;
  historical_late_rate: number;
  outstanding_invoices_count: number;
  total_outstanding_amount: number;
  at_risk_amount: number;
  high_risk_amount: number;
  medium_risk_amount: number;
  low_risk_amount: number;
}

export interface LedgerAnalysisResult {
  summary: LedgerCashFlowSummary;
  predictions: InvoicePrediction[];
  metadata: {
    model_provider?: string;
    is_synthetic_data?: boolean;
    risk_thresholds?: {
      low: number;
      high: number;
    };
    privacy_guarantee?: string;
    limitations?: string;
    feature_schema?: {
      predictive_features: string[];
      categorical_features: string[];
      numerical_features: string[];
      excluded_columns: string[];
      pii_transmitted_to_cloud: boolean;
      direct_identifiers_transmitted: boolean;
    };
    [key: string]: unknown;
  };
}

export interface ValidationErrorDetail {
  row_index?: number;
  invoice_id?: string;
  column: string;
  error_type: string;
  message: string;
}

export interface ApiValidationErrorResponse {
  message?: string;
  errors?: ValidationErrorDetail[];
  error_type?: string;
}

export interface FollowupDraftRequest {
  invoice_id: string;
  customer_name: string;
  invoice_amount?: number;
  currency?: string;
  project_category?: string;
  payment_terms_days?: number;
  due_date?: string;
  reference_date?: string;
  days_overdue?: number;
  risk_tier?: RiskTier;
  late_probability?: number;
  tone: FollowupTone;
  business_name?: string;
  user_context?: string;
}

export interface FollowupDraftResponse {
  invoice_id: string;
  customer_name: string;
  tone: FollowupTone;
  drafted_message: string;
  inference_provider: string;
  warnings: string[];
  human_approval_required: boolean;
  date_facts?: {
    due_date?: string;
    reference_date: string;
    days_overdue?: number;
    days_until_due?: number;
    status: string;
    status_label: string;
  };
  metadata?: Record<string, unknown>;
}


export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}
