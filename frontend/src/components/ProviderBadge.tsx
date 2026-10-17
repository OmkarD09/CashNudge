import React from "react";
import { InfoIcon, ShieldCheckIcon } from "./icons";

interface ProviderBadgeProps {
  provider?: string;
  isSynthetic?: boolean;
}

export function ProviderBadge({
  provider = "Prior Labs Hosted TabPFN API",
  isSynthetic = true,
}: ProviderBadgeProps) {
  const isTabPFNHosted =
    provider.toLowerCase().includes("priorlabs") ||
    provider.toLowerCase().includes("tabpfn") ||
    provider.toLowerCase().includes("cloud");

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#555555]">
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#F7F6F3] border border-[#EAEAEA] font-mono-numbers">
        <ShieldCheckIcon size={13} className="text-[#346538]" />
        <span className="font-medium text-[#111111]">Engine:</span>
        <span>{provider}</span>
      </div>

      {isSynthetic && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#FBF3DB] border border-[rgba(149,100,0,0.15)] text-[#956400]">
          <InfoIcon size={13} />
          <span>Synthetic benchmark data (experimental estimate)</span>
        </div>
      )}
    </div>
  );
}
