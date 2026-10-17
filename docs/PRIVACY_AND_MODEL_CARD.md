# CashNudge — Privacy, Data Handling & TabPFN Model Card

## 1. Privacy & Data Handling Disclosure

CashNudge prioritizes data minimization and financial privacy for freelancers and their clients. This document discloses exactly what data is retained locally, what data is transmitted externally, and under what conditions.

### Local-Only Data (Never Transmitted Externally)
The following identifiers and sensitive business fields remain exclusively in local runtime memory and are **never** included in the feature matrices transmitted to external inference APIs:
* **`invoice_id`**: Internal transactional identifiers (e.g., `INV-2024-001`). Stripped locally prior to any model fit or inference.
* **`client_name`**: The real legal or operating name of the client (e.g., `Apex Digital Labs`). Excluded via `backend/feature_extractor.py` and retained only for local presentation and user-directed correspondence.

### Transmitted Data When Using Prior Labs Cloud TabPFN
When configured with a valid `TABPFN_TOKEN` to use the official Prior Labs hosted API (`HostedTabPFNProvider`), the following abstract tabular attributes are transmitted via HTTPS to Prior Labs inference endpoints:
* **Feature Matrix Columns**:
  - `project_category` (e.g., `"Full-Stack Web App"`, `"Brand Identity"`)
  - `client_tier` (e.g., `"Enterprise"`, `"Seed-Startup"`)
  - `invoice_amount` (numeric float, e.g., `6500.00`)
  - `payment_terms_days` (numeric integer, e.g., `30`)
  - `revision_count` (numeric integer, e.g., `1`)
  - `past_late_count` (numeric integer, e.g., `0`)
* **Historical Outcome Labels**:
  - Binary late status vector (`0` for `paid_on_time`, `1` for `paid_late`).

> [!IMPORTANT]
> **Data Transmission Notice**: CashNudge is **not** an offline-only or zero-transmission tool when cloud-hosted TabPFN is enabled. While direct PII and customer names are stripped, tabular project attributes and financial amounts leave the host machine to execute inference on Prior Labs cloud infrastructure.

### Data Security & Credential Hygiene
* API tokens must be supplied via the `TABPFN_TOKEN` environment variable or a local `.env` file.
* `.env` is excluded from git version control. A sanitized `.env.example` is provided in the repository root.

---

## 2. Model Card: TabPFN for Invoice Payment Risk

### Intended Use
* **Primary Objective**: Provide freelancers and independent consultants with an early, probabilistic assessment of whether an open invoice is at risk of delayed payment, enabling timely and respectful follow-up.
* **Nature of Output**: Late-payment probabilities $\in [0.0, 1.0]$ categorized into interpretable risk tiers (`low`, `medium`, `high`).
* **Non-Intended Uses**: Autonomous debt collection, punitive credit scoring, automatic contract termination, or automated communication without human verification.

### Methodological Limitations
1. **Prior-Data Approximations**: TabPFN utilizes a prior-data transformer architecture trained on synthetic tabular datasets. While it performs strong in-context learning on small tabular datasets, its predictions represent statistical likelihoods, not certainties.
2. **Small-Sample Volatility**: Small freelancer ledgers (e.g., 5–30 historical invoices) possess high variance. Changes in a single invoice outcome can meaningfully shift estimated probabilities.
3. **Synthetic Dataset Notice**:
   - The included benchmark dataset (`backend/sample_data/synthetic_freelancer_invoices.csv`) is **100% synthetic**.
   - Performance or validation metrics evaluated on this synthetic ledger demonstrate algorithmic correctness and pipeline integrity; **they do not guarantee real-world predictive accuracy** on actual freelancer invoices across diverse macroeconomic conditions.

---

## 3. Gemma Neural Follow-up Assistant: Privacy & Model Card

### Data Transmitted During Follow-up Drafting
When a user requests a follow-up draft via `/api/invoices/followup`, the backend calls the configured Gemma inference endpoint (e.g. OpenRouter `https://openrouter.ai/api/v1` or local Ollama).

The structured prompt transmits only the following invoice-specific context:
* **`client_name`**: Included to allow direct, professional salutations (e.g. "Hi Apex Digital Labs team,").
* **`invoice_id`**: For payment tracking reference.
* **`invoice_amount`**: The exact dollar amount due.
* **`due_date`**: The agreed contract due date (or explicitly marked omitted if not set).
* **`days_overdue`**: Calculated integer indicating how many days past due (or 0 if upcoming).
* **`project_category`**: High-level deliverable description (e.g. "Full-Stack Web App").
* **`tone`**: Tone instruction (`gentle` or `firm`).

**Explicitly Excluded from Follow-up Inference:**
* Historical client payment records or other ledger entries.
* Bank account numbers, routing codes, SWIFT/IBAN identifiers.
* Personal phone numbers, physical addresses, or tax IDs.
* TabPFN internal risk matrices or feature vectors.

### Model Card: Google Gemma for Professional Communications
* **Model Family**: Google Gemma Open Models (e.g. `google/gemma-4-26b-a4b-it`).
* **Intended Use**: Assisting independent contractors and freelancers in authoring polite, professional, and factually grounded reminder emails.
* **Mandatory Human-in-the-Loop**: All generated drafts are presented in an editable text area in the CashNudge dashboard. The user must review, edit, and manually copy or transmit the message. CashNudge contains **no** automated email dispatch or autonomous communication capability.
* **Factual Grounding Guardrails**: Prompt directives strictly constrain the model to supplied financial facts, forbidding the invention of payment fees, penalty interest, external payment links, or premature claims of delinquency.
