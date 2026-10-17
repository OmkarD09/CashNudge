import React from "react";
import { RefreshCwIcon, UploadCloudIcon } from "./icons";

interface NavbarProps {
  isApiHealthy: boolean | null;
  isCheckingHealth: boolean;
  onRefreshHealth: () => void;
  onOpenUpload: () => void;
  onResetBenchmark: () => void;
  isCustomLedger: boolean;
}

export function Navbar({
  isApiHealthy,
  isCheckingHealth,
  onRefreshHealth,
  onOpenUpload,
  onResetBenchmark,
  isCustomLedger,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#EAEAEA] bg-[#FBFBFA]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] text-[#FBFBFA] shadow-xs font-semibold text-sm">
            CN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-base text-[#111111]">
                CashNudge
              </span>
              <span className="hidden sm:inline-block rounded px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider font-medium bg-[#F2F1ED] text-[#555555] border border-[#EAEAEA]">
                Phase 3
              </span>
            </div>
            <p className="text-xs text-[#787774] hidden md:block">
              Know the risk. Nudge the payment.
            </p>
          </div>
        </div>

        {/* Right Actions & Health Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* API Health Pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-[#EAEAEA] bg-[#FFFFFF]"
            title={
              isApiHealthy === null
                ? "Checking CashNudge API status..."
                : isApiHealthy
                ? "FastAPI server running at http://127.0.0.1:8000"
                : "Cannot reach backend. Make sure uvicorn is running."
            }
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isCheckingHealth
                  ? "bg-amber-400 animate-pulse"
                  : isApiHealthy
                  ? "bg-emerald-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="font-mono text-[11px] text-[#555555] hidden sm:inline">
              {isCheckingHealth
                ? "Connecting..."
                : isApiHealthy
                ? "API Connected"
                : "API Offline"}
            </span>
            {!isApiHealthy && !isCheckingHealth && (
              <button
                onClick={onRefreshHealth}
                className="ml-1 text-[#9F2F2D] hover:underline flex items-center gap-1 font-medium"
                aria-label="Retry API connection"
              >
                <RefreshCwIcon size={11} />
                <span>Retry</span>
              </button>
            )}
          </div>

          {/* Ledger mode switch button if custom ledger loaded */}
          {isCustomLedger && (
            <button
              onClick={onResetBenchmark}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[#555555] bg-[#FFFFFF] border border-[#EAEAEA] hover:bg-[#F7F6F3] transition-colors"
              title="Return to the synthetic benchmark ledger"
            >
              <RefreshCwIcon size={12} />
              <span className="hidden sm:inline">Reset to Benchmark</span>
              <span className="sm:hidden">Reset</span>
            </button>
          )}

          {/* Import CSV trigger */}
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[#FBFBFA] bg-[#111111] hover:bg-[#2A2A2A] shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloudIcon size={13} />
            <span>Import CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
}
