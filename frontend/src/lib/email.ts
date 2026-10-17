/**
 * Email handoff utilities and validation for CashNudge follow-up composer.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates recipient email address format and guards against header injection.
 */
export function validateRecipientEmail(email: string): EmailValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Recipient email address is required.",
    };
  }

  // Prevent CRLF / newline header injection
  if (/[\r\n]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Recipient email address cannot contain line breaks.",
    };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid email address (e.g. billing@company.com).",
    };
  }

  return { isValid: true };
}

/**
 * Validates email subject.
 */
export function validateEmailSubject(subject: string): EmailValidationResult {
  if (!subject.trim()) {
    return {
      isValid: false,
      error: "Email subject is required.",
    };
  }
  return { isValid: true };
}

/**
 * Validates email message body.
 */
export function validateEmailBody(body: string): EmailValidationResult {
  if (!body.trim()) {
    return {
      isValid: false,
      error: "Message body is required.",
    };
  }
  return { isValid: true };
}

/**
 * Parses Gemma draft text into separate subject and body.
 * Prevents accidental duplication of the Subject line inside the message body.
 */
export function parseSubjectAndBody(
  draftText: string,
  defaultSubject: string
): { subject: string; body: string } {
  if (!draftText) {
    return { subject: defaultSubject, body: "" };
  }

  // Matches "Subject: <title>\n\n<message>" or "Subject: <title>\n<message>"
  const match = draftText.match(/^Subject:\s*([^\r\n]+)(?:\r?\n\r?\n|\r?\n)([\s\S]*)$/i);
  if (match) {
    const extractedSubject = match[1].trim();
    const extractedBody = match[2].trim();
    if (extractedSubject) {
      return {
        subject: extractedSubject,
        body: extractedBody,
      };
    }
  }

  return {
    subject: defaultSubject,
    body: draftText.trim(),
  };
}

/**
 * Generates a sensible, fact-grounded fallback subject from invoice context without hallucinations.
 */
export function generateDefaultSubject(
  invoiceId: string,
  tone: "gentle" | "firm",
  dueStatus?: string,
  daysOverdue?: number
): string {
  if (dueStatus === "overdue" && daysOverdue && daysOverdue > 0) {
    return `Payment Follow-Up: Invoice #${invoiceId} (${daysOverdue} days past due)`;
  }
  if (tone === "firm") {
    return `Outstanding Balance Notice: Invoice #${invoiceId}`;
  }
  return `Friendly check-in regarding Invoice #${invoiceId}`;
}

/**
 * Constructs a safely URL-encoded mailto URL.
 * Handles newlines, spaces, ampersands, currency symbols, and special characters.
 */
export function buildMailtoUrl(recipient: string, subject: string, body: string): string {
  const cleanRecipient = recipient.trim();
  const encodedSubject = encodeURIComponent(subject.trim());
  const encodedBody = encodeURIComponent(body);
  return `mailto:${cleanRecipient}?subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * Formats complete email details for fallback clipboard copy (useful when no desktop email client is configured).
 */
export function formatFullEmailDraft(recipient: string, subject: string, body: string): string {
  const toLine = recipient.trim() ? `To: ${recipient.trim()}\n` : "";
  const subjectLine = subject.trim() ? `Subject: ${subject.trim()}\n\n` : "";
  return `${toLine}${subjectLine}${body}`;
}

/**
 * Constructs a direct Gmail web compose URL.
 * Base: https://mail.google.com/mail/?view=cm&fs=1
 * Query parameters: to, su, body
 * Uses standard URL and URLSearchParams to safely encode all special characters,
 * newlines, punctuation, ampersands, currency symbols, and spaces.
 */
export function buildGmailComposeUrl(
  recipient: string,
  subject: string,
  body: string
): string {
  const url = new URL("https://mail.google.com/mail/?view=cm&fs=1");
  url.searchParams.set("to", recipient.trim());
  url.searchParams.set("su", subject.trim());
  url.searchParams.set("body", body);
  return url.toString();
}
