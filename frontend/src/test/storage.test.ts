import { describe, it, expect, beforeEach } from "vitest";
import {
  saveCustomLedger,
  getSavedCustomLedger,
  clearCustomLedger,
  recordNudgeAction,
  getNudgeHistory,
  getNudgesForInvoice,
  clearNudgeHistory,
  getUserProfile,
  saveUserProfile,
  getStorageSummary,
  exportLocalBackup,
  importLocalBackup,
  clearAllLocalData,
  STORAGE_KEYS,
} from "../lib/storage";
import { LedgerAnalysisResult } from "../types";

const mockLedgerResult: LedgerAnalysisResult = {
  summary: {
    total_invoices: 2,
    historical_invoices_count: 1,
    historical_on_time_count: 1,
    historical_late_count: 0,
    historical_late_rate: 0.0,
    outstanding_invoices_count: 1,
    total_outstanding_amount: 5000,
    at_risk_amount: 5000,
    high_risk_amount: 5000,
    medium_risk_amount: 0,
    low_risk_amount: 0,
  },
  predictions: [
    {
      invoice_id: "INV-001",
      client_name: "Acme Corp",
      invoice_amount: 5000,
      payment_terms_days: 30,
      late_probability: 0.85,
      risk_tier: "high",
      top_risk_factors: ["High Amount"],
    },
  ],
  metadata: {
    model_provider: "tabpfn",
    is_synthetic_data: true,
  },
};

describe("storage.ts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Custom Ledger Persistence", () => {
    it("saves and retrieves a custom ledger successfully", () => {
      const saved = saveCustomLedger(mockLedgerResult, "my_invoices.csv");
      expect(saved).toBe(true);

      const retrieved = getSavedCustomLedger();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.fileName).toBe("my_invoices.csv");
      expect(retrieved?.totalInvoices).toBe(1);
      expect(retrieved?.result.predictions[0].invoice_id).toBe("INV-001");
    });

    it("returns null if no ledger is saved", () => {
      const retrieved = getSavedCustomLedger();
      expect(retrieved).toBeNull();
    });

    it("handles corrupted ledger JSON gracefully without throwing", () => {
      localStorage.setItem(STORAGE_KEYS.LEDGER, "invalid-json-string{");
      const retrieved = getSavedCustomLedger();
      expect(retrieved).toBeNull();
    });

    it("clears the saved custom ledger", () => {
      saveCustomLedger(mockLedgerResult, "test.csv");
      expect(getSavedCustomLedger()).not.toBeNull();

      clearCustomLedger();
      expect(getSavedCustomLedger()).toBeNull();
    });
  });

  describe("Nudge Action Logging", () => {
    it("records follow-up actions and retrieves them", () => {
      const record = recordNudgeAction({
        invoiceId: "INV-001",
        clientName: "Acme Corp",
        actionType: "gmail",
        tone: "firm",
        subject: "Overdue payment notice",
        messageSnippet: "Hi Acme, please check invoice INV-001",
        recipientEmail: "billing@acme.com",
      });

      expect(record).not.toBeNull();
      expect(record?.id).toMatch(/^nudge_/);
      expect(record?.actionType).toBe("gmail");

      const history = getNudgeHistory();
      expect(history.length).toBe(1);
      expect(history[0].invoiceId).toBe("INV-001");

      const forInvoice = getNudgesForInvoice("INV-001");
      expect(forInvoice.length).toBe(1);
      expect(getNudgesForInvoice("NONEXISTENT")).toEqual([]);
    });

    it("limits nudge history to the most recent 200 items", () => {
      for (let i = 0; i < 210; i++) {
        recordNudgeAction({
          invoiceId: `INV-${i}`,
          clientName: `Client ${i}`,
          actionType: "copy_message",
          tone: "gentle",
          subject: "Check-in",
          messageSnippet: "Snippet",
        });
      }

      const history = getNudgeHistory();
      expect(history.length).toBe(200);
      expect(history[0].invoiceId).toBe("INV-209");
    });

    it("clears nudge history", () => {
      recordNudgeAction({
        invoiceId: "INV-001",
        clientName: "Acme",
        actionType: "mailto",
        tone: "gentle",
        subject: "Subj",
        messageSnippet: "Msg",
      });

      expect(getNudgeHistory().length).toBe(1);
      clearNudgeHistory();
      expect(getNudgeHistory().length).toBe(0);
    });
  });

  describe("User Profile & Business Settings", () => {
    it("saves and retrieves user business preferences", () => {
      expect(getUserProfile()).toEqual({});

      saveUserProfile({ businessName: "Studio Orbit LLC", defaultTone: "firm" });
      const profile = getUserProfile();
      expect(profile.businessName).toBe("Studio Orbit LLC");
      expect(profile.defaultTone).toBe("firm");
    });
  });

  describe("Backup Export & Import", () => {
    it("exports and imports valid JSON backup", () => {
      saveCustomLedger(mockLedgerResult, "export_test.csv");
      recordNudgeAction({
        invoiceId: "INV-001",
        clientName: "Acme Corp",
        actionType: "gmail",
        tone: "gentle",
        subject: "Friendly Reminder",
        messageSnippet: "Hey team",
      });
      saveUserProfile({ businessName: "My Studio" });

      const exportedJson = exportLocalBackup();
      expect(exportedJson).toContain("export_test.csv");
      expect(exportedJson).toContain("INV-001");
      expect(exportedJson).toContain("My Studio");

      // Wipe local storage
      clearAllLocalData();
      expect(getSavedCustomLedger()).toBeNull();
      expect(getNudgeHistory()).toEqual([]);

      // Restore from backup
      const result = importLocalBackup(exportedJson);
      expect(result.success).toBe(true);

      expect(getSavedCustomLedger()?.fileName).toBe("export_test.csv");
      expect(getNudgeHistory().length).toBe(1);
      expect(getUserProfile().businessName).toBe("My Studio");
    });

    it("rejects invalid JSON backup cleanly", () => {
      const result = importLocalBackup("not-valid-json");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Storage Summary & Clearing", () => {
    it("reports accurate storage summary", () => {
      saveCustomLedger(mockLedgerResult, "summary_test.csv");
      recordNudgeAction({
        invoiceId: "INV-001",
        clientName: "Acme Corp",
        actionType: "mailto",
        tone: "gentle",
        subject: "Reminder",
        messageSnippet: "Text",
      });
      saveUserProfile({ businessName: "Agency X" });

      const summary = getStorageSummary();
      expect(summary.hasSavedLedger).toBe(true);
      expect(summary.savedLedgerName).toBe("summary_test.csv");
      expect(summary.invoiceCount).toBe(1);
      expect(summary.nudgeCount).toBe(1);
      expect(summary.businessName).toBe("Agency X");
      expect(summary.approximateBytes).toBeGreaterThan(0);
    });

    it("clears all local data", () => {
      saveCustomLedger(mockLedgerResult, "test.csv");
      recordNudgeAction({
        invoiceId: "INV-001",
        clientName: "Acme",
        actionType: "gmail",
        tone: "firm",
        subject: "Subject",
        messageSnippet: "Snippet",
      });
      saveUserProfile({ businessName: "Test" });

      clearAllLocalData();

      const summary = getStorageSummary();
      expect(summary.hasSavedLedger).toBe(false);
      expect(summary.nudgeCount).toBe(0);
      expect(summary.businessName).toBeUndefined();
    });
  });
});
