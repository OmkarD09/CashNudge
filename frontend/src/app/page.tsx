"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LedgerAnalysisResult, InvoicePrediction, NudgeRecord, UserProfile } from "@/types";
import { getSampleLedger, checkHealth, ApiClientError } from "@/lib/api";
import {
  getSavedCustomLedger,
  saveCustomLedger,
  getNudgeHistory,
  recordNudgeAction,
  getUserProfile,
} from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { CashFlowOverview } from "@/components/CashFlowOverview";
import { InvoiceTable } from "@/components/InvoiceTable";
import { CsvUploadZone } from "@/components/CsvUploadZone";
import { FollowupComposerDrawer } from "@/components/FollowupComposerDrawer";
import { LocalStorageModal } from "@/components/LocalStorageModal";
import { ProviderBadge } from "@/components/ProviderBadge";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  HardDriveIcon,
} from "@/components/icons";

export default function DashboardPage() {
  const [data, setData] = useState<LedgerAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [isCustomLedger, setIsCustomLedger] = useState(false);
  const [hasSavedCustomLedger, setHasSavedCustomLedger] = useState(false);
  const [savedLedgerMeta, setSavedLedgerMeta] = useState<{
    fileName: string;
    savedAt: string;
  } | null>(null);

  const [nudgeHistory, setNudgeHistory] = useState<NudgeRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({});

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePrediction | null>(null);

  // Group nudges by invoiceId for fast lookup in InvoiceTable & FollowupComposer
  const nudgeHistoryMap = useMemo(() => {
    const map: Record<string, NudgeRecord[]> = {};
    for (const item of nudgeHistory) {
      if (!map[item.invoiceId]) {
        map[item.invoiceId] = [];
      }
      map[item.invoiceId].push(item);
    }
    return map;
  }, [nudgeHistory]);

  // Health check handler
  const verifyHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await checkHealth();
      setIsApiHealthy(true);
      setConnectionError(null);
    } catch {
      setIsApiHealthy(false);
      setConnectionError(
        "Could not establish connection to CashNudge API (http://127.0.0.1:8000). Please verify the backend service is running."
      );
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Load sample benchmark data
  const loadSampleLedger = useCallback(async () => {
    setIsLoading(true);
    setConnectionError(null);
    try {
      const result = await getSampleLedger();
      setData(result);
      setIsCustomLedger(false);
      setIsApiHealthy(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setConnectionError(err.message);
      } else {
        setConnectionError("Failed to fetch initial ledger data from backend.");
      }
      setIsApiHealthy(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore saved custom ledger from browser storage
  const restoreSavedLedger = useCallback(() => {
    const saved = getSavedCustomLedger();
    if (saved && saved.result) {
      setData(saved.result);
      setIsCustomLedger(true);
      setHasSavedCustomLedger(true);
      setSavedLedgerMeta({ fileName: saved.fileName, savedAt: saved.savedAt });
      return true;
    }
    return false;
  }, []);

  // Initial mount: check health, check browser storage, and load ledger
  useEffect(() => {
    let ignore = false;

    async function initialize() {
      // 1. Load client-side persistent storage first (instant, zero network)
      const initialNudges = getNudgeHistory();
      const initialProfile = getUserProfile();
      if (!ignore) {
        setNudgeHistory(initialNudges);
        setUserProfile(initialProfile);
      }

      const saved = getSavedCustomLedger();
      let hasRestoredFromStorage = false;

      if (saved && saved.result) {
        if (!ignore) {
          setData(saved.result);
          setIsCustomLedger(true);
          setHasSavedCustomLedger(true);
          setSavedLedgerMeta({ fileName: saved.fileName, savedAt: saved.savedAt });
          setIsLoading(false);
        }
        hasRestoredFromStorage = true;
      }

      // 2. Asynchronously verify backend health
      try {
        await checkHealth();
        if (!ignore) {
          setIsApiHealthy(true);
          setConnectionError(null);
        }
      } catch {
        if (!ignore) {
          setIsApiHealthy(false);
          setConnectionError(
            "Could not establish connection to CashNudge API (http://127.0.0.1:8000). Please verify the backend service is running."
          );
        }
      }

      // 3. If no custom ledger in browser storage, fetch sample benchmark from API
      if (!hasRestoredFromStorage) {
        try {
          const result = await getSampleLedger();
          if (!ignore) {
            setData(result);
            setIsCustomLedger(false);
            setHasSavedCustomLedger(false);
            setIsApiHealthy(true);
          }
        } catch (err: unknown) {
          if (!ignore) {
            if (err instanceof ApiClientError) {
              setConnectionError(err.message);
            } else {
              setConnectionError("Failed to fetch initial ledger data from backend.");
            }
            setIsApiHealthy(false);
          }
        } finally {
          if (!ignore) {
            setIsLoading(false);
          }
        }
      }
    }

    initialize();

    return () => {
      ignore = true;
    };
  }, []);

  // Handle custom CSV upload success
  const handleCustomUploadSuccess = (result: LedgerAnalysisResult) => {
    const name = (result.metadata?.file_name as string) || "uploaded_ledger.csv";
    saveCustomLedger(result, name);
    setData(result);
    setIsCustomLedger(true);
    setHasSavedCustomLedger(true);
    setSavedLedgerMeta({ fileName: name, savedAt: new Date().toISOString() });
  };

  // Reset to benchmark sample
  const handleResetBenchmark = () => {
    loadSampleLedger();
  };

  // Record a follow-up action (email or copy)
  const handleRecordNudgeAction = (action: Omit<NudgeRecord, "id" | "timestamp">) => {
    const newRecord = recordNudgeAction(action);
    if (newRecord) {
      setNudgeHistory(getNudgeHistory());
    }
  };

  // Refresh state when LocalStorageModal imports or clears data
  const handleStorageDataChanged = () => {
    const saved = getSavedCustomLedger();
    if (saved && saved.result) {
      setData(saved.result);
      setIsCustomLedger(true);
      setHasSavedCustomLedger(true);
      setSavedLedgerMeta({ fileName: saved.fileName, savedAt: saved.savedAt });
    } else {
      setHasSavedCustomLedger(false);
      setSavedLedgerMeta(null);
      if (isCustomLedger) {
        loadSampleLedger();
      }
    }
    setNudgeHistory(getNudgeHistory());
    setUserProfile(getUserProfile());
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#111111]">
      {/* Top Navigation */}
      <Navbar
        isApiHealthy={isApiHealthy}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={verifyHealth}
        onOpenUpload={() => setIsUploadOpen(true)}
        onResetBenchmark={handleResetBenchmark}
        isCustomLedger={isCustomLedger}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        hasSavedLedger={hasSavedCustomLedger}
      />

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Connection Failure Banner */}
        {connectionError && (
          <div className="card-minimal border-[rgba(159,47,45,0.2)] bg-[#FDEBEC] p-4 text-xs text-[#9F2F2D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon size={16} className="shrink-0" />
              <div>
                <span className="font-semibold">Backend Unreachable: </span>
                <span>{connectionError}</span>
              </div>
            </div>
            <button
              onClick={() => {
                verifyHealth();
                if (!isCustomLedger) {
                  loadSampleLedger();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FFFFFF] border border-[rgba(159,47,45,0.3)] font-medium text-[#9F2F2D] hover:bg-[#FBF3DB] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCwIcon size={12} />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-6 w-64 bg-[#EAEAEA] rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-[#FFFFFF] border border-[#EAEAEA] rounded-lg p-5" />
              ))}
            </div>
            <div className="h-20 bg-[#FFFFFF] border border-[#EAEAEA] rounded-lg" />
            <div className="h-96 bg-[#FFFFFF] border border-[#EAEAEA] rounded-lg" />
          </div>
        )}

        {/* Dashboard Content */}
        {!isLoading && data && (
          <>
            {/* Context & Provider Attributions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#EAEAEA]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111111]">
                    {isCustomLedger ? "Custom Ledger Analysis" : "Receivables Risk Dashboard"}
                  </h1>
                  {isCustomLedger ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E1F3FE] text-[#1F6C9F] border border-[rgba(31,108,159,0.2)]">
                      {savedLedgerMeta ? `Saved: ${savedLedgerMeta.fileName}` : "User Ledger"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#555555] border border-[#EAEAEA]">
                      Benchmark Sample
                    </span>
                  )}

                  {/* Switch to saved ledger toggle if viewing benchmark while saved ledger exists */}
                  {!isCustomLedger && hasSavedCustomLedger && savedLedgerMeta && (
                    <button
                      onClick={restoreSavedLedger}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md bg-[#EDF6EE] border border-[rgba(52,101,56,0.2)] text-[#346538] hover:bg-[#E3F2E4] transition-colors cursor-pointer"
                      title="Switch back to your saved custom ledger"
                    >
                      <HardDriveIcon size={11} />
                      <span>Switch to Saved Ledger ({savedLedgerMeta.fileName})</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#787774] mt-0.5">
                  Real-time invoice risk quantification &amp; nudge generation for independent operators.
                </p>
              </div>

              {/* Provider Badge */}
              <ProviderBadge
                provider={data.metadata?.model_provider}
                isSynthetic={data.metadata?.is_synthetic_data}
              />
            </div>

            {/* Financial Overview (Bento + Distribution) */}
            <CashFlowOverview summary={data.summary} />

            {/* Invoices Risk Table */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-[#111111]">
                    {data.predictions.length > 0
                      ? `Invoices & Risk Analysis (${data.predictions.length} open${
                          data.historical_invoices && data.historical_invoices.length > 0
                            ? `, ${data.historical_invoices.length} historical`
                            : ""
                        })`
                      : `Settled Invoice Ledger (${data.historical_invoices?.length || 0} historical)`}
                  </h2>
                  <p className="text-xs text-[#787774]">
                    {data.predictions.length > 0
                      ? "Select any invoice to inspect risk parameters or generate a follow-up reminder."
                      : "All records in this dataset are settled historical invoices used for TabPFN calibration."}
                  </p>
                </div>
              </div>

              <InvoiceTable
                predictions={data.predictions}
                historicalInvoices={data.historical_invoices}
                onDraftFollowup={(inv) => setSelectedInvoice(inv)}
                nudgeHistoryMap={nudgeHistoryMap}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            </section>
          </>
        )}
      </main>

      {/* Upload Modal */}
      <CsvUploadZone
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleCustomUploadSuccess}
      />

      {/* Follow-up Composer Drawer */}
      <FollowupComposerDrawer
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onRecordAction={handleRecordNudgeAction}
        defaultBusinessName={userProfile.businessName}
        pastNudges={selectedInvoice ? nudgeHistoryMap[selectedInvoice.invoice_id] || [] : []}
      />

      {/* Local Storage & Privacy Modal */}
      <LocalStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onDataChanged={handleStorageDataChanged}
      />

      {/* Footer */}
      <footer className="w-full border-t border-[#EAEAEA] bg-[#FFFFFF] py-4 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#787774]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#111111]">CashNudge</span>
            <span>&bull;</span>
            <span>Know the risk. Nudge the payment.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsStorageModalOpen(true)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#555555] hover:text-[#111111] hover:underline cursor-pointer"
            >
              <HardDriveIcon size={12} className={hasSavedCustomLedger ? "text-[#346538]" : "text-[#787774]"} />
              <span>Browser Storage: 100% Local</span>
            </button>
            <span>&bull;</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <ShieldCheckIcon size={12} className="text-[#346538]" />
              <span>Zero PII Leakage</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
