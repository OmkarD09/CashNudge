import React, { useState, useRef } from "react";
import { LedgerAnalysisResult, ValidationErrorDetail } from "@/types";
import { analyzeLedgerCsv, ApiClientError } from "@/lib/api";
import {
  UploadCloudIcon,
  FileTextIcon,
  XIcon,
  AlertTriangleIcon,
  InfoIcon,
} from "./icons";

interface CsvUploadZoneProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: LedgerAnalysisResult) => void;
}

export function CsvUploadZone({ isOpen, onClose, onSuccess }: CsvUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorDetail[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setValidationErrors([]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please select a valid CSV file (.csv extension).");
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("File exceeds maximum allowed size of 5 MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    setValidationErrors([]);

    try {
      const result = await analyzeLedgerCsv(selectedFile);
      setIsUploading(false);
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      setIsUploading(false);
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Failed to analyze ledger CSV.");
        const errorData = err.data as { errors?: ValidationErrorDetail[] } | undefined;
        if (errorData?.errors && Array.isArray(errorData.errors)) {
          setValidationErrors(errorData.errors);
        }
      } else {
        setErrorMessage("An unexpected network error occurred while uploading.");
      }
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="w-full max-w-lg card-minimal bg-[#FFFFFF] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAEAEA] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-[#111111]">
              Import Freelancer Invoice Ledger
            </h3>
            <p className="text-xs text-[#787774] mt-0.5">
              Analyze outstanding invoices with TabPFN predictive intelligence.
            </p>
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
        <div className="p-4 sm:p-5 space-y-4">
          {/* File Dropzone */}
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-[#111111] bg-[#F7F6F3]"
                  : "border-[#EAEAEA] bg-[#FBFBFA] hover:border-[#D4D4D2] hover:bg-[#F7F6F3]/50"
              }`}
            >
              <div className="p-3 rounded-full bg-[#FFFFFF] border border-[#EAEAEA] shadow-2xs text-[#111111] mb-3">
                <UploadCloudIcon size={24} />
              </div>
              <p className="text-xs font-medium text-[#111111]">
                Click to browse or drop CSV ledger here
              </p>
              <p className="text-[11px] text-[#787774] mt-1">
                Supports .csv files up to 5 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            /* Selected File Card */
            <div className="border border-[#EAEAEA] rounded-lg p-3.5 bg-[#FBFBFA] flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 rounded-md bg-[#FFFFFF] border border-[#EAEAEA] text-[#111111]">
                  <FileTextIcon size={18} />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-[#111111] truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-[#787774] font-mono-numbers">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>

              {!isUploading && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded text-[#787774] hover:text-[#9F2F2D] hover:bg-[#FDEBEC] transition-colors"
                  title="Remove selected file"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          )}

          {/* Schema Requirements Hint */}
          <div className="p-3 rounded-md bg-[#F7F6F3] border border-[#EAEAEA] text-[11px] text-[#555555] space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-[#111111]">
              <InfoIcon size={13} />
              <span>Required CSV columns:</span>
            </div>
            <code className="block p-1.5 bg-[#FFFFFF] rounded border border-[#EAEAEA] font-mono text-[10px] text-[#111111] overflow-x-auto">
              invoice_id, client_name, invoice_amount, payment_terms_days, is_paid_late
            </code>
            <p className="text-[10px] text-[#787774]">
              Leave <code>is_paid_late</code> blank for open invoices to receive TabPFN late-payment risk estimation.
            </p>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="p-3 rounded-md bg-[#FDEBEC] border border-[rgba(159,47,45,0.2)] text-xs text-[#9F2F2D] space-y-1.5">
              <div className="flex items-start gap-1.5 font-semibold">
                <AlertTriangleIcon size={14} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>

              {/* Detailed Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mt-2 text-[11px] max-h-32 overflow-y-auto space-y-1 divide-y divide-[rgba(159,47,45,0.1)]">
                  {validationErrors.map((err, idx) => (
                    <div key={idx} className="pt-1 first:pt-0">
                      {err.row_index !== undefined && (
                        <span className="font-mono font-medium">{`Row ${err.row_index + 1}: `}</span>
                      )}
                      <span className="font-mono font-semibold">{err.column}</span>
                      <span> — {err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#EAEAEA] bg-[#FBFBFA] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#EAEAEA] text-[#555555] hover:bg-[#F2F1ED] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md text-[#FBFBFA] bg-[#111111] hover:bg-[#2A2A2A] shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <span className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Running TabPFN Analysis...</span>
              </>
            ) : (
              <>
                <UploadCloudIcon size={13} />
                <span>Upload & Estimate Risk</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
