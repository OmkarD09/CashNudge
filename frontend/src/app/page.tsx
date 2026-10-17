"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LedgerAnalysisResult, InvoicePrediction } from "@/types";
import { getSampleLedger, checkHealth, ApiClientError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { CashFlowOverview } from "@/components/CashFlowOverview";
import { InvoiceTable } from "@/components/InvoiceTable";
import { CsvUploadZone } from "@/components/CsvUploadZone";
import { FollowupComposerDrawer } from "@/components/FollowupComposerDrawer";
import { ProviderBadge } from "@/components/ProviderBadge";
import { AlertTriangleIcon, RefreshCwIcon, ShieldCheckIcon } from "@/components/icons";

export default function DashboardPage() {
  const [data, setData] = useState<LedgerAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [isCustomLedger, setIsCustomLedger] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePrediction | null>(null);

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

  useEffect(() => {
    let ignore = false;

    async function initialize() {
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

      try {
        const result = await getSampleLedger();
        if (!ignore) {
          setData(result);
          setIsCustomLedger(false);
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

    initialize();

    return () => {
      ignore = true;
    };
  }, []);

  const handleCustomUploadSuccess = (result: LedgerAnalysisResult) => {
    setData(result);
    setIsCustomLedger(true);
  };

  const handleResetBenchmark = () => {
    loadSampleLedger();
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
                loadSampleLedger();
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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111111]">
                    {isCustomLedger ? "Custom Ledger Analysis" : "Receivables Risk Dashboard"}
                  </h1>
                  {isCustomLedger ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E1F3FE] text-[#1F6C9F] border border-[rgba(31,108,159,0.2)]">
                      User Ledger
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#555555] border border-[#EAEAEA]">
                      Benchmark Sample
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#787774] mt-0.5">
                  Real-time invoice risk quantification & nudge generation for independent operators.
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
                    Open Invoices ({data.predictions.length})
                  </h2>
                  <p className="text-xs text-[#787774]">
                    Select any invoice to inspect risk parameters or generate a follow-up reminder.
                  </p>
                </div>
              </div>

              <InvoiceTable
                predictions={data.predictions}
                onDraftFollowup={(inv) => setSelectedInvoice(inv)}
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
      />

      {/* Footer */}
      <footer className="w-full border-t border-[#EAEAEA] bg-[#FFFFFF] py-4 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#787774]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#111111]">CashNudge</span>
            <span>&bull;</span>
            <span>Know the risk. Nudge the payment.</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <ShieldCheckIcon size={12} className="text-[#346538]" />
            <span>TabPFN + Gemma Open-Weight Intelligence &bull; Zero PII Leakage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
