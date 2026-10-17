# CashNudge — AI-Powered Invoice Risk & Payment Follow-Up Assistant

> **"Know the risk. Nudge the payment."**

CashNudge provides freelancers, solo contractors, and micro-agencies with early probabilistic intelligence on invoice late-payment risk and generates grounded, relationship-preserving payment follow-up reminders.

---

## 1. Architecture Overview

CashNudge Phase 2 provides a modular Python backend consisting of:

```text
CashNudge/
├── backend/
│   ├── __init__.py
│   ├── config.py              # Environment configuration & settings management
│   ├── schemas.py             # Pydantic v2 data models, enums, & payload schemas
│   ├── data_validator.py      # Strict CSV loading & schema validation
│   ├── feature_extractor.py   # Predictive feature isolation & privacy boundary
│   ├── model_provider.py      # TabPFN classifier adapters (Prior Labs Hosted API + Mock)
│   ├── ml_engine.py           # Tabular risk estimation pipeline & cash-flow metrics
│   ├── prompt_builder.py      # Factual prompt generator with safety guardrails
│   ├── gemma_provider.py      # Gemma follow-up drafter (Ollama, Hosted, Mock)
│   ├── main.py                # FastAPI HTTP application & endpoints
│   ├── cli.py                 # Command-line runner for batch ledger analysis
│   └── sample_data/
│       └── synthetic_freelancer_invoices.csv  # Synthetic benchmark dataset (24 invoices)
├── frontend/                  # Next.js 16 App Router + Tailwind CSS + TypeScript
│   ├── src/
│   │   ├── app/               # App Router pages and layout
│   │   ├── components/        # Bento cards, Invoice table, Composer drawer, Upload modal
│   │   ├── lib/api.ts         # Centralized typed HTTP API client
│   │   ├── types/             # TypeScript backend schema interfaces
│   │   └── test/              # Vitest + React Testing Library test suite
│   ├── .env.local.example     # Frontend environment example (NEXT_PUBLIC_API_BASE_URL)
│   └── vitest.config.ts       # Vitest configuration with JSDOM
├── docs/
│   └── PRIVACY_AND_MODEL_CARD.md  # Privacy disclosures & model card
├── tests/                     # 45 automated pytest backend tests
├── .env.example               # Sanitized backend environment template
├── .gitignore                 # Excludes .env, secrets, and caches
├── PRODUCT.md                 # Product specifications & operating directives
├── DESIGN.md                  # Design system tokens & UX architecture
└── AGENTS.md                  # Persistent instructions for AI agents
```

---

## 2. Installation & Setup

### Prerequisites
* Python 3.12+ (tested up to Python 3.14 on Windows)
* pip package manager

### Install Dependencies
```powershell
pip install pandas scikit-learn tabpfn-client fastapi uvicorn httpx python-multipart python-dotenv pytest
```

---

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

### Environment Keys in `.env`:

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
| `GEMMA_HOSTED_API_KEY` | API key for hosted Gemma endpoint | *(None)* |
| `GEMMA_HOSTED_MODEL` | Hosted Gemma model name (e.g. `google/gemma-4-26b-a4b-it`) | `google/gemma-4-26b-a4b-it` |
| `CORS_ALLOWED_ORIGINS` | Comma-delimited origins allowed for CORS | `http://localhost:3000,http://127.0.0.1:3000` |
| `CASHNUDGE_MAX_UPLOAD_SIZE_BYTES` | Maximum CSV upload size in bytes | `5242880` (5 MB) |
| `RATE_LIMIT_ENABLED` | Enable client-side sliding-window rate limiting | `true` |
| `RATE_LIMIT_LEDGER_PER_MINUTE` | Max requests per minute per IP for ledger analysis | `60` |
| `RATE_LIMIT_FOLLOWUP_PER_MINUTE` | Max requests per minute per IP for AI follow-up drafting | `20` |

> [!CAUTION]
> Never commit `.env` to Git. Real tokens are automatically ignored via `.gitignore`.

---

## 4. Starting the FastAPI Server

Start the local development server with Uvicorn:

```powershell
uvicorn backend.main:app --reload --port 8000
```

* API Base URL: `http://localhost:8000`
* Interactive OpenAPI Docs: `http://localhost:8000/docs`
* ReDoc Documentation: `http://localhost:8000/redoc`

---

## 5. Gemma Follow-Up Configuration

CashNudge supports three distinct Gemma backends configured via `GEMMA_PROVIDER`:

### Option A: Local Ollama (Self-Hosted / Local)
1. Install [Ollama](https://ollama.com) and pull a Gemma model:
   ```powershell
   ollama pull gemma2:2b
   ```
2. Start the Ollama server:
   ```powershell
   ollama serve
   ```
3. Set in `.env`:
   ```env
   GEMMA_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=gemma2:2b
   ```

### Option B: Hosted OpenAI-Compatible Endpoint (OpenRouter Recommended)
Connect to OpenRouter, Groq, Together AI, or vLLM:
```env
GEMMA_PROVIDER=hosted
GEMMA_HOSTED_BASE_URL=https://openrouter.ai/api/v1
GEMMA_HOSTED_API_KEY=your_openrouter_api_key
GEMMA_HOSTED_MODEL=google/gemma-4-26b-a4b-it
```

### Option C: Deterministic Mock Provider (Zero Credentials)
```env
GEMMA_PROVIDER=mock
```
Returns structured, human-calibrated follow-up drafts for automated tests and offline development.

---

## 6. Starting the Next.js Frontend Dashboard

The frontend is built with Next.js 16 App Router, TypeScript, and Tailwind CSS.

### Setup and Start:
```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start the Next.js development server
npm run dev
```

The frontend will run at: **`http://localhost:3000`**

It automatically connects to the backend API configured via `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

---

## 7. Running Tests

### A. Backend Pytest Suite (48 tests)
Run the full pytest suite (automated unit, schema, integration, and endpoint tests):
```powershell
python -m pytest tests/ -v
```

To run individual live integration smoke tests against external cloud APIs:
```powershell
# Live Prior Labs Cloud TabPFN inference:
python -m pytest tests/test_integration_tabpfn.py -v

# Live Hosted Gemma inference via OpenRouter:
python -m pytest tests/test_integration_gemma.py -v
```

### B. Frontend Test Suite (Vitest + React Testing Library)
Run the automated frontend unit and interaction tests:
```powershell
cd frontend
npm test
```

To build and verify the production bundle and type checking:
```powershell
cd frontend
npm run build
```

---

## 8. API Endpoints & PowerShell Examples

### 1. Health Check
* **Endpoint:** `GET /health`
* **Description:** Confirms service availability without revealing secrets.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

**Example Response:**
```json
{
  "status": "healthy",
  "service": "CashNudge API",
  "version": "0.1.0"
}
```

---

### 2. Sample Ledger Analysis
* **Endpoint:** `GET /api/v1/ledger/sample`
* **Description:** Analyzes the built-in synthetic freelancer ledger using the configured TabPFN engine.

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ledger/sample" -Method Get | ConvertTo-Json -Depth 5
```

**Example Response Excerpt:**
```json
{
  "summary": {
    "total_invoices": 24,
    "historical_invoices_count": 18,
    "historical_on_time_count": 11,
    "historical_late_count": 7,
    "historical_late_rate": 0.3889,
    "outstanding_invoices_count": 6,
    "total_outstanding_amount": 42000.0,
    "at_risk_amount": 28600.0,
    "high_risk_amount": 24700.0,
    "medium_risk_amount": 3900.0,
    "low_risk_amount": 13400.0
  },
  "predictions": [
    {
      "invoice_id": "INV-2024-019",
      "client_name": "Silverline Fintech",
      "invoice_amount": 15500.0,
      "payment_terms_days": 60,
      "late_probability": 0.951,
      "risk_tier": "high",
      "top_risk_factors": [
        "Client history shows 2 prior late payments",
        "Long contractual terms (60 days) heighten payment latency risk",
        "High scope volatility (3 revisions) correlated with approval delays",
        "Invoice amount ($15,500.00) significantly exceeds historical median ($7,800.00)"
      ]
    }
  ],
  "metadata": {
    "model_provider": "Prior Labs Hosted TabPFN API",
    "is_synthetic_data": true
  }
}
```

---

### 3. Upload and Analyze Custom Invoice Ledger CSV
* **Endpoint:** `POST /api/v1/ledger/analyze`
* **Description:** Upload custom CSV via multipart form-data. Processed entirely in-memory.

```powershell
$filePath = "backend\sample_data\synthetic_freelancer_invoices.csv"
$form = @{
    file = Get-Item -Path $filePath
}
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ledger/analyze" -Method Post -Form $form | ConvertTo-Json -Depth 5
```

---

### 4. Draft Payment Follow-Up Reminder
* **Endpoint:** `POST /api/v1/followups/draft`
* **Description:** Generates a grounded reminder draft for a specific invoice using Gemma.

#### Gentle Tone Check-in:
```powershell
$body = @{
    invoice_id = "INV-2024-020"
    customer_name = "Terraform Spatial"
    invoice_amount = 6800.00
    currency = "USD"
    payment_terms_days = 30
    due_date = "2024-11-20"
    tone = "gentle"
    business_name = "Studio North"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/followups/draft" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 4
```

#### Firm Reminder for Overdue Balance:
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

## 8. Real vs. Mock Provider Transparency

CashNudge strictly isolates and accurately labels every AI provider:

| Component | Provider Label | Real vs. Mock Behavior |
|---|---|---|
| TabPFN | `Prior Labs Hosted TabPFN API` | Authenticates with Prior Labs cloud service via `TABPFN_TOKEN`. |
| TabPFN Fallback | `MockTabPFN (Calibrated Local Pipeline)` | Explicitly selected or used when no token is configured. Never disguised as TabPFN. |
| Gemma | `Gemma (Ollama: gemma2:2b)` | Communicates with local running Ollama instance via HTTP. |
| Gemma Hosted | `Gemma (Hosted: gemma2-9b-it)` | Communicates with external OpenAI-compatible inference endpoint. |
| Gemma Fallback | `MockGemmaProvider (Deterministic Development/Test)` | Explicitly configured in development/testing. Never disguised as real neural output. |

> [!IMPORTANT]
> **No Silent Fallbacks:** If a real provider is configured and fails (e.g., Ollama is not running, or an API key is invalid), the API returns an actionable error (HTTP 502/503/504) rather than silently returning mock outputs.

---

## 9. Privacy, Security & Known Limitations

1. **Client Confidentiality:**
   * Customer names (`client_name`) and transaction identifiers (`invoice_id`) are stripped before tabular feature matrices are passed to TabPFN.
   * CSV uploads are parsed in-memory and discarded upon response delivery; no customer invoices are saved to disk or logged to files.
2. **Untrusted LLM Output & Human Approval:**
   * Gemma is strictly constrained by prompt guardrails against inventing financial amounts, interest, late fees, or legal threats.
   * Internal risk probabilities are never disclosed in generated messages.
   * All drafted messages require human review and editing. CashNudge contains **no autonomous email, SMS, or dispatch mechanisms**.
3. **Synthetic Dataset & Small-Sample Notice:**
   * The benchmark ledger (`synthetic_freelancer_invoices.csv`) contains 24 synthetic records.
   * Prior-data estimates on small ledgers are probabilistic approximations, not guarantees of client behavior or collection certainty.

---

## 10. Render Deployment Readiness

CashNudge is architected for clean separation between the FastAPI inference backend and the Next.js frontend.

### A. FastAPI Backend Deployment (Render Web Service)
1. **Service Type**: Web Service
2. **Environment**: Python 3.12+
3. **Root Directory**: `.` (Repository root)
4. **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Start Command**:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
6. **Required Environment Variables**:
   * `TABPFN_TOKEN`: Prior Labs API Key (`tabpfn_sk_...`)
   * `GEMMA_PROVIDER`: `hosted`
   * `GEMMA_HOSTED_BASE_URL`: `https://openrouter.ai/api/v1`
   * `GEMMA_HOSTED_API_KEY`: OpenRouter API Key (`sk-or-v1-...`)
   * `GEMMA_HOSTED_MODEL`: `google/gemma-4-26b-a4b-it`
   * `CORS_ALLOWED_ORIGINS`: `https://<your-frontend-service>.onrender.com,http://localhost:3000`

### B. Next.js Frontend Deployment (Render Static Site — $0/mo Free Tier)
1. **Service Type**: Static Site
2. **Environment**: Node.js 20+
3. **Root Directory**: `frontend`
4. **Build Command**:
   ```bash
   npm install && npm run build
   ```
5. **Publish Directory**: `out`
6. **Required Environment Variables**:
   * `NEXT_PUBLIC_API_BASE_URL`: `https://<your-backend-service>.onrender.com`
7. **Cost**: **$0.00/month** (Hosted across Render's global CDN edge, zero cold-starts, preserving your $50 credits entirely for the backend web service).

### C. Automated Deployment with Render Blueprint
You can deploy both services together using the included [`render.yaml`](file:///c:/Users/ACER/Downloads/CashNudge/render.yaml):
1. In the Render Dashboard, click **New +** > **Blueprint**.
2. Connect your Git repository.
3. Render will detect `render.yaml` and configure both `cashnudge-backend` and `cashnudge-frontend`.
4. Enter your secret keys (`TABPFN_TOKEN`, `GEMMA_HOSTED_API_KEY`) when prompted.
5. Deploy!

