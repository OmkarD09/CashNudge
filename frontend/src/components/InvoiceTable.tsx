import React, { useState, useMemo } from "react";
import { InvoicePrediction, RiskTier } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/api";
import {
  ShieldAlertIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  SparklesIcon,
  SearchIcon,
  ArrowUpDownIcon,
  InfoIcon,
} from "./icons";

interface InvoiceTableProps {
  predictions: InvoicePrediction[];
  onDraftFollowup: (invoice: InvoicePrediction) => void;
}

type SortField = "amount" | "risk" | "id" | "client";
type SortDirection = "asc" | "desc";

export function InvoiceTable({
  predictions,
  onDraftFollowup,
}: InvoiceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("risk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredAndSortedInvoices = useMemo(() => {
    let result = [...predictions];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoice_id.toLowerCase().includes(q) ||
          inv.client_name.toLowerCase().includes(q) ||
          inv.top_risk_factors.some((f) => f.toLowerCase().includes(q))
      );
    }

    // Filter by tier
    if (selectedTier !== "all") {
      result = result.filter((inv) => inv.risk_tier === selectedTier);
    }

    // Sort
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
            placeholder="Search by client or invoice ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[#EAEAEA] bg-[#FBFBFA] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#111111] transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[#EAEAEA] bg-[#F7F6F3] text-xs">
          {(["all", "high", "medium", "low"] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                selectedTier === tier
                  ? "bg-[#FFFFFF] text-[#111111] shadow-xs"
                  : "text-[#787774] hover:text-[#111111]"
              }`}
            >
              {tier === "all" ? `All (${predictions.length})` : tier}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
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
                Terms
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
                  No invoices found matching &ldquo;{searchQuery}&rdquo;
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
                          <span className="text-[#D9383A] font-medium">({inv.days_overdue}d late)</span>
                        ) : inv.due_status === "due_today" ? (
                          <span className="text-[#B25900] font-medium">(today)</span>
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
                    <button
                      onClick={() => onDraftFollowup(inv)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        inv.risk_tier === "high"
                          ? "bg-[#111111] text-[#FBFBFA] hover:bg-[#2A2A2A] shadow-2xs"
                          : "bg-[#FFFFFF] text-[#111111] border border-[#EAEAEA] hover:bg-[#F7F6F3]"
                      }`}
                      title={`Draft payment nudge for ${inv.client_name}`}
                    >
                      <SparklesIcon size={12} className={inv.risk_tier === "high" ? "text-amber-300" : "text-[#787774]"} />
                      <span>Draft Nudge</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 border-t border-[#EAEAEA] bg-[#F7F6F3]/40 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#787774] gap-2">
        <div className="flex items-center gap-1.5">
          <InfoIcon size={13} />
          <span>
            Predictions represent statistical risk based on historical settlement speed and invoice parameters.
          </span>
        </div>
        <div className="font-mono-numbers">
          Showing {filteredAndSortedInvoices.length} of {predictions.length} invoices
        </div>
      </div>
    </div>
  );
}
