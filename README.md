# CashNudge — AI-Powered Invoice Risk & Payment Follow-Up Assistant

> **"Know the risk. Nudge the payment."**

CashNudge provides freelancers, solo contractors, and micro-agencies with early probabilistic intelligence on invoice late-payment risk and generates grounded, relationship-preserving payment follow-up reminders.

Built with **Prior Labs TabPFN** for tabular prior-fitted risk quantification, **Google Gemma** open-weight intelligence for follow-up drafting, and **Next.js** for an editorial, distraction-free dashboard.

---

## 1. Core Capabilities

* **Tabular Risk Quantification (Prior Labs TabPFN):** Predicts late payment probability for pending invoices from small client historical ledgers without extensive fine-tuning.
* **Grounded Follow-Up Generation (Google Gemma):** Generates polite, professional invoice follow-ups calibrated to client relationship context and risk tier (*Gentle* check-ins vs. *Firm* overdue balance notices).
* **Direct Gmail Compose & Email Handoff:** Pre-populates recipient, subject, and user-edited message body directly into Gmail Compose in a new browser tab or the user's default desktop mail client via `mailto:`.
* **Zero PII Cloud Transmission:** Strips customer names, business identifiers, and sensitive text before tabular features are evaluated by TabPFN. Invoices are analyzed in-memory and never persisted to disk or databases.
* **Production-Grade Rate Limiting & Proxy Protection:** Built-in sliding-window rate limiting with secure client IP extraction, robust against spoofed `X-Forwarded-For` headers behind reverse proxies like Render.
* **100% Human-in-the-Loop:** CashNudge never sends emails autonomously or claims messages were delivered. Freelancers retain complete control to review, edit, and send drafts directly from their chosen email client.

---

## 2. Architecture & Repository Structure

```text
CashNudge/
├── backend/
│   ├── __init__.py
│   ├── config.py              # Environment configuration & settings validation
│   ├── schemas.py             # Pydantic v2 data models, enums, & API payloads
│   ├── data_validator.py      # Strict CSV loading & schema validation
│   ├── feature_extractor.py   # Predictive feature isolation & privacy boundary
│   ├── model_provider.py      # TabPFN classifier adapters (Prior Labs API + Mock)
│   ├── ml_engine.py           # Tabular risk estimation pipeline & cash-flow metrics
│   ├── prompt_builder.py      # Factual prompt generator with safety guardrails
│   ├── gemma_provider.py      # Gemma follow-up drafter (Hosted OpenRouter, Ollama, Mock)
│   ├── rate_limiter.py        # Sliding-window rate limiting with trusted proxy support
│   ├── main.py                # FastAPI HTTP application, CORS, & endpoints
│   ├── cli.py                 # Command-line runner for batch ledger analysis
│   └── sample_data/
│       └── synthetic_freelancer_invoices.csv  # Synthetic benchmark dataset (24 invoices)
├── frontend/                  # Next.js 16 App Router + Tailwind CSS + TypeScript
│   ├── src/
│   │   ├── app/               # Next.js App Router (page.tsx, layout.tsx)
│   │   ├── components/        # Bento cards, Invoice table, Composer drawer, Upload modal
│   │   ├── lib/
│   │   │   ├── api.ts         # Centralized typed HTTP API client
│   │   │   └── email.ts       # Email validation, Gmail Compose URL, mailto encoder
│   │   ├── types/             # TypeScript backend schema interfaces
│   │   └── test/              # Vitest + React Testing Library test suite (34 tests)
│   ├── .env.local.example     # Frontend environment example (NEXT_PUBLIC_API_BASE_URL)
│   ├── .node-version          # Pinned Node.js 24.21.0 version
│   └── vitest.config.ts       # Vitest configuration with JSDOM
├── docs/
│   └── PRIVACY_AND_MODEL_CARD.md  # Privacy disclosures, model card, & guardrails
├── tests/                     # Automated pytest backend test suite (64 tests)
├── .env.example               # Sanitized backend environment template
├── .gitignore                 # Excludes .env, secrets, and caches
├── render.yaml                # Render Blueprint (FastAPI Web Service + Static Frontend)
├── PRODUCT.md                 # Product specifications & operating directives
├── DESIGN.md                  # Design system tokens & UX architecture
└── AGENTS.md                  # Persistent instructions for AI agents
```

---

## 3. Installation & Setup

### Prerequisites
* Python 3.12+ (tested up to Python 3.14)
* Node.js 24+ & npm
* pip package manager

### A. Backend Setup
```powershell
# Clone the repository
git clone https://github.com/your-username/CashNudge.git
cd CashNudge

# Install Python dependencies
pip install -r requirements.txt
```

### B. Frontend Setup
```powershell
cd frontend
npm install
cd ..
```

---

## 4. Environment Variables Configuration

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

### Backend Configuration (`.env`):

| Variable | Description | Default |
|---|---|---|
| `TABPFN_TOKEN` | Prior Labs TabPFN cloud API key ([priorlabs.ai](https://platform.priorlabs.ai/account/api-keys)) | *(None)* |
| `CASHNUDGE_RISK_THRESHOLD_LOW` | Probability boundary below which risk is Low | `0.35` |
| `CASHNUDGE_RISK_THRESHOLD_HIGH` | Probability boundary at/above which risk is High | `0.70` |
| `CASHNUDGE_MIN_HISTORICAL_SAMPLES` | Minimum historical paid invoices needed to fit model | `5` |
| `GEMMA_PROVIDER` | Gemma provider mode: `mock`, `ollama`, or `hosted` | `mock` |
| `OLLAMA_BASE_URL` | Local Ollama base URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Gemma model identifier in Ollama | `gemma2:2b` |
| `OLLAMA_TIMEOUT_SECONDS` | Ollama generation timeout | `30.0` |
| `GEMMA_HOSTED_BASE_URL` | Base URL for OpenAI-compatible hosted Gemma service | *(None)* |
| `GEMMA_HOSTED_API_KEY` | API key for hosted Gemma endpoint (e.g. OpenRouter) | *(None)* |
| `GEMMA_HOSTED_MODEL` | Hosted Gemma model name (e.g. `google/gemma-4-26b-a4b-it`) | `google/gemma-4-26b-a4b-it` |
| `CORS_ALLOWED_ORIGINS` | Comma-delimited origins allowed for CORS | `http://localhost:3000,http://127.0.0.1:3000` |
| `CASHNUDGE_MAX_UPLOAD_SIZE_BYTES` | Maximum CSV upload size in bytes | `5242880` (5 MB) |
| `RATE_LIMIT_ENABLED` | Enable sliding-window rate limiting | `true` |
| `RATE_LIMIT_LEDGER_PER_MINUTE` | Max requests per minute per IP for ledger analysis | `60` |
| `RATE_LIMIT_FOLLOWUP_PER_MINUTE` | Max requests per minute per IP for AI follow-up drafting | `20` |

### Frontend Configuration (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

> [!CAUTION]
> Never commit `.env` or `.env.local` to Git. Real secrets are ignored via `.gitignore`.

---

## 5. Running Locally

### Start FastAPI Backend:
```powershell
uvicorn backend.main:app --reload --port 8000
```
* **API Base URL:** `http://localhost:8000`
* **Interactive OpenAPI Docs:** `http://localhost:8000/docs`
* **Health Check:** `http://localhost:8000/health`

### Start Next.js Frontend:
```powershell
cd frontend
npm run dev
```
* **Dashboard:** `http://localhost:3000`

---

## 6. Gemma AI Follow-Up Configuration

CashNudge supports three distinct Gemma inference modes configured via `GEMMA_PROVIDER`:

### Option A: Hosted Endpoint (OpenRouter Recommended for Production)
Connect to OpenRouter, Groq, Together AI, or vLLM:
```env
GEMMA_PROVIDER=hosted
GEMMA_HOSTED_BASE_URL=https://openrouter.ai/api/v1
GEMMA_HOSTED_API_KEY=sk-or-v1-your-key
GEMMA_HOSTED_MODEL=google/gemma-4-26b-a4b-it
```

### Option B: Local Ollama (Zero Cloud Inference Cost)
1. Install [Ollama](https://ollama.com) and pull Gemma:
   ```powershell
   ollama pull gemma2:2b
   ollama serve
   ```
2. Configure `.env`:
   ```env
   GEMMA_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=gemma2:2b
   ```

### Option C: Deterministic Mock Provider (Offline / Testing)
```env
GEMMA_PROVIDER=mock
```
Returns structured, human-calibrated follow-up drafts for automated tests and offline development with zero external dependencies.

---

## 7. Email Handoff & Direct Gmail Compose

CashNudge includes a seamless email handoff workflow built directly into the follow-up composer drawer:

### Workflow:
1. **Invoice Selection:** Clicking **Draft Follow-Up** on any invoice opens the composer drawer.
2. **AI Draft Generation:** The Gemma model drafts a grounded message matching the invoice's due date, amount, terms, and selected tone (*Gentle* vs. *Firm*).
3. **Structured Parsing:** The composer automatically parses the subject line from the generated output without duplicating `Subject:` inside the message body.
4. **Editable Fields:**
   * **Recipient Email:** Editable recipient address (validated before handoff; never invented or guessed).
   * **Subject Line:** Editable subject pre-filled from Gemma or deterministic invoice context.
   * **Message Body:** Editable multiline text area with full user edit preservation.
5. **Direct Actions:**
   * **Open in Gmail (Primary):** Constructs a standard `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...` URL and launches a new browser tab directly into Gmail's Compose view with all fields populated.
   * **Email App (Secondary):** Constructs a safe `mailto:` link for desktop mail clients (Outlook, Apple Mail, Thunderbird).
   * **Copy Full Draft / Copy Message (Fallback):** Copies formatted `To: ...\nSubject: ...\n\n<body>` or message body to the clipboard for webmail pasting.
6. **Popup Blocker Recovery:** If a browser popup blocker intercepts the new Gmail tab, CashNudge immediately presents a clear alert with a direct **Open Gmail Directly** link and a **Retry** action.

> [!IMPORTANT]
> **Strict Human-in-the-Loop:** CashNudge contains **no backend email-sending services, SMTP connections, or automatic sending triggers**. Drafts are handed off exclusively to the user's email client, where the freelancer reviews and clicks Send themselves.

---

## 8. Running Automated Tests

CashNudge maintains a comprehensive test suite with **98 automated tests** spanning unit, integration, validation, and end-to-end user workflows.

### A. Backend Pytest Suite (64 Tests)
```powershell
# Run all backend unit, schema, and API tests
python -m pytest tests/ -v
```

To run individual cloud integration smoke tests:
```powershell
# Live Prior Labs Cloud TabPFN inference:
python -m pytest tests/test_integration_tabpfn.py -v

# Live Hosted Gemma inference via OpenRouter:
python -m pytest tests/test_integration_gemma.py -v
```

### B. Frontend Vitest Suite (34 Tests)
```powershell
cd frontend
npm test
```
* **`src/test/email.test.ts` (16 tests):** Validates email format verification, CRLF/newline injection prevention, subject/body separation, fallback subject generation, `mailto:` URL safe encoding, and Gmail Compose URL parameters.
* **`src/test/dashboard.test.tsx` (18 tests):** Validates financial metrics rendering, invoice filtering, risk tier badges, Gemma drafting, tone switching, recipient validation, Gmail Compose tab launching, popup blocker recovery, and clipboard copy fallbacks.

### C. Frontend Type Check & Production Build
```powershell
cd frontend
npx tsc --noEmit
npm run build
```

---

## 9. API Endpoints & PowerShell Examples

### 1. Health Check
* **Endpoint:** `GET /health`
* **Description:** Service liveness verification.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

### 2. Sample Ledger Analysis
* **Endpoint:** `GET /api/v1/ledger/sample`
* **Description:** Analyzes the built-in synthetic freelancer ledger using TabPFN.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ledger/sample" -Method Get | ConvertTo-Json -Depth 5
```

### 3. Upload & Analyze Custom Invoice Ledger CSV
* **Endpoint:** `POST /api/v1/ledger/analyze`
* **Description:** Processes a user-supplied CSV ledger in-memory.

```powershell
$filePath = "backend\sample_data\synthetic_freelancer_invoices.csv"
$form = @{
    file = Get-Item -Path $filePath
}
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ledger/analyze" -Method Post -Form $form | ConvertTo-Json -Depth 5
```

### 4. Draft Payment Follow-Up Reminder
* **Endpoint:** `POST /api/v1/followups/draft`
* **Description:** Generates a fact-grounded payment reminder draft using Gemma.

```powershell
$body = @{
    invoice_id = "INV-2024-021"
    customer_name = "Umbra Games"
    invoice_amount = 9200.00
    currency = "USD"
    payment_terms_days = 30
    due_date = "2024-10-15"
    days_overdue = 14
    tone = "firm"
    business_name = "Studio North"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/followups/draft" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 4
```

---

## 10. AI Provider Transparency

CashNudge strictly labels every model provider on the UI and API response:

| Component | UI / Metadata Label | Real vs. Mock Behavior |
|---|---|---|
| TabPFN | `Prior Labs Hosted TabPFN API` | Authenticates with Prior Labs cloud service via `TABPFN_TOKEN`. |
| TabPFN Fallback | `MockTabPFN (Calibrated Local Pipeline)` | Explicitly selected when no token is configured. Never disguised as real TabPFN. |
| Gemma | `Gemma (Ollama: gemma2:2b)` | Communicates with local running Ollama instance via HTTP. |
| Gemma Hosted | `Gemma (Hosted: google/gemma-4-26b-a4b-it)` | Communicates with external OpenAI-compatible inference endpoint. |
| Gemma Mock | `MockGemmaProvider (Deterministic Development/Test)` | Explicitly selected in development/testing. Never disguised as neural output. |

> [!IMPORTANT]
> **No Silent Fallbacks:** If a real provider is configured and fails (e.g. invalid API key or network timeout), the API returns an explicit error (HTTP 502/503/504) rather than silently substituting mock data.

---

## 11. Privacy, Security & Known Limitations

1. **Client Confidentiality & Zero PII Transmission:**
   * Customer names (`client_name`) and invoice IDs (`invoice_id`) are stripped before tabular feature matrices are passed to TabPFN.
   * CSV uploads are parsed in-memory and discarded immediately upon response delivery. No customer invoices are stored on disk or written to databases.
2. **Untrusted LLM Output Guardrails:**
   * Gemma prompts are strictly constrained against hallucinating payment fees, penalty interest, external payment links, or unauthorized legal threats.
   * Internal risk probabilities are never leaked into customer-facing messages.
3. **Sliding-Window Rate Limiting:**
   * Protects API endpoints against denial-of-service and runaway inference costs.
   * Client IP is extracted safely from the rightmost untrusted address in `X-Forwarded-For` when running behind Render proxies.
4. **Probabilistic Nature of Small Ledgers:**
   * TabPFN estimates on small ledgers are probabilistic risk indicators, not guarantees of client delinquency or payment timing.

For full privacy disclosures, see [`docs/PRIVACY_AND_MODEL_CARD.md`](file:///c:/Users/ACER/Downloads/CashNudge/docs/PRIVACY_AND_MODEL_CARD.md).

---

## 12. Render Deployment Guide

CashNudge is configured for production deployment on Render using the root [`render.yaml`](file:///c:/Users/ACER/Downloads/CashNudge/render.yaml) blueprint.

### Architecture on Render:
1. **Backend Web Service (`cashnudge-backend`):**
   * **Runtime:** Python 3
   * **Plan:** Starter / Free
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   * **Health Check Path:** `/health`
2. **Frontend Static Site (`cashnudge-frontend`):**
   * **Runtime:** Static (`type: web`, `runtime: static`)
   * **Root Directory:** `frontend`
   * **Build Command:** `npm install && npm run build`
   * **Publish Directory:** `out`
   * **Environment Variable:** `NEXT_PUBLIC_API_BASE_URL` (points to the backend service URL)

### Deploying via Render Blueprint:
1. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
2. Connect your GitHub repository.
3. Render automatically parses `render.yaml` and provisions both services.
4. Supply your secret environment variables (`TABPFN_TOKEN`, `GEMMA_HOSTED_API_KEY`) when prompted.
5. Deploy! Once deployed, update `CORS_ALLOWED_ORIGINS` on the backend with your production frontend URL.
