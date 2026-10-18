import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CashFlowOverview } from "@/components/CashFlowOverview";
import { ProviderBadge } from "@/components/ProviderBadge";
import { InvoiceTable } from "@/components/InvoiceTable";
import { FollowupComposerDrawer } from "@/components/FollowupComposerDrawer";
import { CsvUploadZone } from "@/components/CsvUploadZone";
import { Navbar } from "@/components/Navbar";
import { LedgerCashFlowSummary, InvoicePrediction, LedgerAnalysisResult } from "@/types";
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

  it("renders 'Nudged' badge when invoice has recorded follow-up history", () => {
    const mockNudgeHistory = {
      "INV-2025-019": [
        {
          id: "nudge-1",
          invoiceId: "INV-2025-019",
          clientName: "Apex Retailers",
          actionType: "gmail" as const,
          tone: "firm" as const,
          subject: "Payment Reminder",
          timestamp: new Date().toISOString(),
          messageSnippet: "Please review",
        },
      ],
    };

    render(
      <InvoiceTable
        predictions={mockPredictions}
        onDraftFollowup={vi.fn()}
        nudgeHistoryMap={mockNudgeHistory}
      />
    );

    expect(screen.getByText(/Nudged/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nudge Again/i })).toBeInTheDocument();
  });

  it("renders historical invoices tab and switches to settled records", () => {
    const mockHistorical = [
      {
        invoice_id: "HIST-001",
        client_name: "Legacy Client",
        invoice_amount: 1500,
        payment_terms_days: 30,
        status: "paid_on_time" as const,
        actual_days_to_pay: 25,
        project_category: "Web Dev",
        client_tier: "Enterprise",
      },
    ];

    render(
      <InvoiceTable
        predictions={mockPredictions}
        historicalInvoices={mockHistorical}
        onDraftFollowup={vi.fn()}
      />
    );

    // Both tabs should be present
    expect(screen.getByRole("button", { name: /Open Invoices/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Settled Ledger History/i })).toBeInTheDocument();

    // Switch to Settled Ledger History
    fireEvent.click(screen.getByRole("button", { name: /Settled Ledger History/i }));

    // Historical invoice should now be visible
    expect(screen.getByText("HIST-001")).toBeInTheDocument();
    expect(screen.getByText("Legacy Client")).toBeInTheDocument();
    expect(screen.getByText("Paid On Time")).toBeInTheDocument();
    expect(screen.getByText(/25 days/i)).toBeInTheDocument();
  });

  it("renders callout and defaults to settled tab when predictions array is empty", () => {
    const mockHistorical = [
      {
        invoice_id: "HIST-002",
        client_name: "Settled Enterprise",
        invoice_amount: 4000,
        payment_terms_days: 30,
        status: "paid_late" as const,
        actual_days_to_pay: 45,
      },
    ];

    render(
      <InvoiceTable
        predictions={[]}
        historicalInvoices={mockHistorical}
        onDraftFollowup={vi.fn()}
      />
    );

    // Automatically switches to settled tab
    expect(screen.getByText(/All 1 invoices in this file are marked as settled\/paid/i)).toBeInTheDocument();
    expect(screen.getByText("HIST-002")).toBeInTheDocument();
    expect(screen.getByText("Settled Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Paid Late")).toBeInTheDocument();
  });
});

describe("Navbar", () => {
  it("renders local storage status indicator and triggers onOpenStorageModal", () => {
    const mockOpenStorage = vi.fn();

    render(
      <Navbar
        isApiHealthy={true}
        isCheckingHealth={false}
        onRefreshHealth={vi.fn()}
        onOpenUpload={vi.fn()}
        onResetBenchmark={vi.fn()}
        isCustomLedger={false}
        onOpenStorageModal={mockOpenStorage}
        hasSavedLedger={true}
      />
    );

    const storageBtn = screen.getByRole("button", { name: /Browser Storage and Privacy Settings/i });
    expect(storageBtn).toBeInTheDocument();
    expect(screen.getByText(/Storage: Saved/i)).toBeInTheDocument();

    fireEvent.click(storageBtn);
    expect(mockOpenStorage).toHaveBeenCalled();
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

  it("parses subject and message body from Gemma draft without duplication", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "gentle" as const,
      drafted_message: "Subject: Friendly check-in: Invoice #INV-2025-019\n\nDear Apex Team,\nChecking in on invoice #INV-2025-019.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /Generate Payment Draft/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const subjectInput = screen.getByLabelText(/Subject Line/i) as HTMLInputElement;
      const bodyTextarea = screen.getByLabelText(/Message Body/i) as HTMLTextAreaElement;

      expect(subjectInput.value).toBe("Friendly check-in: Invoice #INV-2025-019");
      expect(bodyTextarea.value).toBe("Dear Apex Team,\nChecking in on invoice #INV-2025-019.");
      // Ensure subject is not duplicated in body
      expect(bodyTextarea.value.startsWith("Subject:")).toBe(false);
    });
  });

  it("validates recipient email and rejects missing or malformed email", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "gentle" as const,
      drafted_message: "Subject: Payment Reminder\n\nPlease find attached invoice.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);
    const mockOpenEmail = vi.fn();

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
        onOpenEmailApp={mockOpenEmail}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in Email App/i })).toBeInTheDocument();
    });

    const openEmailBtn = screen.getByRole("button", { name: /Open in Email App/i });

    // 1. Missing recipient error
    fireEvent.click(openEmailBtn);
    expect(screen.getByText(/Recipient email address is required/i)).toBeInTheDocument();
    expect(mockOpenEmail).not.toHaveBeenCalled();

    // 2. Malformed email error
    const emailInput = screen.getByLabelText(/Recipient Email/i);
    fireEvent.change(emailInput, { target: { value: "not-a-valid-email" } });
    fireEvent.click(openEmailBtn);

    expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    expect(mockOpenEmail).not.toHaveBeenCalled();
  });

  it("opens Gmail Compose in a new tab with current edited recipient, subject, and body on explicit click", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "firm" as const,
      drafted_message: "Subject: Payment Reminder: Invoice #INV-2025-019\n\nDear Apex Team,\nPlease review invoice #INV-2025-019 for $3,200.00.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);
    const mockOpenGmail = vi.fn();

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
        onOpenGmail={mockOpenGmail}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in Gmail/i })).toBeInTheDocument();
    });

    // Enter recipient
    fireEvent.change(screen.getByLabelText(/Recipient Email/i), {
      target: { value: "accounting@apexretailers.com" },
    });

    // Edit subject
    fireEvent.change(screen.getByLabelText(/Subject Line/i), {
      target: { value: "Urgent: Payment for Invoice #INV-2025-019 ($3,200.00 & Late Fee)" },
    });

    // Edit body with special characters, punctuation, and multiline paragraphs
    fireEvent.change(screen.getByLabelText(/Message Body/i), {
      target: {
        value: "Hello Finance Team,\n\nParagraph 1: Please remit $3,200.00 & 5% interest.\n\nParagraph 2: Wire transfer instructions attached.\n\nBest,\nOmkar",
      },
    });

    // Verify Gmail does NOT open before explicit button click
    expect(mockOpenGmail).not.toHaveBeenCalled();

    // Explicit user click
    fireEvent.click(screen.getByRole("button", { name: /Open in Gmail/i }));

    expect(mockOpenGmail).toHaveBeenCalledTimes(1);
    const gmailUrl = mockOpenGmail.mock.calls[0][0];

    // Verify Gmail URL structure
    expect(gmailUrl.startsWith("https://mail.google.com/mail/?view=cm&fs=1")).toBe(true);

    const parsed = new URL(gmailUrl);
    expect(parsed.searchParams.get("view")).toBe("cm");
    expect(parsed.searchParams.get("fs")).toBe("1");
    expect(parsed.searchParams.get("to")).toBe("accounting@apexretailers.com");
    expect(parsed.searchParams.get("su")).toBe(
      "Urgent: Payment for Invoice #INV-2025-019 ($3,200.00 & Late Fee)"
    );
    expect(parsed.searchParams.get("body")).toBe(
      "Hello Finance Team,\n\nParagraph 1: Please remit $3,200.00 & 5% interest.\n\nParagraph 2: Wire transfer instructions attached.\n\nBest,\nOmkar"
    );

    // Human approval confirmation banner is displayed
    expect(screen.getByText(/Gmail opened in a new tab with your prefilled draft/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Approval Required: CashNudge transfers this draft to your email client/i)
    ).toBeInTheDocument();
  });

  it("validates fields before opening Gmail and rejects empty subject or body", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "gentle" as const,
      drafted_message: "Subject: Follow-up\n\nHi Apex Team.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);
    const mockOpenGmail = vi.fn();

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
        onOpenGmail={mockOpenGmail}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in Gmail/i })).toBeInTheDocument();
    });

    const openGmailBtn = screen.getByRole("button", { name: /Open in Gmail/i });

    // 1. Missing recipient error
    fireEvent.click(openGmailBtn);
    expect(screen.getByText(/Recipient email address is required/i)).toBeInTheDocument();
    expect(mockOpenGmail).not.toHaveBeenCalled();

    // Fill valid recipient
    fireEvent.change(screen.getByLabelText(/Recipient Email/i), {
      target: { value: "client@example.com" },
    });

    // 2. Clear subject to trigger subject error
    fireEvent.change(screen.getByLabelText(/Subject Line/i), {
      target: { value: "   " },
    });
    fireEvent.click(openGmailBtn);
    expect(screen.getByText(/Email subject is required/i)).toBeInTheDocument();
    expect(mockOpenGmail).not.toHaveBeenCalled();

    // Restore subject and clear message body to trigger message error
    fireEvent.change(screen.getByLabelText(/Subject Line/i), {
      target: { value: "Valid Subject" },
    });
    fireEvent.change(screen.getByLabelText(/Message Body/i), {
      target: { value: "   " },
    });
    fireEvent.click(openGmailBtn);
    expect(screen.getByText(/Message body is required/i)).toBeInTheDocument();
    expect(mockOpenGmail).not.toHaveBeenCalled();
  });

  it("handles popup-blocking behavior gracefully and provides a direct fallback link and retry", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "gentle" as const,
      drafted_message: "Subject: Check-in\n\nHi Apex team, checking in.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);

    // Mock window.open to simulate popup blocker returning null
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in Gmail/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Recipient Email/i), {
      target: { value: "billing@apex.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Open in Gmail/i }));

    expect(windowOpenSpy).toHaveBeenCalledTimes(1);

    // Fallback banner for blocked popup is displayed
    expect(screen.getByText(/Popup Blocked by Browser/i)).toBeInTheDocument();
    const fallbackLink = screen.getByRole("link", { name: /Open Gmail Directly/i });
    expect(fallbackLink).toBeInTheDocument();
    expect(fallbackLink).toHaveAttribute("target", "_blank");
    expect(fallbackLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(fallbackLink.getAttribute("href")).toContain("https://mail.google.com/mail/?view=cm&fs=1");

    // Retry button is available
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("constructs safely URL-encoded mailto URL with user-edited content on explicit click", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "firm" as const,
      drafted_message: "Subject: Outstanding Balance: Invoice #INV-2025-019\n\nDear Apex,\nInvoice is overdue by 5 days for $3,200.00 & terms Net 60.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);
    const mockOpenEmail = vi.fn();

    render(
      <FollowupComposerDrawer
        invoice={mockPredictions[0]}
        onClose={vi.fn()}
        onOpenEmailApp={mockOpenEmail}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Recipient Email/i)).toBeInTheDocument();
    });

    // Enter recipient
    fireEvent.change(screen.getByLabelText(/Recipient Email/i), {
      target: { value: "billing@apexretailers.com" },
    });

    // Edit subject
    fireEvent.change(screen.getByLabelText(/Subject Line/i), {
      target: { value: "Urgent: Payment for Invoice #INV-2025-019 ($3,200.00)" },
    });

    // Edit body with multiline text and special characters
    fireEvent.change(screen.getByLabelText(/Message Body/i), {
      target: { value: "Hi Apex,\n\nPlease process $3,200.00 & confirm date.\n\nBest,\nMe" },
    });

    // Verify it has NOT opened before click
    expect(mockOpenEmail).not.toHaveBeenCalled();

    // Explicit click
    fireEvent.click(screen.getByRole("button", { name: /Open in Email App/i }));

    expect(mockOpenEmail).toHaveBeenCalledTimes(1);
    const mailtoUrl = mockOpenEmail.mock.calls[0][0];

    expect(mailtoUrl.startsWith("mailto:billing@apexretailers.com?subject=")).toBe(true);
    expect(mailtoUrl).toContain("Urgent%3A%20Payment%20for%20Invoice%20%23INV-2025-019%20(%243%2C200.00)");
    expect(mailtoUrl).toContain("&body=Hi%20Apex%2C%0A%0APlease%20process%20%243%2C200.00%20%26%20confirm%20date.%0A%0ABest%2C%0AMe");

    // Feedback notice displayed
    expect(screen.getByText(/Email app opened with your draft/i)).toBeInTheDocument();
    expect(screen.getByText(/Approval Required: CashNudge transfers this draft to your email client/i)).toBeInTheDocument();
  });

  it("copies full email draft including To, Subject, and Body for fallback webmail support", async () => {
    const mockDraftResponse = {
      invoice_id: "INV-2025-019",
      customer_name: "Apex Retailers",
      tone: "gentle" as const,
      drafted_message: "Subject: Follow-up on INV-2025-019\n\nHi Apex, just following up.",
      inference_provider: "Gemma Hosted",
      warnings: [],
      human_approval_required: true,
    };

    vi.spyOn(api, "draftFollowup").mockResolvedValueOnce(mockDraftResponse);

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

    fireEvent.click(screen.getByRole("button", { name: /Generate Payment Draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy Full Draft/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Recipient Email/i), {
      target: { value: "accounts@apex.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy Full Draft/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "To: accounts@apex.com\nSubject: Follow-up on INV-2025-019\n\nHi Apex, just following up."
      );
      expect(screen.getByText("Copied Full Draft!")).toBeInTheDocument();
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

    vi.spyOn(api, "analyzeLedgerCsv").mockResolvedValueOnce(mockAnalysisResult as LedgerAnalysisResult);

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

  it("allows downloading sample CSV template", () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    render(
      <CsvUploadZone
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const downloadBtn = screen.getByRole("button", { name: /Download Template/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
