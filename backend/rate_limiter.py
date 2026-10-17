"""Lightweight in-memory rate limiter for CashNudge public API abuse protection."""

import time
import ipaddress
from collections import defaultdict, deque
from typing import Dict, Tuple, Optional
from threading import Lock

from fastapi import Request, HTTPException, status
from backend.config import settings


class InMemoryRateLimiter:
    """Thread-safe sliding-window in-memory rate limiter.
    
    Tracks request timestamps per client IP within a configurable sliding window.
    Designed for single-instance container deployments (e.g., Render free/starter tiers)
    without requiring external infrastructure (like Redis).
    """

    def __init__(self) -> None:
        self._history: Dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def check(
        self, client_id: str, max_requests: int, window_seconds: int = 60
    ) -> Tuple[bool, int, int]:
        """Check if a request from client_id is allowed under the rate limit.
        
        Args:
            client_id: Client identifier (IP address).
            max_requests: Maximum allowed requests in the sliding window.
            window_seconds: Window size in seconds (default 60s).
            
        Returns:
            Tuple of (is_allowed: bool, remaining_requests: int, retry_after_seconds: int).
        """
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._history[client_id]

            # Prune timestamps outside the current sliding window
            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            # Clean empty keys to prevent unbounded memory growth
            if not timestamps and client_id in self._history:
                del self._history[client_id]
                timestamps = self._history[client_id]

            current_count = len(timestamps)

            if current_count >= max_requests:
                # Rate limit exceeded; calculate wait time until oldest request rolls off
                oldest_ts = timestamps[0]
                retry_after = max(1, int(oldest_ts + window_seconds - now))
                return False, 0, retry_after

            # Record current request
            timestamps.append(now)
            remaining = max(0, max_requests - current_count - 1)
            return True, remaining, 0

    def reset(self) -> None:
        """Reset all rate limiter tracking history (primarily for tests)."""
        with self._lock:
            self._history.clear()


# Global in-memory rate limiter instance
limiter = InMemoryRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP address safely, compatible with Render's proxy setup.

    Security & Anti-Spoofing Strategy:
    1. Render's edge layer is powered by Cloudflare, which sets the `cf-connecting-ip`
       header to the connecting client's IP. Cloudflare strips/overwrites any client-supplied
       `cf-connecting-ip`, making it immune to header-injection spoofing.
    2. When evaluating `x-forwarded-for`, reverse proxies append the client IP to the
       end (right-hand side) of the header list. Blindly reading the first (leftmost) IP
       allows attackers to bypass rate limits by prefixing arbitrary IPs (e.g.,
       `X-Forwarded-For: spoofed_ip, real_client_ip`). Reading from the rightmost hop
       ensures we bind the rate limit to the proxy-verified connecting IP.
    3. We validate each IP using `ipaddress.ip_address` to prevent header injection of
       malformed strings.
    4. Fall back to `x-real-ip`, `request.client.host`, and finally `127.0.0.1`.
    """
    # 1. Cloudflare edge header on Render (unforgeable by client)
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        candidate = cf_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    # 2. X-Forwarded-For: traverse in reverse order (rightmost = proxy-appended verified hop)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        raw_parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
        for part in reversed(raw_parts):
            try:
                ipaddress.ip_address(part)
                return part
            except ValueError:
                continue

    # 3. X-Real-IP fallback (if provided by trusted single-hop proxy)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        candidate = real_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    # 4. Direct socket client host
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


class RateLimitDependency:
    """Callable FastAPI dependency to enforce rate limits per endpoint."""

    def __init__(self, requests_per_minute: int, endpoint_name: str = "endpoint") -> None:
        self.requests_per_minute = requests_per_minute
        self.endpoint_name = endpoint_name

    async def __call__(self, request: Request) -> None:
        if not getattr(settings, "rate_limit_enabled", True):
            return

        client_ip = get_client_ip(request)
        allowed, remaining, retry_after = limiter.check(
            client_id=f"{client_ip}:{self.endpoint_name}",
            max_requests=self.requests_per_minute,
            window_seconds=60,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": f"Rate limit exceeded for {self.endpoint_name}. Please wait {retry_after} seconds.",
                    "error_type": "ClientRateLimitError",
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )
