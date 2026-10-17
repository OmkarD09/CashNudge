import React from "react";
import { LedgerCashFlowSummary } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/api";
import { ShieldCheckIcon, AlertTriangleIcon, ShieldAlertIcon, InfoIcon } from "./icons";

interface CashFlowOverviewProps {
  summary: LedgerCashFlowSummary;
}

export function CashFlowOverview({ summary }: CashFlowOverviewProps) {
  const total = summary.total_outstanding_amount || 0;
  const low = summary.low_risk_amount || 0;
  const medium = summary.medium_risk_amount || 0;
  const high = summary.high_risk_amount || 0;
  const atRisk = summary.at_risk_amount || 0;

  const lowPct = total > 0 ? (low / total) * 100 : 0;
  const medPct = total > 0 ? (medium / total) * 100 : 0;
  const highPct = total > 0 ? (high / total) * 100 : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#111111]">
            Cash-Flow Exposure Overview
          </h2>
          <p className="text-xs text-[#787774] mt-0.5">
            Model-estimated risk identifies payment friction likelihood. It is not an assertion of overdue status.
          </p>
        </div>
        <div className="text-xs text-[#555555] font-mono-numbers">
          Active Invoices:{" "}
          <span className="font-semibold text-[#111111]">
            {summary.outstanding_invoices_count}
          </span>{" "}
          of {summary.total_invoices} total
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Outstanding */}
        <div className="card-minimal p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#555555]">
            <span className="font-medium uppercase tracking-wider text-[11px]">
              Total Outstanding
            </span>
            <span className="text-[11px] font-mono-numbers text-[#787774]">
              {summary.outstanding_invoices_count} open
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111111] font-mono-numbers">
              {formatCurrency(total)}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">
              Total uncollected receivables across open invoices
            </p>
          </div>
        </div>

        {/* Card 2: Low-Risk Exposure */}
        <div className="card-minimal p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wider text-[11px] text-[#346538]">
              Low Risk (Safe)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers font-medium text-[#346538] bg-[#EDF3EC] px-1.5 py-0.5 rounded">
              <ShieldCheckIcon size={12} />
              {lowPct.toFixed(0)}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111111] font-mono-numbers">
              {formatCurrency(low)}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">
              High confidence of timely settlement
            </p>
          </div>
        </div>

        {/* Card 3: Medium-Risk Exposure */}
        <div className="card-minimal p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wider text-[11px] text-[#956400]">
              Medium Risk (Watch)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers font-medium text-[#956400] bg-[#FBF3DB] px-1.5 py-0.5 rounded">
              <AlertTriangleIcon size={12} />
              {medPct.toFixed(0)}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111111] font-mono-numbers">
              {formatCurrency(medium)}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">
              Elevated risk; gentle reminder recommended
            </p>
          </div>
        </div>

        {/* Card 4: High-Risk Exposure */}
        <div className="card-minimal p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wider text-[11px] text-[#9F2F2D]">
              High Risk (Critical)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono-numbers font-medium text-[#9F2F2D] bg-[#FDEBEC] px-1.5 py-0.5 rounded">
              <ShieldAlertIcon size={12} />
              {highPct.toFixed(0)}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111111] font-mono-numbers">
              {formatCurrency(high)}
            </div>
            <p className="text-[11px] text-[#787774] mt-1">
              High probability of delay; prompt follow-up needed
            </p>
          </div>
        </div>
      </div>

      {/* Visual Risk Exposure Bar */}
      <div className="card-minimal p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs text-[#555555] mb-2.5">
          <span className="font-medium">Portfolio Risk Allocation</span>
          <span className="font-mono-numbers text-[11px] text-[#787774]">
            Total at risk:{" "}
            <strong className="text-[#9F2F2D]">
              {formatCurrency(atRisk)}
            </strong>{" "}
            ({total > 0 ? ((atRisk / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>

        {/* Segmented Bar */}
        <div className="h-3 w-full rounded-md overflow-hidden bg-[#F2F1ED] flex gap-[2px]">
          {lowPct > 0 && (
            <div
              style={{ width: `${lowPct}%` }}
              className="bg-[#699E6E] h-full transition-all duration-300 relative group cursor-pointer"
              title={`Low Risk: ${formatCurrency(low)} (${lowPct.toFixed(1)}%)`}
            />
          )}
          {medPct > 0 && (
            <div
              style={{ width: `${medPct}%` }}
              className="bg-[#D9A74A] h-full transition-all duration-300 relative group cursor-pointer"
              title={`Medium Risk: ${formatCurrency(medium)} (${medPct.toFixed(1)}%)`}
            />
          )}
          {highPct > 0 && (
            <div
              style={{ width: `${highPct}%` }}
              className="bg-[#CE5C5A] h-full transition-all duration-300 relative group cursor-pointer"
              title={`High Risk: ${formatCurrency(high)} (${highPct.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs mt-3 pt-3 border-t border-[#F2F1ED]">
          <div className="flex items-center gap-4 text-[11px] text-[#555555]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#699E6E]" />
              Safe Cash ({formatCurrency(low)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9A74A]" />
              Watchlist ({formatCurrency(medium)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CE5C5A]" />
              High Risk ({formatCurrency(high)})
            </span>
          </div>

          {summary.historical_invoices_count > 0 && (
            <div className="text-[11px] text-[#787774] font-mono-numbers">
              Baseline late payment rate:{" "}
              {formatPercent(summary.historical_late_rate)} (
              {summary.historical_late_count} of {summary.historical_invoices_count}{" "}
              settled invoices)
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
