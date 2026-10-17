/**
 * Centralized API client for CashNudge backend.
 */

import {
  HealthResponse,
  LedgerAnalysisResult,
  FollowupDraftRequest,
  FollowupDraftResponse,
  ApiValidationErrorResponse,
} from "@/types";

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return window.location.origin;
    }
  }
  return "http://127.0.0.1:8000";
}

const API_BASE_URL = getApiBaseUrl();

export class ApiClientError extends Error {
  status: number;
  data?: ApiValidationErrorResponse | Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    data?: ApiValidationErrorResponse | Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: any;
    try {
      errorData = await res.json();
    } catch {
      errorData = { message: await res.text() };
    }

    const message =
      typeof errorData?.detail === "string"
        ? errorData.detail
        : errorData?.detail?.message ||
          errorData?.message ||
          `Request failed with status ${res.status}`;

    throw new ApiClientError(
      message,
      res.status,
      typeof errorData?.detail === "object" ? errorData.detail : errorData
    );
  }
  return res.json();
}

/** Check API server connectivity and operational status */
export async function checkHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return handleResponse<HealthResponse>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      "Unable to connect to CashNudge API server. Please ensure the backend is running.",
      0
    );
  }
}

/** Fetch synthetic benchmark ledger analysis */
export async function getSampleLedger(): Promise<LedgerAnalysisResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/ledger/sample`, {
      method: "GET",
      cache: "no-store",
    });
    return handleResponse<LedgerAnalysisResult>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      "Failed to retrieve sample ledger from server.",
      0
    );
  }
}

/** Upload and analyze a custom CSV file */
export async function analyzeLedgerCsv(file: File): Promise<LedgerAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/ledger/analyze`, {
      method: "POST",
      body: formData,
    });
    return handleResponse<LedgerAnalysisResult>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      "Network error while uploading invoice ledger.",
      0
    );
  }
}

/** Request Gemma follow-up reminder draft */
export async function draftFollowup(
  req: FollowupDraftRequest
): Promise<FollowupDraftResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/followups/draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    });
    return handleResponse<FollowupDraftResponse>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      "Network error while drafting payment follow-up reminder.",
      0
    );
  }
}

/** Currency formatter helper */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
}

/** Probability to percentage string helper */
export function formatPercent(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}
