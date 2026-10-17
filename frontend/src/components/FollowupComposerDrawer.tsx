import React, { useState } from "react";
import {
  InvoicePrediction,
  FollowupTone,
  FollowupDraftResponse,
} from "@/types";
import { draftFollowup, formatCurrency, formatPercent, ApiClientError } from "@/lib/api";
import {
  validateRecipientEmail,
  validateEmailSubject,
  validateEmailBody,
  parseSubjectAndBody,
  generateDefaultSubject,
  buildMailtoUrl,
  buildGmailComposeUrl,
  formatFullEmailDraft,
} from "@/lib/email";
import {
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  InfoIcon,
  MailIcon,
  GmailIcon,
  ExternalLinkIcon,
} from "./icons";

interface FollowupComposerDrawerProps {
  invoice: InvoicePrediction | null;
  onClose: () => void;
  onOpenEmailApp?: (mailtoUrl: string) => void;
  onOpenGmail?: (gmailUrl: string) => void;
}

export function FollowupComposerDrawer({
  invoice,
  onClose,
  onOpenEmailApp,
  onOpenGmail,
}: FollowupComposerDrawerProps) {
  const [tone, setTone] = useState<FollowupTone>("gentle");
  const [userContext, setUserContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResponse, setDraftResponse] = useState<FollowupDraftResponse | null>(null);

  // Email handoff state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [editableMessage, setEditableMessage] = useState("");

  // Validation feedback
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Copy & Action feedback
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedFullDraft, setCopiedFullDraft] = useState(false);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prevInvoiceId, setPrevInvoiceId] = useState<string | null>(null);

  // Reset composer state when selected invoice changes
  if (invoice && invoice.invoice_id !== prevInvoiceId) {
    setPrevInvoiceId(invoice.invoice_id);
    setDraftResponse(null);
    setEditableMessage("");
    setEmailSubject("");
    // Prefill recipient ONLY if verified email is provided in invoice data; do not invent or infer.
    setRecipientEmail(
      (invoice as unknown as { client_email?: string; customer_email?: string }).client_email ||
      (invoice as unknown as { client_email?: string; customer_email?: string }).customer_email ||
      ""
    );
    setRecipientError(null);
    setSubjectError(null);
    setMessageError(null);
    setErrorMessage(null);
    setHandoffNotice(null);
    setPopupBlockedUrl(null);
    setCopiedMessage(false);
    setCopiedFullDraft(false);
    setUserContext("");
    // Default tone: firm if high risk, gentle otherwise
    setTone(invoice.risk_tier === "high" ? "firm" : "gentle");
  } else if (!invoice && prevInvoiceId !== null) {
    setPrevInvoiceId(null);
  }

  if (!invoice) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setHandoffNotice(null);
    setPopupBlockedUrl(null);
    setCopiedMessage(false);
    setCopiedFullDraft(false);

    try {
      const response = await draftFollowup({
        invoice_id: invoice.invoice_id,
        customer_name: invoice.client_name,
        invoice_amount: invoice.invoice_amount,
        payment_terms_days: invoice.payment_terms_days,
        due_date: invoice.due_date,
        days_overdue: invoice.days_overdue,
        risk_tier: invoice.risk_tier,
        late_probability: invoice.late_probability,
        tone: tone,
        user_context: userContext.trim() || undefined,
      });

      setDraftResponse(response);

      // Parse subject and body from the generated message
      const defaultSub = generateDefaultSubject(
        invoice.invoice_id,
        tone,
        invoice.due_status,
        invoice.days_overdue
      );
      const parsed = parseSubjectAndBody(response.drafted_message, defaultSub);

      setEmailSubject(parsed.subject);
      setEditableMessage(parsed.body);
      setSubjectError(null);
      setMessageError(null);
      setIsGenerating(false);
    } catch (err: unknown) {
      setIsGenerating(false);
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Failed to generate follow-up message.");
      } else {
        setErrorMessage("Unexpected connection error during message generation.");
      }
    }
  };

  const handleOpenGmail = () => {
    setHandoffNotice(null);
    setPopupBlockedUrl(null);

    // 1. Validate recipient email
    const recipientVal = validateRecipientEmail(recipientEmail);
    if (!recipientVal.isValid) {
      setRecipientError(recipientVal.error || "Please enter a valid recipient email.");
      return;
    }
    setRecipientError(null);

    // 2. Validate subject
    const subjectVal = validateEmailSubject(emailSubject);
    if (!subjectVal.isValid) {
      setSubjectError(subjectVal.error || "Email subject is required.");
      return;
    }
    setSubjectError(null);

    // 3. Validate message body
    const bodyVal = validateEmailBody(editableMessage);
    if (!bodyVal.isValid) {
      setMessageError(bodyVal.error || "Message body is required.");
      return;
    }
    setMessageError(null);

    // 4. Construct direct Gmail compose URL using standard URL & URLSearchParams
    const gmailUrl = buildGmailComposeUrl(recipientEmail, emailSubject, editableMessage);

    // 5. Open Gmail in a new browser tab
    if (onOpenGmail) {
      onOpenGmail(gmailUrl);
      setHandoffNotice(
        "Gmail opened in a new tab with your prefilled draft. Review and click Send in Gmail when ready."
      );
      return;
    }

    try {
      const newTab = window.open(gmailUrl, "_blank", "noopener,noreferrer");
      if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
        setPopupBlockedUrl(gmailUrl);
        setHandoffNotice(
          "Your browser blocked the popup. Click 'Open Gmail Directly' below or allow popups for this site."
        );
      } else {
        setHandoffNotice(
          "Gmail opened in a new tab with your prefilled draft. Review and click Send in Gmail when ready."
        );
      }
    } catch {
      setPopupBlockedUrl(gmailUrl);
      setHandoffNotice(
        "Could not launch Gmail automatically. Click 'Open Gmail Directly' below."
      );
    }
  };

  const handleOpenEmailApp = () => {
    setHandoffNotice(null);
    setPopupBlockedUrl(null);

    // 1. Validate recipient email
    const recipientVal = validateRecipientEmail(recipientEmail);
    if (!recipientVal.isValid) {
      setRecipientError(recipientVal.error || "Please enter a valid recipient email.");
      return;
    }
    setRecipientError(null);

    // 2. Validate subject
    const subjectVal = validateEmailSubject(emailSubject);
    if (!subjectVal.isValid) {
      setSubjectError(subjectVal.error || "Email subject is required.");
      return;
    }
    setSubjectError(null);

    // 3. Validate message body
    const bodyVal = validateEmailBody(editableMessage);
    if (!bodyVal.isValid) {
      setMessageError(bodyVal.error || "Message body is required.");
      return;
    }
    setMessageError(null);

    // 4. Construct safe URL-encoded mailto link
    const mailtoUrl = buildMailtoUrl(recipientEmail, emailSubject, editableMessage);

    // 5. Trigger email client handoff
    if (onOpenEmailApp) {
      onOpenEmailApp(mailtoUrl);
      setHandoffNotice(
        "Email app opened with your draft. Please review and send from your email application."
      );
      return;
    }

    try {
      window.location.href = mailtoUrl;
      setHandoffNotice(
        "Email app opened with your draft. Please review and send from your email application."
      );
    } catch {
      setHandoffNotice(
        "Could not launch email app directly. Please use 'Copy Full Draft' to paste into your webmail."
      );
    }
  };

  const handleCopyMessage = async () => {
    if (!editableMessage) return;
    try {
      await navigator.clipboard.writeText(editableMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      setErrorMessage("Could not access clipboard. Please copy manually.");
    }
  };

  const handleCopyFullDraft = async () => {
    const fullDraft = formatFullEmailDraft(recipientEmail, emailSubject, editableMessage);
    if (!fullDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(fullDraft);
      setCopiedFullDraft(true);
      setTimeout(() => setCopiedFullDraft(false), 2500);
    } catch {
      setErrorMessage("Could not access clipboard. Please copy manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-xs">
      <div
        className="w-full max-w-xl h-full bg-[#FFFFFF] border-l border-[#EAEAEA] shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div>
          <div className="p-4 sm:p-5 border-b border-[#EAEAEA] flex items-center justify-between bg-[#FBFBFA]">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-[#111111] text-[#FBFBFA]">
                <SparklesIcon size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#111111]">
                  Payment Follow-Up Assistant
                </h3>
                <p className="text-xs text-[#787774]">
                  Gemma open-weight follow-up composer &amp; email handoff
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#787774] hover:text-[#111111] hover:bg-[#F2F1ED] transition-colors"
              aria-label="Close composer"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {/* Invoice Facts Card */}
            <div className="p-4 rounded-lg bg-[#F7F6F3] border border-[#EAEAEA] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111]">
                  Invoice Context
                </span>
                <span className="font-mono text-[#787774]">
                  {invoice.invoice_id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#787774]">Client:</span>{" "}
                  <strong className="text-[#111111]">{invoice.client_name}</strong>
                </div>
                <div>
                  <span className="text-[#787774]">Amount:</span>{" "}
                  <strong className="text-[#111111] font-mono-numbers">
                    {formatCurrency(invoice.invoice_amount)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#787774]">Terms:</span>{" "}
                  <span className="font-mono-numbers">
                    Net {invoice.payment_terms_days} days
                  </span>
                </div>
                <div>
                  <span className="text-[#787774]">Late Risk:</span>{" "}
                  <span className="font-mono-numbers font-medium text-[#111111]">
                    {formatPercent(invoice.late_probability)} ({invoice.risk_tier})
                  </span>
                </div>
                {invoice.due_date && (
                  <div className="col-span-2 pt-1 border-t border-[#EAEAEA]/60 flex items-center justify-between">
                    <span>
                      <span className="text-[#787774]">Due Date:</span>{" "}
                      <strong className="font-mono-numbers text-[#111111]">{invoice.due_date}</strong>
                    </span>
                    {invoice.due_status === "overdue" && invoice.days_overdue ? (
                      <span className="text-xs font-semibold text-[#D9383A] bg-[#FBEAEB] px-2 py-0.5 rounded">
                        {invoice.days_overdue}d overdue
                      </span>
                    ) : invoice.due_status === "upcoming" ? (
                      <span className="text-xs font-medium text-[#2E7D32] bg-[#EBF4EC] px-2 py-0.5 rounded">
                        Upcoming
                      </span>
                    ) : invoice.due_status === "due_today" ? (
                      <span className="text-xs font-semibold text-[#B25900] bg-[#FDF3E7] px-2 py-0.5 rounded">
                        Due today
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#787774] flex items-center gap-1 pt-1 border-t border-[#EAEAEA]">
                <ShieldCheckIcon size={12} className="text-[#346538]" />
                <span>Strict Fact Guardrail: Only verified invoice details are referenced.</span>
              </div>
            </div>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">
                Message Tone
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTone("gentle")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    tone === "gentle"
                      ? "border-[#111111] bg-[#FBFBFA] shadow-xs"
                      : "border-[#EAEAEA] hover:border-[#D4D4D2] bg-[#FFFFFF]"
                  }`}
                >
                  <div className="text-xs font-semibold text-[#111111]">
                    Gentle Reminder
                  </div>
                  <div className="text-[11px] text-[#787774] mt-0.5">
                    Polite, collaborative check-in preserving client goodwill.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTone("firm")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    tone === "firm"
                      ? "border-[#111111] bg-[#FBFBFA] shadow-xs"
                      : "border-[#EAEAEA] hover:border-[#D4D4D2] bg-[#FFFFFF]"
                  }`}
                >
                  <div className="text-xs font-semibold text-[#111111]">
                    Firm Follow-up
                  </div>
                  <div className="text-[11px] text-[#787774] mt-0.5">
                    Direct, professional notice requesting settlement date.
                  </div>
                </button>
              </div>
            </div>

            {/* Optional Context Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#555555] block">
                Additional Notes or Context (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Sent wire instructions last Tuesday..."
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#EAEAEA] bg-[#FBFBFA] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#111111] transition-colors"
              />
            </div>

            {/* Generate Action Button */}
            <div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md text-[#FBFBFA] bg-[#111111] hover:bg-[#2A2A2A] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Drafting Follow-up with Gemma...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon size={14} className="text-amber-300" />
                    <span>{draftResponse ? "Regenerate Draft" : "Generate Payment Draft"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-md bg-[#FDEBEC] border border-[rgba(159,47,45,0.2)] text-xs text-[#9F2F2D] flex items-start gap-2">
                <AlertTriangleIcon size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Notice: </span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Drafted Email Result Display */}
            {editableMessage && (
              <div className="space-y-4 pt-2 border-t border-[#EAEAEA]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111111]">
                    Email Draft (Review &amp; Edit)
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#FBF3DB] text-[#956400] border border-[rgba(149,100,0,0.2)]">
                    <AlertTriangleIcon size={11} />
                    Human Review Required
                  </span>
                </div>

                {/* Recipient Email Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="composer-recipient-email"
                    className="text-xs font-semibold text-[#111111] flex items-center justify-between"
                  >
                    <span>Recipient Email</span>
                    <span className="text-[11px] font-normal text-[#787774]">
                      Required for email handoff
                    </span>
                  </label>
                  <input
                    id="composer-recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => {
                      setRecipientEmail(e.target.value);
                      if (recipientError) setRecipientError(null);
                    }}
                    placeholder="e.g. billing@client.com"
                    className={`w-full px-3 py-2 text-xs rounded-md border ${
                      recipientError
                        ? "border-[#D9383A] bg-[#FFF8F8]"
                        : "border-[#EAEAEA] bg-[#FFFFFF]"
                    } focus:outline-none focus:border-[#111111] transition-colors`}
                  />
                  {recipientError && (
                    <p className="text-[11px] text-[#D9383A] flex items-center gap-1 mt-0.5">
                      <AlertTriangleIcon size={12} />
                      <span>{recipientError}</span>
                    </p>
                  )}
                </div>

                {/* Email Subject Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="composer-email-subject"
                    className="text-xs font-semibold text-[#111111] block"
                  >
                    Subject Line
                  </label>
                  <input
                    id="composer-email-subject"
                    type="text"
                    value={emailSubject}
                    onChange={(e) => {
                      setEmailSubject(e.target.value);
                      if (subjectError) setSubjectError(null);
                    }}
                    placeholder="e.g. Friendly check-in regarding Invoice #INV-2024-001"
                    className={`w-full px-3 py-2 text-xs rounded-md border ${
                      subjectError
                        ? "border-[#D9383A] bg-[#FFF8F8]"
                        : "border-[#EAEAEA] bg-[#FFFFFF]"
                    } focus:outline-none focus:border-[#111111] transition-colors`}
                  />
                  {subjectError && (
                    <p className="text-[11px] text-[#D9383A] flex items-center gap-1 mt-0.5">
                      <AlertTriangleIcon size={12} />
                      <span>{subjectError}</span>
                    </p>
                  )}
                </div>

                {/* Message Body Field */}
                <div className="space-y-1">
                  <label
                    htmlFor="composer-message-body"
                    className="text-xs font-semibold text-[#111111] block"
                  >
                    Message Body
                  </label>
                  <textarea
                    id="composer-message-body"
                    rows={8}
                    value={editableMessage}
                    onChange={(e) => {
                      setEditableMessage(e.target.value);
                      if (messageError) setMessageError(null);
                    }}
                    className={`w-full p-3 text-xs leading-relaxed rounded-md border ${
                      messageError
                        ? "border-[#D9383A] bg-[#FFF8F8]"
                        : "border-[#EAEAEA] bg-[#FFFFFF]"
                    } focus:outline-none focus:border-[#111111] font-sans resize-y`}
                    placeholder="Generated draft message will appear here..."
                  />
                  {messageError && (
                    <p className="text-[11px] text-[#D9383A] flex items-center gap-1 mt-0.5">
                      <AlertTriangleIcon size={12} />
                      <span>{messageError}</span>
                    </p>
                  )}
                </div>

                {/* Popup Blocked Fallback Banner */}
                {popupBlockedUrl && (
                  <div className="p-3 rounded-md bg-[#FFF9E6] border border-[#FFE082] text-xs space-y-2 animate-in fade-in">
                    <div className="font-semibold text-[#7A4F01] flex items-center gap-1.5">
                      <AlertTriangleIcon size={14} className="text-[#B26A00]" />
                      <span>Popup Blocked by Browser</span>
                    </div>
                    <p className="text-[#8D5D00] text-[11px] leading-relaxed">
                      Your browser prevented opening a new tab automatically. Click the link below to open your prefilled draft in Gmail:
                    </p>
                    <div className="pt-0.5 flex flex-wrap items-center gap-2">
                      <a
                        href={popupBlockedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111111] text-[#FFFFFF] text-xs font-medium hover:bg-[#2A2A2A] transition-colors"
                      >
                        <span>Open Gmail Directly</span>
                        <ExternalLinkIcon size={12} />
                      </a>
                      <button
                        type="button"
                        onClick={handleOpenGmail}
                        className="px-2.5 py-1.5 rounded-md border border-[#D0D0D0] bg-[#FFFFFF] text-xs font-medium text-[#111111] hover:bg-[#F2F1ED] transition-colors cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Handoff Notice Banner */}
                {handoffNotice && !popupBlockedUrl && (
                  <div className="p-3 rounded-md bg-[#EBF4EC] border border-[rgba(46,125,50,0.2)] text-xs text-[#2E7D32] flex items-start gap-2">
                    <ShieldCheckIcon size={16} className="shrink-0 mt-0.5 text-[#2E7D32]" />
                    <div className="space-y-1">
                      <p className="font-semibold">{handoffNotice}</p>
                      <p className="text-[11px] text-[#555555]">
                        Approval Required: CashNudge transfers this draft to your email client. You review and send it yourself.
                      </p>
                    </div>
                  </div>
                )}

                {/* Provider disclosure & warnings */}
                {draftResponse && (
                  <div className="space-y-1.5 text-[11px] text-[#787774]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">
                        Provider: {draftResponse.inference_provider}
                      </span>
                    </div>

                    {draftResponse.warnings && draftResponse.warnings.length > 0 && (
                      <div className="p-2 rounded bg-[#F7F6F3] border border-[#EAEAEA] space-y-1">
                        {draftResponse.warnings.map((w, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[#956400]">
                            <InfoIcon size={12} />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#EAEAEA] bg-[#FBFBFA] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] text-[#555555] hover:bg-[#F2F1ED] transition-colors order-3 sm:order-1 text-center cursor-pointer"
          >
            Close
          </button>

          {editableMessage && (
            <div className="flex flex-wrap items-center gap-2 order-1 sm:order-2 justify-end">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] bg-[#FFFFFF] text-[#111111] hover:bg-[#F2F1ED] transition-colors cursor-pointer"
                title="Copy message body to clipboard"
              >
                {copiedMessage ? (
                  <>
                    <CheckIcon size={13} className="text-[#346538]" />
                    <span>Copied Message!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span>Copy Message</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyFullDraft}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] bg-[#FFFFFF] text-[#111111] hover:bg-[#F2F1ED] transition-colors cursor-pointer"
                title="Copy To, Subject, and Body formatted for email"
              >
                {copiedFullDraft ? (
                  <>
                    <CheckIcon size={13} className="text-[#346538]" />
                    <span>Copied Full Draft!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span>Copy Full Draft</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenEmailApp}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-[#EAEAEA] bg-[#FFFFFF] text-[#555555] hover:bg-[#F2F1ED] hover:text-[#111111] transition-colors cursor-pointer"
                aria-label="Open in Email App"
                title="Open in default desktop mail application via mailto:"
              >
                <MailIcon size={13} />
                <span>Email App</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGmail}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-[#FBFBFA] bg-[#111111] hover:bg-[#2A2A2A] shadow-xs transition-all cursor-pointer"
                aria-label="Open in Gmail"
                title="Open directly in Gmail Compose in a new browser tab"
              >
                <GmailIcon size={14} />
                <span>Open in Gmail</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
