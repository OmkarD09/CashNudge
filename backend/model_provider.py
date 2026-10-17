"""TabPFN Model Providers and Classifier Adapters for CashNudge."""

from abc import ABC, abstractmethod
from typing import Optional, Union, List, Any
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

from backend.config import settings, TabPFNConfigurationError
from backend.feature_extractor import CATEGORICAL_FEATURES, NUMERICAL_FEATURES


class BaseRiskClassifier(ABC):
    """Abstract base class for invoice risk classifiers."""

    @abstractmethod
    def fit(self, X: pd.DataFrame, y: Union[pd.Series, np.ndarray]) -> "BaseRiskClassifier":
        """Fit the classifier on historical invoice features and outcomes."""
        pass

    @abstractmethod
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Return class probabilities of shape (N, 2), where column 1 is late payment probability."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the underlying provider."""
        pass


class HostedTabPFNProvider(BaseRiskClassifier):
    """Official Prior Labs cloud-hosted TabPFN inference client."""

    def __init__(self, token: Optional[str] = None):
        if token is not None:
            if not token.strip() or token == "your_tabpfn_api_token_here":
                raise TabPFNConfigurationError(
                    "Missing Prior Labs TabPFN access token.\n"
                    "Please provide a valid token or set the TABPFN_TOKEN environment variable."
                )
            self._token = token.strip()
        else:
            self._token = settings.require_tabpfn_token()

        try:
            import tabpfn_client
            # Set the access token explicitly for the client session
            tabpfn_client.set_access_token(self._token)
            self._client = tabpfn_client.TabPFNClassifier()
        except TabPFNConfigurationError:
            raise
        except Exception as e:
            raise TabPFNConfigurationError(
                f"Failed to initialize Prior Labs TabPFN client: {str(e)}"
            )

    def fit(self, X: pd.DataFrame, y: Union[pd.Series, np.ndarray]) -> "HostedTabPFNProvider":
        try:
            # Ensure categorical columns are properly typed
            X_clean = X.copy()
            for col in CATEGORICAL_FEATURES:
                if col in X_clean.columns:
                    X_clean[col] = X_clean[col].astype("category")
            
            y_arr = np.array(y, dtype=int)
            self._client.fit(X_clean, y_arr)
            return self
        except Exception as e:
            if "No TabPFN access token found" in str(e) or "token" in str(e).lower():
                raise TabPFNConfigurationError(
                    f"Authentication error during TabPFN fit: {str(e)}"
                )
            raise RuntimeError(f"Hosted TabPFN inference failed during fit: {str(e)}") from e

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if X is None or X.empty:
            return np.empty((0, 2))
        try:
            X_clean = X.copy()
            for col in CATEGORICAL_FEATURES:
                if col in X_clean.columns:
                    X_clean[col] = X_clean[col].astype("category")
            
            probs = self._client.predict_proba(X_clean)
            return np.asarray(probs, dtype=float)
        except Exception as e:
            raise RuntimeError(f"Hosted TabPFN inference failed during predict_proba: {str(e)}") from e

    @property
    def provider_name(self) -> str:
        return "Prior Labs Hosted TabPFN API"


class MockTabPFNProvider(BaseRiskClassifier):
    """Calibrated offline classifier for automated testing and CI/CD without API keys."""

    def __init__(self, precomputed_probs: Optional[List[float]] = None, random_state: int = 42):
        self._precomputed_probs = precomputed_probs
        self._random_state = random_state
        self._pipeline: Optional[Pipeline] = None
        self._classes: np.ndarray = np.array([0, 1])

    def fit(self, X: pd.DataFrame, y: Union[pd.Series, np.ndarray]) -> "MockTabPFNProvider":
        y_arr = np.array(y, dtype=int)
        unique_classes = np.unique(y_arr)
        
        # Verify binary class presence
        if len(unique_classes) < 2:
            raise ValueError(
                f"Binary classification requires both classes (0 and 1). Found: {unique_classes}"
            )

        cat_cols = [c for c in CATEGORICAL_FEATURES if c in X.columns]
        num_cols = [c for c in NUMERICAL_FEATURES if c in X.columns]

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
                ("num", StandardScaler(), num_cols),
            ],
            remainder="drop",
        )

        clf = RandomForestClassifier(
            n_estimators=30,
            max_depth=4,
            random_state=self._random_state,
        )

        self._pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier", clf),
        ])

        self._pipeline.fit(X, y_arr)
        self._classes = clf.classes_
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if X is None or X.empty:
            return np.empty((0, 2))

        if self._precomputed_probs is not None:
            if len(self._precomputed_probs) != len(X):
                raise ValueError(
                    f"Precomputed probs length ({len(self._precomputed_probs)}) does not match rows ({len(X)})"
                )
            p1 = np.clip(np.array(self._precomputed_probs, dtype=float), 0.0, 1.0)
            p0 = 1.0 - p1
            return np.column_stack([p0, p1])

        if self._pipeline is None:
            raise RuntimeError("Model has not been fitted yet. Call fit() first.")

        probs = self._pipeline.predict_proba(X)
        # Handle cases where model classes are mapped
        if len(self._classes) == 2:
            idx_1 = np.where(self._classes == 1)[0][0]
            p1 = probs[:, idx_1]
            p0 = 1.0 - p1
            return np.column_stack([p0, p1])
        return probs

    @property
    def provider_name(self) -> str:
        return "MockTabPFN (Calibrated Local Pipeline)"


def get_risk_classifier(
    provider_type: Optional[str] = None,
    mock_probs: Optional[List[float]] = None
) -> BaseRiskClassifier:
    """Factory to retrieve the appropriate classifier adapter.
    
    Args:
        provider_type: 'hosted', 'mock', or None (auto-detect based on TABPFN_TOKEN).
        mock_probs: Optional list of probabilities for deterministic testing.
    """
    if provider_type == "mock":
        return MockTabPFNProvider(precomputed_probs=mock_probs)

    if provider_type == "hosted":
        return HostedTabPFNProvider()

    # Auto-detect: if token is set and valid, use hosted; otherwise if in testing mode, use mock
    token = settings.tabpfn_token
    if token and token.strip() and token != "your_tabpfn_api_token_here":
        try:
            return HostedTabPFNProvider(token=token.strip())
        except Exception:
            # Fall back to mock if initialization fails in auto-detect mode
            return MockTabPFNProvider(precomputed_probs=mock_probs)

    return MockTabPFNProvider(precomputed_probs=mock_probs)
