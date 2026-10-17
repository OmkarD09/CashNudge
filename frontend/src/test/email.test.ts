import { describe, it, expect } from "vitest";
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

describe("Email Utilities & Validation", () => {
  describe("validateRecipientEmail", () => {
    it("accepts standard valid email addresses", () => {
      expect(validateRecipientEmail("accounting@acme.com").isValid).toBe(true);
      expect(validateRecipientEmail("john.doe+invoices@sub.domain.org").isValid).toBe(true);
    });

    it("rejects empty or whitespace-only email addresses", () => {
      const res = validateRecipientEmail("   ");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/required/i);
    });

    it("rejects malformed email addresses", () => {
      expect(validateRecipientEmail("not-an-email").isValid).toBe(false);
      expect(validateRecipientEmail("missing@domain").isValid).toBe(false);
      expect(validateRecipientEmail("@nodomain.com").isValid).toBe(false);
      expect(validateRecipientEmail("spaces in@email.com").isValid).toBe(false);
    });

    it("guards against CRLF and newline header injection in recipient email", () => {
      const res = validateRecipientEmail("victim@example.com\r\nBcc: attacker@example.com");
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/line break/i);
    });
  });

  describe("validateEmailSubject and validateEmailBody", () => {
    it("validates that subject is non-empty", () => {
      expect(validateEmailSubject("").isValid).toBe(false);
      expect(validateEmailSubject("   ").isValid).toBe(false);
      expect(validateEmailSubject("Invoice Follow-Up").isValid).toBe(true);
    });

    it("validates that body is non-empty", () => {
      expect(validateEmailBody("").isValid).toBe(false);
      expect(validateEmailBody("   ").isValid).toBe(false);
      expect(validateEmailBody("Please find invoice attached.").isValid).toBe(true);
    });
  });

  describe("parseSubjectAndBody", () => {
    it("extracts subject and body cleanly from Gemma output", () => {
      const draft = "Subject: Friendly check-in regarding Invoice #INV-2024-001\n\nDear Client,\nHope all is well.\nBest, Freelancer";
      const parsed = parseSubjectAndBody(draft, "Default Subject");

      expect(parsed.subject).toBe("Friendly check-in regarding Invoice #INV-2024-001");
      expect(parsed.body).toBe("Dear Client,\nHope all is well.\nBest, Freelancer");
      // Ensures subject is NOT duplicated in the body
      expect(parsed.body.startsWith("Subject:")).toBe(false);
    });

    it("falls back to default subject when output lacks Subject header", () => {
      const draft = "Dear Client,\nHope all is well.\nBest, Freelancer";
      const parsed = parseSubjectAndBody(draft, "Default Invoice Subject");

      expect(parsed.subject).toBe("Default Invoice Subject");
      expect(parsed.body).toBe("Dear Client,\nHope all is well.\nBest, Freelancer");
    });
  });

  describe("generateDefaultSubject", () => {
    it("generates overdue subject with exact verified days overdue", () => {
      const subject = generateDefaultSubject("INV-100", "firm", "overdue", 14);
      expect(subject).toBe("Payment Follow-Up: Invoice #INV-100 (14 days past due)");
    });

    it("generates firm notice subject when requested", () => {
      const subject = generateDefaultSubject("INV-101", "firm");
      expect(subject).toBe("Outstanding Balance Notice: Invoice #INV-101");
    });

    it("generates gentle check-in subject by default", () => {
      const subject = generateDefaultSubject("INV-102", "gentle");
      expect(subject).toBe("Friendly check-in regarding Invoice #INV-102");
    });
  });

  describe("buildMailtoUrl", () => {
    it("constructs a properly encoded mailto URL with spaces, newlines, currency, and ampersands", () => {
      const recipient = "client@example.com";
      const subject = "Invoice #INV-2024-001 & Payment Follow-Up ($5,000.00)";
      const body = "Dear Client,\n\nPlease review Invoice #INV-2024-001 for $5,000.00 & confirm receipt.\n\nThanks!";

      const url = buildMailtoUrl(recipient, subject, body);

      expect(url.startsWith("mailto:client@example.com?subject=")).toBe(true);
      // Spaces encoded as %20
      expect(url).toContain("Invoice%20%23INV-2024-001%20%26%20Payment");
      // Dollar sign encoded
      expect(url).toContain("%245%2C000.00");
      // Ampersand encoded
      expect(url).toContain("%26");
      // Newlines encoded
      expect(url).toContain("%0A");
    });
  });

  describe("buildGmailComposeUrl", () => {
    it("constructs a direct Gmail compose URL with view=cm and fs=1", () => {
      const recipient = "accounts@client.org";
      const subject = "Invoice #INV-2024-001 Follow-Up";
      const body = "Dear Accounts Team,\n\nPlease review the attached invoice.\n\nBest regards,\nJane";

      const gmailUrl = buildGmailComposeUrl(recipient, subject, body);
      const parsed = new URL(gmailUrl);

      expect(parsed.origin).toBe("https://mail.google.com");
      expect(parsed.pathname).toBe("/mail/");
      expect(parsed.searchParams.get("view")).toBe("cm");
      expect(parsed.searchParams.get("fs")).toBe("1");
      expect(parsed.searchParams.get("to")).toBe("accounts@client.org");
      expect(parsed.searchParams.get("su")).toBe("Invoice #INV-2024-001 Follow-Up");
      expect(parsed.searchParams.get("body")).toBe(body);
    });

    it("safely encodes special characters, ampersands, currency symbols, and multiline text", () => {
      const recipient = "billing@apex.com";
      const subject = "Invoice & Balance Notice: $12,500.00 & €500.00 (Due Soon!)";
      const body = "Hello Team,\n\nParagraph 1: Outstanding amount is $12,500.00 & fee is 5%.\n\nParagraph 2: Questions? Contact support@cashnudge.com.\n\nThanks & Regards,\nFreelancer";

      const gmailUrl = buildGmailComposeUrl(recipient, subject, body);

      // Verify no raw unencoded ampersands or brackets break query structure
      expect(gmailUrl.startsWith("https://mail.google.com/mail/?view=cm&fs=1")).toBe(true);

      const parsed = new URL(gmailUrl);
      expect(parsed.searchParams.get("to")).toBe("billing@apex.com");
      expect(parsed.searchParams.get("su")).toBe(subject);
      // Newlines and special characters survive URL roundtrip without corruption
      expect(parsed.searchParams.get("body")).toBe(body);
      expect(parsed.searchParams.get("body")).toContain("$12,500.00 & fee is 5%");
      expect(parsed.searchParams.get("body")).toContain("\n\nParagraph 2:");
    });

    it("trims whitespace from recipient and subject but preserves intentional formatting in body", () => {
      const recipient = "   client@test.com   ";
      const subject = "   Payment Reminder   ";
      const body = "Line 1\n  Indented Line 2\nLine 3";

      const gmailUrl = buildGmailComposeUrl(recipient, subject, body);
      const parsed = new URL(gmailUrl);

      expect(parsed.searchParams.get("to")).toBe("client@test.com");
      expect(parsed.searchParams.get("su")).toBe("Payment Reminder");
      expect(parsed.searchParams.get("body")).toBe("Line 1\n  Indented Line 2\nLine 3");
    });
  });

  describe("formatFullEmailDraft", () => {
    it("formats complete email for fallback webmail pasting", () => {
      const full = formatFullEmailDraft(
        "client@example.com",
        "Invoice Reminder",
        "Hi Client,\nFriendly check-in."
      );
      expect(full).toBe("To: client@example.com\nSubject: Invoice Reminder\n\nHi Client,\nFriendly check-in.");
    });
  });
});
