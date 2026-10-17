# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML/CSS/JavaScript with modular frontend architecture and lightweight styling (Vanilla CSS, avoiding heavy generic component frameworks or unwanted Tailwind dependencies). Python/FastAPI backend service supporting TabPFN tabular risk estimation and local/API-based Gemma models for context-grounded reminder drafting.

## Users

Freelancers, solo contractors, independent consultants, and micro-agencies who invoice clients directly and regularly face late payments, unpredictable cash flow, and awkward client follow-up dynamics.

## Product Purpose

CashNudge provides clear, early intelligence on invoice payment risk and automates the creation of professional, relationship-preserving payment nudges. It eliminates the emotional hesitation and uncertainty around chasing overdue invoices by coupling objective tabular risk scoring with human-approved, AI-drafted communications.

## Positioning

Unlike generic accounting suites (QuickBooks, FreshBooks) or blunt collection agency tools that damage client goodwill, CashNudge combines experimental tabular prior-data risk modeling (TabPFN) with grounded, tone-calibrated language generation (Gemma) to keep cash flowing while protecting professional client relationships.

## Operating Context

- Freelancer workspaces: desktop and mobile browsers used during invoicing cycles, end-of-month reconciliations, and weekly financial check-ins.
- Invoice inputs: structured uploads (CSV, JSON) and manual entry tracking client payment terms, invoice aging, invoice amount, past payment latency, and project type.
- Risk review and decision point: reviewing expected cash realization dates and risk tiers before choosing if, when, and how to send a payment nudge.

## Capabilities and Constraints

- **Capabilities:**
  - Invoice ingestion: tabular import of invoices with validation for dates, amounts, client identifiers, and payment terms.
  - Risk Estimation: TabPFN-driven tabular classification and scoring producing probability of late payment and estimated delay window, with explicit uncertainty flags.
  - Cash Flow Overview: aggregate metrics for outstanding, at-risk, and overdue amounts with high-contrast, scannable data summaries.
  - Follow-up Composer: Gemma-powered grounded prompt generation drafting polite, escalating, or firm reminder messages contextualized to payment history and contract terms.
  - Human-in-the-Loop: all communications require explicit user review, editing, and approval prior to sending or copying.
- **Constraints:**
  - No autonomous emailing without explicit human consent/trigger.
  - Transparent calculations: ML probabilities must be accompanied by explanatory risk factors (e.g., historical payment lag, days past due, invoice magnitude), never opaque black-box verdicts.
  - Privacy-conscious: financial figures and client personally identifiable information (PII) handled with strict local or isolated data hygiene.

## Brand Commitments

- **Name:** CashNudge
- **Tagline:** Know the risk. Nudge the payment.
- **Tone & Voice:** Distinctive, credible fintech; calm, objective, articulate, and respectful. No hype, artificial urgency, or SaaS clichés ("unleash", "elevate", "game-changer").
- **Visual Identity:** Restrained warm monochrome palette with deliberate pastel risk accents, editorial typography, disciplined whitespace, and sharp utilitarian data tables.

## Evidence on Hand

- Greenfield implementation: No synthetic testimonials, fake logos, fictitious customer quotes, or fabricated benchmark numbers.
- Demonstrations must use realistic, contextual freelancer invoice datasets and clearly mark synthetic sample data as illustrative.

## Product Principles

1. **Uncertainty Over False Precision:** Never present probabilistic risk estimations as absolute certainty; display confidence tiers and explanatory factors clearly.
2. **Human Agency Always Governs:** AI drafts recommendations and communications; the user retains final approval, editing control, and dispatch authority.
3. **Calm, High-Readability Utility:** Financial data requires rapid scannability, uncompromising contrast, and distraction-free layouts over superficial visual fluff.
4. **Relationship Preservation:** Nudges should safeguard professional relationships, employing tone appropriate to client history rather than aggressive collection tactics.
5. **Engineering Rigor:** Every calculation, schema transformation, and model invocation is guarded by strict validation, error boundaries, and test coverage.

## Accessibility & Inclusion

- Target WCAG 2.1 AA compliance across all surfaces.
- Minimum 4.5:1 contrast ratio for all standard text and financial figures; 3:1 for large display elements and interactive UI components.
- Complete keyboard navigability across risk tables, modal drawers, and message editors.
- Explicit screen-reader status announcements for asynchronous risk evaluations and state transitions.
- Respect `prefers-reduced-motion` for all interface transitions.
