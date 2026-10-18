import React, { useState, useMemo } from "react";
import { InvoicePrediction, RiskTier, NudgeRecord, HistoricalInvoiceRecord } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/api";
import {
  ShieldAlertIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  SparklesIcon,
  SearchIcon,
  ArrowUpDownIcon,
  InfoIcon,
  CheckIcon,
  ClockIcon,
} from "./icons";

interface InvoiceTableProps {
  predictions: InvoicePrediction[];
  historicalInvoices?: HistoricalInvoiceRecord[];
  onDraftFollowup: (invoice: InvoicePrediction) => void;
  nudgeHistoryMap?: Record<string, NudgeRecord[]>;
  onOpenUpload?: () => void;
}

type SortField = "amount" | "risk" | "id" | "client" | "days";
type SortDirection = "asc" | "desc";

export function InvoiceTable({
  predictions,
  historicalInvoices = [],
  onDraftFollowup,
  nudgeHistoryMap,
  onOpenUpload,
}: InvoiceTableProps) {
  // If there are zero predictions but we have historical invoices, default activeTab to "settled"
  const defaultTab = predictions.length === 0 && historicalInvoices.length > 0 ? "settled" : "open";
  const [activeTab, setActiveTab] = useState<"open" | "settled">(defaultTab);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedHistStatus, setSelectedHistStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("risk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Keep active tab in sync if predictions arrive or vanish
  React.useEffect(() => {
    if (predictions.length === 0 && historicalInvoices.length > 0) {
      setActiveTab("settled");
    } else if (predictions.length > 0 && activeTab === "settled" && historicalInvoices.length === 0) {
      setActiveTab("open");
    }
  }, [predictions.length, historicalInvoices.length]);

  // Filtered & sorted open invoice predictions
  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...predictions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_id.toLowerCase().includes(q) ||
          inv.client_name.toLowerCase().includes(q) ||
          inv.top_risk_factors.some((f) => f.toLowerCase().includes(q))
      );
    }

    if (selectedTier !== "all") {
      result = result.filter((inv) => inv.risk_tier === selectedTier);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "amount") {
        comparison = a.invoice_amount - b.invoice_amount;
      } else if (sortField === "risk") {
        comparison = a.late_probability - b.late_probability;
      } else if (sortField === "id") {
        comparison = a.invoice_id.localeCompare(b.invoice_id);
      } else if (sortField === "client") {
        comparison = a.client_name.localeCompare(b.client_name);
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return result;
  }, [predictions, searchQuery, selectedTier, sortField, sortDirection]);

  // Filtered & sorted historical invoices
  const filteredAndSortedHistorical = useMemo(() => {
    let result = [...historicalInvoices];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_id.toLowerCase().includes(q) ||
          inv.client_name.toLowerCase().includes(q) ||
          (inv.project_category && inv.project_category.toLowerCase().includes(q)) ||
          (inv.client_tier && inv.client_tier.toLowerCase().includes(q))
      );
    }

    if (selectedHistStatus !== "all") {
      result = result.filter((inv) => inv.status === selectedHistStatus);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "amount") {
        comparison = a.invoice_amount - b.invoice_amount;
      } else if (sortField === "id") {
        comparison = a.invoice_id.localeCompare(b.invoice_id);
      } else if (sortField === "client") {
        comparison = a.client_name.localeCompare(b.client_name);
      } else if (sortField === "days") {
        const daysA = a.actual_days_to_pay ?? a.payment_terms_days;
        const daysB = b.actual_days_to_pay ?? b.payment_terms_days;
        comparison = daysA - daysB;
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return result;
  }, [historicalInvoices, searchQuery, selectedHistStatus, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getRiskBadge = (tier: RiskTier, prob: number) => {
    if (tier === "high") {
      return (
        <span className="badge-high inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold">
          <ShieldAlertIcon size={13} />
          <span>High Risk ({formatPercent(prob)})</span>
        </span>
      );
    }
    if (tier === "medium") {
      return (
        <span className="badge-medium inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold">
          <AlertTriangleIcon size={13} />
          <span>Medium Risk ({formatPercent(prob)})</span>
        </span>
      );
    }
    return (
      <span className="badge-low inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold">
        <ShieldCheckIcon size={13} />
        <span>Low Risk ({formatPercent(prob)})</span>
      </span>
    );
  };

  return (
    <div className="card-minimal overflow-hidden">
      {/* Primary Tab Selector (Open Invoices vs Settled History) */}
      {historicalInvoices.length > 0 && (
        <div className="flex items-center border-b border-[#EAEAEA] bg-[#FBFBFA] px-4 pt-2.5 gap-2">
          <button
            onClick={() => setActiveTab("open")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "open"
                ? "border-[#111111] text-[#111111]"
                : "border-transparent text-[#787774] hover:text-[#111111]"
            }`}
          >
            <span>Open Invoices</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "open"
                  ? "bg-[#111111] text-[#FBFBFA]"
                  : "bg-[#EAEAEA] text-[#555555]"
              }`}
            >
              {predictions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("settled")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "settled"
                ? "border-[#111111] text-[#111111]"
                : "border-transparent text-[#787774] hover:text-[#111111]"
            }`}
          >
            <ClockIcon size={12} />
            <span>Settled Ledger History</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "settled"
                  ? "bg-[#111111] text-[#FBFBFA]"
                  : "bg-[#EAEAEA] text-[#555555]"
              }`}
            >
              {historicalInvoices.length}
            </span>
          </button>
        </div>
      )}

      {/* Informative Banner when 100% of imported ledger invoices are settled */}
      {predictions.length === 0 && historicalInvoices.length > 0 && (
        <div className="mx-4 mt-4 p-3 rounded-md bg-[#EDF6EE] border border-[rgba(52,101,56,0.2)] text-xs text-[#346538] flex items-start gap-2">
          <ShieldCheckIcon size={16} className="shrink-0 mt-0.5 text-[#346538]" />
          <div>
            <span className="font-semibold">All {historicalInvoices.length} invoices in this file are marked as settled/paid. </span>
            <span className="text-[#346538]/90">
              TabPFN successfully trained its payment-timing priors on this historical dataset. To generate late-payment risk predictions, include open invoices with an empty <code>is_paid_late</code> status.
            </span>
          </div>
        </div>
      )}

      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-[#EAEAEA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <SearchIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787774]"
          />
          <input
            type="text"
            placeholder={
              activeTab === "open"
                ? "Search by client or invoice ID..."
                : "Search historical invoices by client or ID..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[#EAEAEA] bg-[#FBFBFA] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#111111] transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        {activeTab === "open" ? (
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[#EAEAEA] bg-[#F7F6F3] text-xs">
            {(["all", "high", "medium", "low"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                  selectedTier === tier
                    ? "bg-[#FFFFFF] text-[#111111] shadow-xs"
                    : "text-[#787774] hover:text-[#111111]"
                }`}
              >
                {tier === "all" ? `All (${predictions.length})` : tier}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[#EAEAEA] bg-[#F7F6F3] text-xs">
            {[
              { id: "all", label: `All (${historicalInvoices.length})` },
              {
                id: "paid_on_time",
                label: `On Time (${
                  historicalInvoices.filter((i) => i.status === "paid_on_time").length
                })`,
              },
              {
                id: "paid_late",
                label: `Paid Late (${
                  historicalInvoices.filter((i) => i.status === "paid_late").length
                })`,
              },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedHistStatus(st.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  selectedHistStatus === st.id
                    ? "bg-[#FFFFFF] text-[#111111] shadow-xs"
                    : "text-[#787774] hover:text-[#111111]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW: OPEN INVOICES */}
      {activeTab === "open" && (
        <>
          {predictions.length === 0 ? (
            <div className="py-12 px-6 text-center max-w-md mx-auto">
              <div className="inline-flex p-3 rounded-full bg-[#EDF6EE] text-[#346538] mb-3">
                <CheckIcon size={24} />
              </div>
              <h3 className="font-semibold text-sm text-[#111111]">
                No Open Invoices in Ledger
              </h3>
              <p className="text-xs text-[#787774] mt-1.5 mb-4">
                {historicalInvoices.length > 0
                  ? `All ${historicalInvoices.length} invoices in your imported file have been settled. Inspect your payment history tab or upload pending invoices.`
                  : "No open invoices found. Upload a CSV ledger containing outstanding invoices to calculate risk predictions."}
              </p>
              <div className="flex items-center justify-center gap-2">
                {historicalInvoices.length > 0 && (
                  <button
                    onClick={() => setActiveTab("settled")}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#111111] text-[#FBFBFA] hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                  >
                    View Settled History ({historicalInvoices.length})
                  </button>
                )}
                {onOpenUpload && (
                  <button
                    onClick={onOpenUpload}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#EAEAEA] text-[#111111] hover:bg-[#F7F6F3] transition-colors cursor-pointer"
                  >
                    Upload Another CSV
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-[#F7F6F3]/60 text-[#555555]">
                    <th
                      onClick={() => handleSort("id")}
                      className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Invoice</span>
                        <ArrowUpDownIcon size={12} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("client")}
                      className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Client</span>
                        <ArrowUpDownIcon size={12} />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Terms / Due Date
                    </th>
                    <th
                      onClick={() => handleSort("amount")}
                      className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] text-right cursor-pointer hover:text-[#111111] select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        <ArrowUpDownIcon size={12} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("risk")}
                      className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Risk Assessment</span>
                        <ArrowUpDownIcon size={12} />
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-[11px]">
                      Top Predictive Factors
                    </th>
                    <th className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {filteredAndSortedInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-[#787774] text-xs"
                      >
                        {searchQuery.trim()
                          ? `No open invoices found matching "${searchQuery}"`
                          : "No open invoices match the selected filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedInvoices.map((inv) => (
                      <tr
                        key={inv.invoice_id}
                        className="hover:bg-[#FBFBFA] transition-colors group"
                      >
                        {/* Invoice ID */}
                        <td className="py-3.5 px-4 font-mono-numbers font-medium text-[#111111]">
                          {inv.invoice_id}
                        </td>

                        {/* Client Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#111111]">
                            {inv.client_name}
                          </div>
                          {nudgeHistoryMap &&
                            nudgeHistoryMap[inv.invoice_id] &&
                            nudgeHistoryMap[inv.invoice_id].length > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#346538] font-medium">
                                <CheckIcon size={11} />
                                <span>
                                  Nudged {nudgeHistoryMap[inv.invoice_id].length}x (last{" "}
                                  {new Date(
                                    nudgeHistoryMap[inv.invoice_id][
                                      nudgeHistoryMap[inv.invoice_id].length - 1
                                    ].timestamp
                                  ).toLocaleDateString()}
                                  )
                                </span>
                              </div>
                            )}
                        </td>

                        {/* Payment Terms & Due Date */}
                        <td className="py-3.5 px-4 text-[#555555] font-mono-numbers">
                          <div>
                            {inv.payment_terms_days ? (
                              `Net ${inv.payment_terms_days}`
                            ) : (
                              <span className="text-[#A3A3A0] italic">Not set</span>
                            )}
                          </div>
                          {inv.due_date && (
                            <div className="text-[11px] text-[#787774] flex items-center gap-1 mt-0.5">
                              <span>Due {inv.due_date}</span>
                              {inv.due_status === "overdue" && inv.days_overdue ? (
                                <span className="text-[#D9383A] font-medium">
                                  ({inv.days_overdue}d late)
                                </span>
                              ) : inv.due_status === "due_today" ? (
                                <span className="text-[#B25900] font-medium">
                                  (today)
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right font-mono-numbers font-semibold text-[#111111]">
                          {formatCurrency(inv.invoice_amount)}
                        </td>

                        {/* Risk Tier & Probability */}
                        <td className="py-3.5 px-4">
                          {getRiskBadge(inv.risk_tier, inv.late_probability)}
                        </td>

                        {/* Risk Factors */}
                        <td className="py-3.5 px-4">
                          {inv.top_risk_factors && inv.top_risk_factors.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {inv.top_risk_factors.map((factor, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-1.5 py-0.5 rounded bg-[#F2F1ED] text-[#555555] text-[10px] leading-tight"
                                  title={factor}
                                >
                                  {factor}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#A3A3A0] text-[11px] italic">
                              Standard risk profile
                            </span>
                          )}
                        </td>

                        {/* Action button */}
                        <td className="py-3.5 px-4 text-right">
                          {(() => {
                            const isNudged = !!(
                              nudgeHistoryMap &&
                              nudgeHistoryMap[inv.invoice_id]?.length
                            );
                            return (
                              <button
                                onClick={() => onDraftFollowup(inv)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  inv.risk_tier === "high"
                                    ? "bg-[#111111] text-[#FBFBFA] hover:bg-[#2A2A2A] shadow-2xs"
                                    : "bg-[#FFFFFF] text-[#111111] border border-[#EAEAEA] hover:bg-[#F7F6F3]"
                                }`}
                                title={`Draft payment nudge for ${inv.client_name}`}
                              >
                                <SparklesIcon
                                  size={12}
                                  className={
                                    inv.risk_tier === "high"
                                      ? "text-amber-300"
                                      : "text-[#787774]"
                                  }
                                />
                                <span>{isNudged ? "Nudge Again" : "Draft Nudge"}</span>
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="p-3 border-t border-[#EAEAEA] bg-[#F7F6F3]/40 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#787774] gap-2">
            <div className="flex items-center gap-1.5">
              <InfoIcon size={13} />
              <span>
                Predictions represent statistical risk based on historical settlement speed and invoice parameters.
              </span>
            </div>
            <div className="font-mono-numbers">
              Showing {filteredAndSortedInvoices.length} of {predictions.length} open invoices
            </div>
          </div>
        </>
      )}

      {/* VIEW: SETTLED LEDGER HISTORY */}
      {activeTab === "settled" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EAEAEA] bg-[#F7F6F3]/60 text-[#555555]">
                  <th
                    onClick={() => handleSort("id")}
                    className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Invoice</span>
                      <ArrowUpDownIcon size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("client")}
                    className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Client & Category</span>
                      <ArrowUpDownIcon size={12} />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider text-[11px]">
                    Payment Terms
                  </th>
                  <th
                    onClick={() => handleSort("days")}
                    className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] cursor-pointer hover:text-[#111111] select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Settlement Speed</span>
                      <ArrowUpDownIcon size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("amount")}
                    className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] text-right cursor-pointer hover:text-[#111111] select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Settled Amount</span>
                      <ArrowUpDownIcon size={12} />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-medium uppercase tracking-wider text-[11px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {filteredAndSortedHistorical.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-[#787774] text-xs"
                    >
                      {searchQuery.trim()
                        ? `No historical invoices found matching "${searchQuery}"`
                        : "No historical invoices match the selected filter."}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedHistorical.map((inv) => {
                    const days = inv.actual_days_to_pay ?? inv.payment_terms_days;
                    const diff = days - inv.payment_terms_days;
                    const isLate = inv.status === "paid_late" || diff > 0;

                    return (
                      <tr
                        key={inv.invoice_id}
                        className="hover:bg-[#FBFBFA] transition-colors group"
                      >
                        {/* Invoice ID */}
                        <td className="py-3.5 px-4 font-mono-numbers font-medium text-[#111111]">
                          {inv.invoice_id}
                        </td>

                        {/* Client Name & Category */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#111111]">
                            {inv.client_name}
                          </div>
                          {(inv.project_category || inv.client_tier) && (
                            <div className="text-[11px] text-[#787774] flex items-center gap-1.5 mt-0.5">
                              {inv.project_category && <span>{inv.project_category}</span>}
                              {inv.project_category && inv.client_tier && <span>•</span>}
                              {inv.client_tier && (
                                <span className="font-mono text-[10px] bg-[#F2F1ED] px-1.5 py-0.2 rounded">
                                  {inv.client_tier}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Terms */}
                        <td className="py-3.5 px-4 text-[#555555] font-mono-numbers">
                          Net {inv.payment_terms_days}
                        </td>

                        {/* Settlement Speed */}
                        <td className="py-3.5 px-4 font-mono-numbers">
                          {inv.actual_days_to_pay !== undefined &&
                          inv.actual_days_to_pay !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[#111111]">
                                {inv.actual_days_to_pay} days
                              </span>
                              {diff > 0 ? (
                                <span className="text-[11px] text-[#B25900] font-medium">
                                  (+{diff}d late)
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#346538] font-medium">
                                  (on time)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#787774] italic">Recorded</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right font-mono-numbers font-semibold text-[#111111]">
                          {formatCurrency(inv.invoice_amount)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {isLate ? (
                            <span className="badge-medium inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <AlertTriangleIcon size={12} />
                              <span>Paid Late</span>
                            </span>
                          ) : (
                            <span className="badge-low inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <ShieldCheckIcon size={12} />
                              <span>Paid On Time</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 border-t border-[#EAEAEA] bg-[#F7F6F3]/40 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#787774] gap-2">
            <div className="flex items-center gap-1.5">
              <CheckIcon size={13} className="text-[#346538]" />
              <span>
                Historical settled records utilized as in-context learning references by the TabPFN classifier.
              </span>
            </div>
            <div className="font-mono-numbers">
              Showing {filteredAndSortedHistorical.length} of {historicalInvoices.length} historical records
            </div>
          </div>
        </>
      )}
    </div>
  );
}
