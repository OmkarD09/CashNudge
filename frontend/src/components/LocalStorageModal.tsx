import React, { useState, useEffect, useRef } from "react";
import {
  getStorageSummary,
  exportLocalBackup,
  importLocalBackup,
  clearAllLocalData,
  getUserProfile,
  saveUserProfile,
} from "@/lib/storage";
import { StorageSummary } from "@/types";
import {
  XIcon,
  ShieldCheckIcon,
  HardDriveIcon,
  Trash2Icon,
  DownloadIcon,
  UploadIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "./icons";

interface LocalStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export function LocalStorageModal({
  isOpen,
  onClose,
  onDataChanged,
}: LocalStorageModalProps) {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const currentSummary = getStorageSummary();
      setSummary(currentSummary);
      setBusinessName(currentSummary.businessName || "");
      setConfirmClearOpen(false);
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserProfile({ businessName: businessName.trim() || undefined });
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
    setSummary(getStorageSummary());
    onDataChanged();
  };

  const handleExportBackup = () => {
    const jsonStr = exportLocalBackup();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split("T")[0];
    const link = document.createElement("a");
    link.href = url;
    link.download = `cashnudge-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = importLocalBackup(content);
        if (res.success) {
          setImportStatus({
            success: true,
            message: "Backup successfully restored!",
          });
          setSummary(getStorageSummary());
          const prof = getUserProfile();
          setBusinessName(prof.businessName || "");
          onDataChanged();
        } else {
          setImportStatus({
            success: false,
            message: res.error || "Failed to restore backup.",
          });
        }
      } catch {
        setImportStatus({
          success: false,
          message: "Failed to read backup file.",
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearAll = () => {
    clearAllLocalData();
    setConfirmClearOpen(false);
    setSummary(getStorageSummary());
    setBusinessName("");
    onDataChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="w-full max-w-lg card-minimal bg-[#FFFFFF] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAEAEA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-[#111111] text-[#FBFBFA]">
              <HardDriveIcon size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#111111]">
                Browser Storage &amp; Privacy
              </h3>
              <p className="text-xs text-[#787774]">
                100% Client-Side Persistence &bull; Zero Server Retention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#787774] hover:text-[#111111] hover:bg-[#F2F1ED] transition-colors"
            aria-label="Close dialog"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Privacy Guarantee Card */}
          <div className="card-minimal border-[rgba(52,101,56,0.2)] bg-[#EDF6EE] p-3.5 flex items-start gap-3">
            <ShieldCheckIcon size={18} className="text-[#346538] shrink-0 mt-0.5" />
            <div className="text-xs text-[#346538] space-y-1">
              <div className="font-semibold text-[#111111]">
                Zero-Cloud Data Retention Guarantee
              </div>
              <p className="text-[#346538]/90 leading-relaxed">
                Your invoices, client names, and follow-up drafts reside
                exclusively in your browser&apos;s local storage. CashNudge operates
                statelessly and never saves financial records to a remote database.
              </p>
            </div>
          </div>

          {/* Storage Summary Bento */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA]">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#787774]">
                Saved Invoices
              </span>
              <div className="text-lg font-semibold text-[#111111] font-mono-numbers mt-0.5">
                {summary?.invoiceCount || 0}
              </div>
              <div className="text-[11px] text-[#787774] truncate mt-0.5">
                {summary?.savedLedgerName || "Benchmark sample"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA]">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#787774]">
                Logged Nudges
              </span>
              <div className="text-lg font-semibold text-[#111111] font-mono-numbers mt-0.5">
                {summary?.nudgeCount || 0}
              </div>
              <div className="text-[11px] text-[#787774] mt-0.5">
                Follow-ups logged
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA]">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#787774]">
                Local Footprint
              </span>
              <div className="text-lg font-semibold text-[#111111] font-mono-numbers mt-0.5">
                {summary ? `${(summary.approximateBytes / 1024).toFixed(1)} KB` : "0 KB"}
              </div>
              <div className="text-[11px] text-[#787774] mt-0.5">
                In browser sandbox
              </div>
            </div>
          </div>

          {/* Business Identity Settings Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3 pt-1 border-t border-[#EAEAEA]">
            <div>
              <label
                htmlFor="business-name-input"
                className="block text-xs font-medium text-[#111111] mb-1"
              >
                Freelancer / Studio Business Name
              </label>
              <div className="flex gap-2">
                <input
                  id="business-name-input"
                  type="text"
                  placeholder="e.g. Acme Design Studio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[#EAEAEA] bg-[#FBFBFA] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#111111] transition-colors"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#111111] text-[#FBFBFA] hover:bg-[#2A2A2A] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSavedFeedback ? (
                    <>
                      <CheckIcon size={12} className="text-emerald-400" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#787774] mt-1">
                Auto-populates your signature in AI payment reminder drafts.
              </p>
            </div>
          </form>

          {/* Data Portability (Backup / Restore) */}
          <div className="space-y-2 pt-2 border-t border-[#EAEAEA]">
            <div className="text-xs font-semibold text-[#111111]">
              Data Portability &amp; Backups
            </div>
            <p className="text-[11px] text-[#787774]">
              Export your local ledger and follow-up log as a JSON file, or restore
              onto another browser or computer.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[#111111] bg-[#FFFFFF] border border-[#EAEAEA] hover:bg-[#F7F6F3] transition-colors cursor-pointer"
              >
                <DownloadIcon size={13} />
                <span>Export Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[#111111] bg-[#FFFFFF] border border-[#EAEAEA] hover:bg-[#F7F6F3] transition-colors cursor-pointer"
              >
                <UploadIcon size={13} />
                <span>Import Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>

            {/* Import Status Alert */}
            {importStatus && (
              <div
                className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
                  importStatus.success
                    ? "bg-[#EDF6EE] text-[#346538] border border-[rgba(52,101,56,0.2)]"
                    : "bg-[#FDEBEC] text-[#9F2F2D] border border-[rgba(159,47,45,0.2)]"
                }`}
              >
                {importStatus.success ? (
                  <CheckIcon size={14} />
                ) : (
                  <AlertTriangleIcon size={14} />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>

          {/* Danger Zone: Clear Local Data */}
          <div className="pt-2 border-t border-[#EAEAEA]">
            {!confirmClearOpen ? (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9F2F2D] hover:underline cursor-pointer"
              >
                <Trash2Icon size={13} />
                <span>Clear All Saved Browser Data</span>
              </button>
            ) : (
              <div className="p-3 rounded-lg border border-[rgba(159,47,45,0.3)] bg-[#FDEBEC] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9F2F2D]">
                  <AlertTriangleIcon size={14} />
                  <span>Are you sure you want to clear all local data?</span>
                </div>
                <p className="text-[11px] text-[#9F2F2D]/90">
                  This will remove your saved custom ledger and logged nudge history
                  from this browser. The dashboard will revert to the benchmark sample.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#9F2F2D] text-[#FFFFFF] hover:bg-[#852725] transition-colors cursor-pointer"
                  >
                    Yes, Clear Everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(false)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#FFFFFF] border border-[#EAEAEA] text-[#555555] hover:bg-[#F7F6F3] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t border-[#EAEAEA] bg-[#F7F6F3]/50 flex items-center justify-between text-[11px] text-[#787774]">
          <span>HTML5 LocalStorage API</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md text-xs font-medium text-[#111111] bg-[#FFFFFF] border border-[#EAEAEA] hover:bg-[#F2F1ED] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
