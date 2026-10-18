"""FastAPI application entrypoint for CashNudge backend."""

import io
import os
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid
import logging

from backend.config import settings, TabPFNConfigurationError
from backend.schemas import (
    LedgerAnalysisResult,
    FollowupDraftRequest,
    FollowupDraftResponse,
)
from backend.data_validator import load_and_validate_csv, InvoiceValidationError
from backend.ml_engine import (
    analyze_ledger,
    InsufficientHistoricalDataError,
    InsufficientClassDiversityError,
)
from backend.gemma_provider import (
    get_gemma_provider,
    GemmaConnectionError,
    GemmaModelNotFoundError,
    GemmaTimeoutError,
    GemmaConfigurationError,
    GemmaRateLimitError,
    GemmaResponseError,
    GemmaError,
)
from backend.rate_limiter import RateLimitDependency

SAMPLE_CSV_PATH = Path(__file__).resolve().parent / "sample_data" / "synthetic_freelancer_invoices.csv"

# Configure deployment access logger (strictly excludes sensitive payload data)
logger = logging.getLogger("cashnudge.access")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] [CashNudge] %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

app = FastAPI(
    title="CashNudge API",
    description="AI-powered invoice risk estimation and payment follow-up assistant for freelancers.",
    version="0.1.0",
)

# Safe Observability Middleware: assigns X-Request-ID and logs latency without payload details
@app.middleware("http")
async def safe_observability_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:8]}"
    start_time = time.time()
    
    response = await call_next(request)
    
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    
    # Safe telemetry log: method, path, status, latency. Never logs customer names, amounts, or prompts.
    logger.info(
        f"request_id={request_id} method={request.method} path={request.url.path} "
        f"status={response.status_code} duration_ms={duration_ms}"
    )
    return response

# CORS configuration with explicit environment allowlist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public endpoint rate limiting dependencies
rate_limit_ledger = RateLimitDependency(
    requests_per_minute=settings.rate_limit_ledger_per_minute,
    endpoint_name="ledger",
)
rate_limit_followup = RateLimitDependency(
    requests_per_minute=settings.rate_limit_followup_per_minute,
    endpoint_name="followup_ai",
)


@app.get("/health", tags=["Health"])
def get_health() -> Dict[str, Any]:
    """Health check endpoint confirming API service readiness without exposing sensitive configs."""
    tabpfn_mode = "hosted_cloud" if settings.tabpfn_token else "mock_baseline"
    return {
        "status": "healthy",
        "service": "CashNudge API",
        "version": "0.1.0",
        "providers": {
            "tabpfn_mode": tabpfn_mode,
            "gemma_mode": settings.gemma_provider,
        },
    }


@app.get(
    "/api/v1/ledger/sample",
    response_model=LedgerAnalysisResult,
    dependencies=[Depends(rate_limit_ledger)],
    tags=["Ledger"],
)
def get_sample_ledger_analysis(
    reference_date: Optional[str] = Query(None, description="Explicit reference date for deterministic due status calculations"),
) -> LedgerAnalysisResult:
    """Analyze the built-in synthetic freelancer invoice dataset using the live TabPFN risk engine.
    
    Returns structured risk predictions, deterministic cash-flow metrics, and dataset provenance.
    """
    if not SAMPLE_CSV_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Synthetic benchmark dataset file is missing from backend/sample_data.",
        )

    try:
        df = load_and_validate_csv(SAMPLE_CSV_PATH)
        result = analyze_ledger(df, is_synthetic=True, reference_date=reference_date)
        return result
    except InvoiceValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Synthetic ledger failed validation.", "errors": [err.model_dump() for err in e.errors]},
        )
    except TabPFNConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sample ledger analysis failed: {str(e)}",
        )


@app.post(
    "/api/v1/ledger/analyze",
    response_model=LedgerAnalysisResult,
    dependencies=[Depends(rate_limit_ledger)],
    tags=["Ledger"],
)
async def analyze_uploaded_ledger(
    file: UploadFile = File(...),
    reference_date: Optional[str] = Query(None, description="Explicit reference date for deterministic due status calculations"),
) -> LedgerAnalysisResult:
    """Upload and analyze a client invoice ledger CSV.
    
    Strictly validates required columns, positive amounts, valid terms, and supported statuses.
    Processes data purely in-memory with zero persistent file retention and zero confidential logging.
    """
    # 1. Validate file extension and format
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid CSV document with a .csv extension.",
        )

    # 2. Check upload file size against configured limit
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded CSV file is empty.",
        )

    if len(content) > settings.max_upload_size_bytes:
        max_mb = settings.max_upload_size_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum permitted size of {max_mb:.1f} MB.",
        )

    # 3. Decode CSV content in-memory
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            csv_text = content.decode("latin-1")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode CSV text. Please ensure file is UTF-8 encoded.",
            )

    # 4. Strict schema validation
    buffer = io.StringIO(csv_text)
    try:
        df = load_and_validate_csv(buffer)
    except InvoiceValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": str(e),
                "errors": [err.model_dump() for err in e.errors],
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV parsing failure: {str(e)}",
        )

    # 5. Execute risk modeling pipeline
    try:
        is_synthetic = "synthetic" in filename.lower()
        result = analyze_ledger(df, is_synthetic=is_synthetic, reference_date=reference_date)
        updated_metadata = dict(result.metadata)
        updated_metadata["file_name"] = filename
        return result.model_copy(update={"metadata": updated_metadata})
    except (InsufficientHistoricalDataError, InsufficientClassDiversityError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e), "error_type": type(e).__name__},
        )
    except TabPFNConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(e), "error_type": "TabPFNConfigurationError"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invoice risk estimation pipeline encountered an unexpected error during execution.",
        )


@app.post(
    "/api/v1/followups/draft",
    response_model=FollowupDraftResponse,
    dependencies=[Depends(rate_limit_followup)],
    tags=["Followups"],
)
def draft_payment_followup(request: FollowupDraftRequest) -> FollowupDraftResponse:
    """Generate a polite, relationship-preserving payment follow-up draft using Gemma.
    
    Supports gentle check-ins and firmer reminders. Requires human review and editing before dispatch.
    """
    try:
        provider = get_gemma_provider()
        response = provider.generate_followup(request)
        return response
    except GemmaConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": str(e), "error_type": "GemmaConnectionError"},
        )
    except GemmaModelNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": str(e), "error_type": "GemmaModelNotFoundError"},
        )
    except GemmaTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail={"message": str(e), "error_type": "GemmaTimeoutError"},
        )
    except GemmaConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": str(e), "error_type": "GemmaConfigurationError"},
        )
    except GemmaRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": str(e), "error_type": "GemmaRateLimitError"},
        )
    except GemmaResponseError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": str(e), "error_type": "GemmaResponseError"},
        )
    except GemmaError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": f"Gemma service error: {str(e)}", "error_type": "GemmaError"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected failure during payment follow-up generation.",
        )


if __name__ == "__main__":
    import uvicorn
    bind_port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=bind_port, reload=False)
