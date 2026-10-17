import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CashFlowOverview } from "@/components/CashFlowOverview";
import { ProviderBadge } from "@/components/ProviderBadge";
import { InvoiceTable } from "@/components/InvoiceTable";
import { FollowupComposerDrawer } from "@/components/FollowupComposerDrawer";
import { CsvUploadZone } from "@/components/CsvUploadZone";
import { LedgerCashFlowSummary, InvoicePrediction } from "@/types";
import * as api from "@/lib/api";

const mockSummary: LedgerCashFlowSummary = {
  total_invoices: 24,
  historical_invoices_count: 18,
  historical_on_time_count: 12,
  historical_late_count: 6,
  historical_late_rate: 0.333,
  outstanding_invoices_count: 6,
  total_outstanding_amount: 14600.0,
  at_risk_amount: 8700.0,
  high_risk_amount: 6200.0,
  medium_risk_amount: 2500.0,
  low_risk_amount: 5900.0,
};

const mockPredictions: InvoicePrediction[] = [
  {
    invoice_id: "INV-2025-019",
    client_name: "Apex Retailers",
    invoice_amount: 3200.0,
    payment_terms_days: 60,
    late_probability: 0.88,
    risk_tier: "high",
    top_risk_factors: ["Long payment terms (60 days)", "High value invoice"],
  },
  {
    invoice_id: "INV-2025-020",
    client_name: "BrightPath Studio",
    invoice_amount: 2500.0,
    payment_terms_days: 30,
    late_probability: 0.45,
    risk_tier: "medium",
    top_risk_factors: ["Moderate historical friction"],
  },
  {
    invoice_id: "INV-2025-021",
    client_name: "Horizon Labs",
    invoice_amount: 5900.0,
    payment_terms_days: 14,
    late_probability: 0.12,
    risk_tier: "low",
    top_risk_factors: ["Prompt payer history"],
  },
];

describe("CashFlowOverview", () => {
  it("renders correct financial metrics matching backend ledger summary", () => {
    render(<CashFlowOverview summary={mockSummary} />);

    // Total outstanding amount
    expect(screen.getByText("$14,600.00")).toBeInTheDocument();
    // Low risk amount
    expect(screen.getByText("$5,900.00")).toBeInTheDocument();
    // Medium risk amount
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    // High risk amount
    expect(screen.getByText("$6,200.00")).toBeInTheDocument();
    // Outstanding count
    expect(screen.getByText("6 open")).toBeInTheDocument();
    // Historical late rate
    expect(screen.getByText(/33.3%/)).toBeInTheDocument();
  });
});

describe("ProviderBadge", () => {
  it("displays transparent model provider and synthetic data disclaimer", () => {
    render(
      <ProviderBadge
        provider="Prior Labs Hosted TabPFN API"
        isSynthetic={true}
      />
    );

    expect(screen.getByText("Prior Labs Hosted TabPFN API")).toBeInTheDocument();
    expect(
      screen.getByText(/Synthetic benchmark data/)
    ).toBeInTheDocument();
  });

  it("handles non-synthetic user ledger correctly", () => {
    render(
      <ProviderBadge
        provider="Prior Labs Hosted TabPFN API"
        isSynthetic={false}
      />
    );

    expect(screen.getByText("Prior Labs Hosted TabPFN API")).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic benchmark data/)).toBeNull();
  });
});

describe("InvoiceTable", () => {
  it("displays invoices with semantic risk tier labels and allows drafting nudge", () => {
    const handleDraft = vi.fn();
    render(
      <InvoiceTable
        predictions={mockPredictions}
        onDraftFollowup={handleDraft}
      />
    );

    expect(screen.getByText("INV-2025-019")).toBeInTheDocument();
    expect(screen.getByText("Apex Retailers")).toBeInTheDocument();
    expect(screen.getByText(/High Risk \(88.0%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Medium Risk \(45.0%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Low Risk \(12.0%\)/)).toBeInTheDocument();

    // Trigger draft action
    const draftButtons = screen.getAllByRole("button", { name: /Draft Nudge/i });
    expect(draftButtons.length).toBe(3);
    fireEvent.click(draftButtons[0]);

    expect(handleDraft).toHaveBeenCalledWith(mockPredictions[0]);
  });

  it("filters invoices based on search query", () => {
    render(
      <InvoiceTable
        predictions={mockPredictions}
        onDraftFollowup={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search by client or invoice ID/i);
    fireEvent.change(searchInput, { target: { value: "Apex" } });

    expect(screen.getByText("Apex Retailers")).toBeInTheDocument();
    expect(screen.queryByText("BrightPath Studio")).toBeNull();
  });
});

describe("FollowupComposerDrawer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates follow-up draft using selected tone and copies to clipboard", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "firm" as const,
      drafted_message: "Dear Apex Retailers, Invoice INV-2025-019 for $3,200.00 is due. Please confirm payment.",
      inference_provider: "Gemma 2 9B via Groq",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
      />
    );

    // Check prefilled facts
    expect(screen.getByText("Apex Retailers")).toBeInTheDocument();
    expect(screen.getByText("$3,200.00")).toBeInTheDocument();

    // Click Generate Draft
    const generateBtn = screen.getByRole("button", { name: /Generate Payment Draft/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dear Apex Retailers/)).toBeInTheDocument();
      expect(screen.getByText("Human Review Required")).toBeInTheDocument();
    });

    // Copy to clipboard
    const copyBtn = screen.getByRole("button", { name: /Copy Message/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("Dear Apex Retailers")
      );
    });
  });

  it("displays backend error cleanly when generation fails", async () => {
    vi.spyOn(api, "draftFollowup").mockRejectedValueOnce(
      new api.ApiClientError("Gemma provider rate limit exceeded", 429)
    );

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /Generate Payment Draft/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Gemma provider rate limit exceeded/)
      ).toBeInTheDocument();
    });
  });
});

describe("CsvUploadZone", () => {
  it("rejects files that are not CSV", () => {
    render(
      <CsvUploadZone
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const invalidFile = new File(["test"], "invoices.pdf", { type: "application/pdf" });
    const dropzone = screen.getByText(/Click to browse or drop CSV ledger here/i);

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [invalidFile] },
    });

    expect(
      screen.getByText("Please select a valid CSV file (.csv extension).")
    ).toBeInTheDocument();
  });

  it("rejects files that exceed 5MB", () => {
    render(
      <CsvUploadZone
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const oversizedFile = new File(["x".repeat(6 * 1024 * 1024)], "huge.csv", {
      type: "text/csv",
    });
    // mock size
    Object.defineProperty(oversizedFile, "size", { value: 6 * 1024 * 1024 });

    const dropzone = screen.getByText(/Click to browse or drop CSV ledger here/i);
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [oversizedFile] },
    });

    expect(
      screen.getByText("File exceeds maximum allowed size of 5 MB.")
    ).toBeInTheDocument();
  });

  it("handles successful CSV upload and triggers onSuccess", async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();
    const mockAnalysisResult = {
      summary: mockSummary,
      predictions: mockPredictions,
      metadata: { model_provider: "Prior Labs Hosted TabPFN API" },
    };

    vi.spyOn(api, "analyzeLedgerCsv").mockResolvedValueOnce(mockAnalysisResult as any);

    render(
      <CsvUploadZone
        isOpen={true}
        onClose={mockClose}
        onSuccess={mockSuccess}
      />
    );

    const validFile = new File(["invoice_id,client_name\nINV-1,Test"], "ledger.csv", {
      type: "text/csv",
    });
    const dropzone = screen.getByText(/Click to browse or drop CSV ledger here/i);

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile] },
    });

    expect(screen.getByText("ledger.csv")).toBeInTheDocument();

    const uploadBtn = screen.getByRole("button", { name: /Upload & Estimate Risk/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(mockAnalysisResult);
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it("displays backend validation errors with row and column details", async () => {
    const errorResponse = new api.ApiClientError("Validation failed for 1 row", 422, {
      message: "Validation failed for 1 row",
      errors: [
        {
          row_index: 2,
          column: "invoice_amount",
          error_type: "InvalidAmount",
          message: "Must be a positive non-zero number",
        },
      ],
    });

    vi.spyOn(api, "analyzeLedgerCsv").mockRejectedValueOnce(errorResponse);

    render(
      <CsvUploadZone
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const validFile = new File(["data"], "ledger.csv", { type: "text/csv" });
    const dropzone = screen.getByText(/Click to browse or drop CSV ledger here/i);
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile] },
    });

    const uploadBtn = screen.getByRole("button", { name: /Upload & Estimate Risk/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText(/Validation failed for 1 row/)).toBeInTheDocument();
    });
    expect(screen.getByText("Row 3:")).toBeInTheDocument();
    expect(screen.getByText("invoice_amount")).toBeInTheDocument();
    expect(screen.getByText(/Must be a positive non-zero number/)).toBeInTheDocument();
  });
});
