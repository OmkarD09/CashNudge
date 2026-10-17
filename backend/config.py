"""Configuration management for CashNudge Risk Engine."""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load .env file from project root if present
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")


class TabPFNConfigurationError(Exception):
    """Raised when TabPFN API credentials or configurations are missing or invalid."""
    pass


class Settings:
    """CashNudge application and risk model settings."""

    def __init__(self):
        self._tabpfn_token: Optional[str] = os.getenv("TABPFN_TOKEN")
        
        # Risk tier threshold boundaries
        try:
            self.risk_threshold_low: float = float(
                os.getenv("CASHNUDGE_RISK_THRESHOLD_LOW", "0.35")
            )
        except ValueError:
            self.risk_threshold_low = 0.35

        try:
            self.risk_threshold_high: float = float(
                os.getenv("CASHNUDGE_RISK_THRESHOLD_HIGH", "0.70")
            )
        except ValueError:
            self.risk_threshold_high = 0.70

        # Minimum historical samples required
        try:
            self.min_historical_samples: int = int(
                os.getenv("CASHNUDGE_MIN_HISTORICAL_SAMPLES", "5")
            )
        except ValueError:
            self.min_historical_samples = 5

        # Maximum upload size in bytes (default 5MB)
        try:
            self.max_upload_size_bytes: int = int(
                os.getenv("CASHNUDGE_MAX_UPLOAD_SIZE_BYTES", str(5 * 1024 * 1024))
            )
        except ValueError:
            self.max_upload_size_bytes = 5 * 1024 * 1024

        # CORS allowed origins (retaining localhost for dev while supporting Render production origins)
        raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        self.cors_allowed_origins = [orig.strip().rstrip("/") for orig in raw_origins.split(",") if orig.strip()]

        # Public API rate limiting & abuse protection
        self.rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() in ("true", "1", "yes")
        try:
            self.rate_limit_ledger_per_minute = int(os.getenv("RATE_LIMIT_LEDGER_PER_MINUTE", "60"))
        except ValueError:
            self.rate_limit_ledger_per_minute = 60

        try:
            self.rate_limit_followup_per_minute = int(os.getenv("RATE_LIMIT_FOLLOWUP_PER_MINUTE", "20"))
        except ValueError:
            self.rate_limit_followup_per_minute = 20

    @property
    def gemma_provider(self) -> str:
        """Gemma provider type: 'mock', 'ollama', or 'hosted'."""
        return os.getenv("GEMMA_PROVIDER", "mock").strip().lower()

    @property
    def ollama_base_url(self) -> str:
        """Ollama server base URL."""
        return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

    @property
    def ollama_model(self) -> str:
        """Ollama Gemma model name."""
        return os.getenv("OLLAMA_MODEL", "gemma2:2b").strip()

    @property
    def ollama_timeout_seconds(self) -> float:
        """Ollama request timeout in seconds."""
        try:
            return float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30.0"))
        except ValueError:
            return 30.0

    @property
    def gemma_hosted_base_url(self) -> str:
        """OpenAI-compatible hosted API base URL for Gemma."""
        url = os.getenv("GEMMA_HOSTED_BASE_URL", "https://openrouter.ai/api/v1")
        return url.rstrip("/")

    @property
    def gemma_hosted_api_key(self) -> Optional[str]:
        """API key for hosted Gemma inference."""
        return os.getenv("GEMMA_HOSTED_API_KEY")

    @property
    def gemma_hosted_model(self) -> str:
        """Hosted model identifier."""
        return os.getenv("GEMMA_HOSTED_MODEL", "google/gemma-4-26b-a4b-it").strip()

    @property
    def tabpfn_token(self) -> Optional[str]:
        """Dynamic access to current TABPFN_TOKEN in environment."""
        if "TABPFN_TOKEN" in os.environ:
            return os.environ.get("TABPFN_TOKEN")
        return self._tabpfn_token

    def require_tabpfn_token(self) -> str:
        """Validate and return TABPFN_TOKEN or raise TabPFNConfigurationError."""
        token = self.tabpfn_token
        if not token or token.strip() == "" or token == "your_tabpfn_api_token_here":
            raise TabPFNConfigurationError(
                "Missing Prior Labs TabPFN access token.\n"
                "To run real TabPFN cloud inference:\n"
                "1. Sign up / log in at https://platform.priorlabs.ai/account/api-keys\n"
                "2. Create an API key\n"
                "3. Set the TABPFN_TOKEN environment variable (or add TABPFN_TOKEN=your_token in .env)\n"
                "For automated unit tests and offline testing, use the mock/baseline provider."
            )
        return token.strip()


settings = Settings()
