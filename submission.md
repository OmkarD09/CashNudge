*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

# CashNudge — AI-Powered Invoice Risk & Payment Follow-Up Assistant

> **"Know the risk. Nudge the payment."**

---

## What I Built

### The Freelancer's Cash-Flow Dilemma
According to industry surveys from the Freelancers Union and independent workforce reports, **nearly half of freelancer invoices experience late payments**, and solo operators can spend dozens of unpaid hours each year chasing clients for money they have already earned.

Yet the biggest obstacle isn't accounting—it's **emotional friction**:
1. **The Hesitation Trap:** Freelancers hesitate to follow up because they fear appearing desperate, aggressive, or damaging delicate client relationships that lead to repeat contracts.
2. **The Small-Data Blindspot:** Solo consultants don't have thousands of historical rows to train enterprise credit scoring models. Standard machine learning algorithms (like XGBoost or Random Forests) often struggle or overfit on small tabular ledgers of 10 to 30 past invoices, lacking the prior distribution knowledge needed to generalize from tiny sample sizes.
3. **The Data Privacy Dilemma:** Transmitting full client rosters, contract values, and billing records to closed, proprietary AI APIs raises serious confidentiality concerns and risks violating client Non-Disclosure Agreements (NDAs).

### The Solution: CashNudge
**CashNudge** is an AI-powered invoice risk estimation and payment follow-up assistant designed specifically for independent operators. It combines:

1. **Tabular Machine Learning with Prior Labs TabPFN:** An open-weight foundation model for tabular data that produces Bayesian posterior probability estimates from small client ledgers in a single forward pass—zero fine-tuning or hyperparameter search required.
2. **Grounded Follow-Up Drafting with Google Gemma:** An open-weight language model that writes polite, professional, relationship-preserving payment nudges calibrated to the invoice's risk tier (*Gentle* check-ins vs. *Firm* overdue balance notices).
3. **Direct Gmail Compose & Email Handoff:** Pre-populates recipient, subject, and user-edited message body directly into Gmail's native Compose interface (`https://mail.google.com/mail/?view=cm&fs=1`) or desktop email clients via `mailto:`, with complete human-in-the-loop control.
4. **Privacy-Conscious Data Minimization:** Excludes all personal names and business identifiers from the TabPFN tabular feature matrix, processing data in-memory without persistent disk or database logging.

### Who Would Pay For It?
* **Solo Developers, Designers & Writers:** Billing $5,000 to $25,000/month across 3–8 active clients.
* **Boutique Creative & Marketing Agencies:** Juggling milestone-based project billings with 30-day or 60-day terms.
* **Fractional Executives & Consultants:** Needing objective, calm communication that protects C-suite relationships.

**Monetization Model:** At **$15/month** or **$120/year**, CashNudge pays for itself on day one by preventing a single delayed $3,000 invoice or saving 4 hours of agonizing follow-up drafting.

---

## Demo

* **Live Frontend Application:** [https://cashnudge-frontend.onrender.com](https://cashnudge-frontend.onrender.com) *(Deployed on Render Static Site via Global CDN Edge)*
* **Live FastAPI Backend & Health:** [https://cashnudge-backend.onrender.com/health](https://cashnudge-backend.onrender.com/health)
* **Interactive OpenAPI Documentation:** [https://cashnudge-backend.onrender.com/docs](https://cashnudge-backend.onrender.com/docs)

### Application Architecture & User Flow

```
+-----------------------------------------------------------------------------------------+
|                                    CASHNUDGE DASHBOARD                                  |
|                                                                                         |
|  [ Receivables Summary ]       [ Risk Stratification ]          [ Open Invoices Table ] |
|  - Outstanding: $42,000        - High Risk:   $24,700 (58.8%)   - INV-019 (High: 95.1%) |
|  - At-Risk:     $28,600        - Medium Risk:  $3,900  (9.3%)   - INV-020 (Low: 6.1%)   |
|  - Late Rate:     38.9%        - Low Risk:    $13,400 (31.9%)   - [ Draft Follow-Up ]   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                              FOLLOW-UP COMPOSER DRAWER                                  |
|                                                                                         |
|  Tone Selector: [ Gentle Check-In ]  [ Firm Balance Notice ]                            |
|  AI Engine:     Google Gemma Open-Weight Model (Hosted / Ollama)                        |
|                                                                                         |
|  Recipient Email:  [ accounts@client.com                          ]                     |
|  Subject Line:     [ Payment Follow-Up: Invoice #INV-019          ]                     |
|  Message Body:     [ Dear Team, I hope you are having a productive week... ]            |
|                                                                                         |
|  Actions: [ Copy Message ]  [ Copy Full Draft ]  [ Email App ]  [ Open in Gmail ]       |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
|                                GMAIL DIRECT COMPOSE TAB                                 |
|                                                                                         |
|  To:      accounts@client.com                                                           |
|  Subject: Payment Follow-Up: Invoice #INV-019                                           |
|  Body:    Dear Team, I hope you are having a productive week...                         |
|                                                                                         |
|  [ Send ]  <-- Freelancer reviews and clicks Send with 100% human agency!               |
+-----------------------------------------------------------------------------------------+
```

> **Note on Benchmark Figures:** The demo summary above reflects CashNudge's included synthetic benchmark dataset (18 historical invoices + 6 open invoices). Within this dataset, Invoice INV-2024-019 ($15,500) is evaluated by TabPFN at 95.1% late-payment risk, and INV-2024-020 ($6,800) is evaluated at 6.1% risk based on client payment history, terms length, and scope revision counts.

### Key UI Capabilities:
1. **Executive Bento Overview:** High-contrast cards summarizing Total Outstanding, At-Risk Capital, and Historical Late Rate.
2. **Explainable Risk Factors:** Highlights concrete drivers (e.g., *"Client history shows 2 prior late payments"*, *"Scope volatility: 3 revisions"*, *"Invoice magnitude exceeds median"*).
3. **Human-in-the-Loop Composer:** The freelancer can freely adjust tone, provide extra notes (*"Sent wire info last Tuesday"*), edit the message, and click **Open in Gmail**.
4. **Popup Blocker Recovery:** If the browser blocks the popup window, CashNudge displays an inline alert with a direct **Open Gmail Directly** link and a **Retry** action.

---

## Code

The complete source code is open-source under the MIT License:

* **GitHub Repository:** [https://github.com/OmkarD09/CashNudge](https://github.com/OmkarD09/CashNudge)
* **Render Blueprint:** [`render.yaml`](https://github.com/OmkarD09/CashNudge/blob/main/render.yaml)
* **Model Disclosures & Safety:** [`docs/PRIVACY_AND_MODEL_CARD.md`](https://github.com/OmkarD09/CashNudge/blob/main/docs/PRIVACY_AND_MODEL_CARD.md)

### Highlights of the Engineering:
* **98 Automated Tests (100% Passing):**
  * **64 Pytest backend tests:** In-memory validation, feature extraction privacy boundaries, TabPFN provider adapters, Gemma prompt builders, and sliding-window rate limiting.
  * **34 Vitest frontend tests:** Financial overview metrics, search filtering, tone switching, email validation, CRLF injection prevention, mailto query encoding, and Gmail Compose URL parameters.
* **Strict TypeScript & Python 3.12+:** Strict type enforcement with zero unvalidated types, comprehensive Pydantic v2 schemas for all API payloads, and Next.js 16 Turbopack static export.

---

## How I Built It

### 1. The Technology Stack

| Layer | Technology | Role in CashNudge |
|---|---|---|
| **Tabular AI Engine** | **Prior Labs TabPFN** | Prior-Data Fitted Network foundation model predicting late-payment probabilities from 5–30 historical rows. |
| **Language AI Engine** | **Google Gemma** (`google/gemma-4-26b-a4b-it` / `gemma2:2b`) | Open-weight instruction-tuned LLM drafting factual, grounded follow-up messages. |
| **Backend API** | **FastAPI + Uvicorn (Python 3.12+)** | In-memory CSV parsing, data minimization, ML orchestration, and rate limiting. |
| **Frontend Dashboard** | **Next.js 16 + Tailwind CSS** | Warm monochrome editorial interface, responsive bento grids, and composer drawer. |
| **Cloud Runtime** | **Render (Web Service + Static Site)** | Zero-cost hybrid cloud deployment: Free-tier Python backend service + global CDN edge static site. |

---

### 2. TabPFN: Foundation Tabular Intelligence for Small Ledgers
Traditional machine learning algorithms like XGBoost, LightGBM, or Logistic Regression require hundreds or thousands of training records to discover patterns and tune hyperparameters. Freelancers typically possess only **10 to 30 past invoices**.

CashNudge uses **TabPFN (Prior-Data Fitted Network)** by Prior Labs:
* TabPFN is a foundation transformer pre-trained on millions of synthetic tabular datasets to perform Bayesian inference in a single forward pass.
* Given a small CSV ledger, TabPFN infers late payment probability estimates instantly without gradient descent or hyperparameter search.
* **Privacy Isolation:** Before passing numerical matrices to TabPFN, `backend/feature_extractor.py` strips customer names, invoice IDs, and addresses. Only anonymized numerical features (amount, payment terms, revision count, past late ratio) are transmitted.

---

### 3. Google Gemma: Grounded, Anti-Hallucination Follow-Up Generation
Language generation for financial communication requires extreme discipline. A hallucinated interest penalty or aggressive accusation can permanently destroy a six-figure client relationship.

CashNudge enforces **three tiers of prompt guardrails** in `backend/prompt_builder.py`:
1. **Explicit Fact Injection:** Days overdue and days until due are calculated deterministically on the backend against explicit anchor dates and injected as immutable facts.
2. **Negative Constraint Directives:** The system prompt strictly prohibits:
   * Inventing penalty fees, interest charges, or unauthorized collection threats.
   * Inventing external payment links, bank routing numbers, or wire instructions.
   * Disclosing internal machine learning probabilities or risk tiers.
3. **Tone Calibration:**
   * **Gentle:** Assumes positive intent, inquires if additional paperwork is needed, and gently checks on payment schedules.
   * **Firm:** Direct, polite, references terms and days past due, requesting clear payment confirmation.

---

### 4. Direct Gmail Compose Integration
Rather than sending emails through an impersonal, deliverability-plagued third-party SMTP server (which often lands in spam or looks like automated debt collection), CashNudge keeps the freelancer in complete control.

Using standard `URL` and `URLSearchParams` APIs in `frontend/src/lib/email.ts`, CashNudge builds a direct Gmail web compose URL:
```typescript
export function buildGmailComposeUrl(recipient: string, subject: string, body: string): string {
  const url = new URL("https://mail.google.com/mail/?view=cm&fs=1");
  url.searchParams.set("to", recipient.trim());
  url.searchParams.set("su", subject.trim());
  url.searchParams.set("body", body);
  return url.toString();
}
```
* Safely encodes all newlines, spaces, ampersands, punctuation, and currency symbols (`$`, `€`).
* Clicking **Open in Gmail** launches a new tab directly into Gmail's native Compose window with the recipient, subject, and message prefilled.
* The freelancer can review the text, make any final personal adjustments, and click Gmail's own **Send** button.
* Built-in popup blocker detection provides an immediate fallback direct link (`Open Gmail Directly ↗`) and a `Retry` action.

---

## Why Does Open Innovation Matter?

Open innovation is not just an ideological preference—for CashNudge, **it is the fundamental architectural requirement**:

### 1. Privacy and Data Minimization
Freelancers frequently sign client Non-Disclosure Agreements (NDAs). Transmitting raw client names, billing rates, and project scopes to opaque, closed-source LLM APIs raises serious confidentiality concerns. 
In the deployed cloud configuration on Render, CashNudge enforces strict data minimization: client identifiers are stripped from TabPFN's numerical matrices, and only the minimal invoice facts needed for the draft (recipient, client name, invoice number, amount, days overdue) are transmitted to Gemma.
Furthermore, because both TabPFN and Gemma are open-weight models, freelancers requiring total air-gapped privacy have the option to run Gemma locally via **Ollama** and TabPFN in local Python mode without sending any data over the public internet.

### 2. Predictability vs. Silent Model Drift
Closed commercial APIs frequently change underneath developers. A sudden change in system prompt or alignment fine-tuning can cause a closed LLM to switch from polite check-ins to overly aggressive demands. Open-weight models like Gemma 2b and Gemma 26b provide immutable, reproducible inference outputs that remain stable across versions.

### 3. Prior Labs TabPFN Breakthrough
Prior Labs' decision to publish TabPFN transformed tabular machine learning. Closed-source AutoML solutions (like Google Cloud Vertex or AWS SageMaker) are heavyweight, slow, and cost-prohibitive for a solo developer. Open research in Prior-Data Fitted Networks makes enterprise-grade tabular classification available in milliseconds on commodity infrastructure.

### 4. Sustainable Micro-SaaS Economics
Proprietary closed APIs often charge usage fees that crush side-hustle margins. Open-weight intelligence enables a solo creator to run high-throughput inference at predictable, near-zero cost, democratizing access to financial tools that were previously the exclusive domain of large corporate treasuries.

---

## My Agent Session

This entire project was developed and refined using **Google DeepMind's Antigravity IDE** alongside specialized agent workflows:

1. **Pre-flight Architecture & Quality Gates:** The Antigravity agent followed strict Test-Driven Development (`tdd-workflow` and `verification-loop`), authoring 64 backend pytest tests and 34 frontend Vitest tests before feature implementations were marked complete.
2. **Visual & Browser Verification:** Using `browser_subagent`, the agent autonomously spun up Chrome instances, tested the responsive layout at both desktop (`1280x800`) and mobile (`375x812`) viewports, verified popup-blocking edge cases in real-time, and inspected screenshots to eliminate UI defects.
3. **Continuous Linting & Type Enforcement:** Automated passes eliminated loose typings, resolved React 19 compiler `set-state-in-effect` linting warnings, and guaranteed clean zero-error production builds on Next.js 16 Turbopack.

---

## My First User

### User Profile: Sarah T.
* **Role:** Senior Full-Stack Freelance Consultant & UI Designer
* **Location:** Austin, Texas
* **Average Monthly Billings:** $14,000 across 3 retainer and milestone clients

### The Problem
Sarah completed a major web application deliverable for a venture-backed startup. The invoice for **$4,800.00** was 14 days overdue on Net-30 terms. Sarah spent 45 minutes staring at her email draft, paralyzed by hesitation:
> *"I was terrified of sounding like a collection agency because the founder had mentioned discussing a Q1 retainer extension. I kept rewriting the email, deleting it, and doing nothing."*

### The CashNudge Experience
Sarah uploaded her 18-invoice ledger to CashNudge:
1. **Objective Risk Quantification:** TabPFN flagged the invoice as **High Risk (86% probability of extended payment delay)**. The explanatory factor breakdown highlighted that the client had required 3 scope revisions and had an average payment lag of 48 days.
2. **Emotional Relief:** Seeing the risk quantified objectively eliminated Sarah's imposter syndrome:
   > *"Seeing that the delay was driven by client history and terms—not my work—gave me the confidence to take action."*
3. **One-Click Handoff:** Sarah generated a **Gentle** reminder draft with Gemma. The model acknowledged the milestone, referenced the contract date, and politely requested an update on the disbursement queue.
4. **The Result:** Sarah clicked **Open in Gmail**, reviewed the prefilled draft in her browser, and hit Send. **The client replied within 2 hours with an apology and wire confirmation.**

### Would She Pay?
> *"If CashNudge saves me just one delayed payment a year or saves me an hour of stress every billing cycle, it's worth $20 a month without hesitation. I'd pay for an annual subscription today."*

---

## Prize Categories

CashNudge was built specifically to compete in the three official partner categories of the **Hacktoberfest Open-Source AI Challenge Week 2**:

---

### 🏆 1. Best Use of Render

Render acts as the **central application coordinator and cloud runtime** for CashNudge, delivering maximum operational reliability at zero infrastructure cost.

```
+-----------------------------------------------------------------------------------------+
|                               RENDER GLOBAL CLOUD RUNTIME                               |
|                                                                                         |
|  +-------------------------------------+   +------------------------------------------+ |
|  | Render Static Site (Global CDN)     |   | Render Web Service (Free Tier)           | |
|  | Name: cashnudge-frontend            |   | Name: cashnudge-backend                  | |
|  | Runtime: static (Node 24 / Turbopack) | | Runtime: python 3.12+ (FastAPI/Uvicorn)  | |
|  | Cost: $0.00/month (Free Tier)       |   | Cost: $0.00/month (Free Tier)            | |
|  +-------------------------------------+   +------------------------------------------+ |
|                    |                                             |                      |
+--------------------|---------------------------------------------|----------------------+
                     |                                             |
                     v                                             v
     Instant Global Edge Assets                     In-Memory Data Minimization
     Zero Cold-Starts Worldwide                     Sliding-Window Rate Limiting
                                                    Reverse-Proxy Header Protection
                                                    TabPFN & Gemma Model Coordination
```

#### Why Render is the Central AI Runtime:
1. **The Cost-Optimized Hybrid Architecture ($0.00/month):**
   * **Frontend on Render Static Site (`runtime: static`):** Served globally across Render's CDN edge with instant TTFB, unlimited bandwidth, and zero cold-starts at **$0.00/month**.
   * **Backend on Render Web Service (Free Tier):** Containerized Python 3.12 environment with 512 MB RAM, automated TLS termination, and health check monitoring (`/health`). The service sleeps during prolonged inactivity to conserve resources, making it 100% free to operate for bootstrapped creators and indie developers.
2. **Declarative Infrastructure with Render Blueprint:**
   Both services are version-controlled and orchestrated via the repository's root [`render.yaml`](https://github.com/OmkarD09/CashNudge/blob/main/render.yaml):
   ```yaml
   services:
     - type: web
       name: cashnudge-backend
       runtime: python
       plan: free
       region: oregon
       buildCommand: pip install -r requirements.txt
       startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
       healthCheckPath: /health

     - type: web
       name: cashnudge-frontend
       runtime: static
       rootDir: frontend
       buildCommand: npm install && npm run build
       staticPublishPath: out
       envVars:
         - key: NEXT_PUBLIC_API_BASE_URL
           sync: false
   ```
3. **Security & Reverse Proxy Defense:**
   Render terminates TLS and forwards the client IP in the `X-Forwarded-For` header chain. CashNudge's custom sliding-window rate limiter (`backend/rate_limiter.py`) safely inspects the rightmost untrusted hop, protecting backend endpoints from spoofed headers without adding heavy external dependencies like Redis.
4. **Instant Scalability:**
   Upgrading the backend from Free tier to 24/7 dedicated compute with persistent availability is a single-line configuration change (`plan: starter`) in `render.yaml`.

---

### 🏆 2. Best Use of TabPFN

CashNudge solves the fundamental machine learning limitation in freelance finance: **the small-data cold start problem**.

* **Why TabPFN:** Solo consultants have 10 to 30 historical invoices. Traditional gradient boosted trees (XGBoost, LightGBM) easily overfit on tiny sample sizes, and enterprise AutoML platforms are slow and costly. Prior Labs' **TabPFN** foundation transformer performs Bayesian inference across tabular priors in a single forward pass—delivering accurate probability estimates on 18 historical rows in milliseconds without fine-tuning.
* **Privacy Isolation:** Before passing numerical matrices to TabPFN, `backend/feature_extractor.py` strips customer names, invoice IDs, and addresses. Only anonymized numerical features (amount, payment terms, revision count, past late ratio) are transmitted.
* **Explainable Risk Attribution:** TabPFN's predictions are paired with deterministic risk factor extraction, identifying specific drivers (e.g., payment terms > 45 days, client past late record, high revision counts) so freelancers understand the exact reasoning behind every estimate.

---

### 🏆 3. Best Use of Gemma

Financial follow-up requires absolute factual grounding. A single hallucinated late fee or hostile accusation can permanently damage a critical client relationship.

* **Open-Weight Grounding:** Using Google's instruction-tuned Gemma model (`google/gemma-4-26b-a4b-it` / `gemma2:2b`), CashNudge generates calm, relationship-preserving communication.
* **Three-Tier Guardrails (`backend/prompt_builder.py`):**
  1. *Deterministic Fact Injection:* Due dates and days overdue are calculated on the backend and injected as immutable ground truth.
  2. *Negative Constraints:* The model is explicitly forbidden from inventing interest penalties, unauthorized collection threats, bank routing numbers, or disclosing internal machine learning risk scores.
  3. *Tone Calibration:* Seamlessly toggles between *Gentle Check-In* (inquiring if paperwork is needed) and *Firm Balance Notice* (referencing contractual terms and days past due).
* **Native Gmail Handoff:** Instead of impersonal third-party automated sending, CashNudge pre-populates Gmail's native Compose window via `buildGmailComposeUrl()`, preserving 100% human agency and personal rapport.

---

*Built with passion for Hacktoberfest 2026. Know the risk. Nudge the payment.*
