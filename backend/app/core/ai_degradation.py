"""
Endpoint-level helpers for AI degradation.

Every AI-calling endpoint follows the same pattern:
  1. Build the data-only fallback payload (data that doesn't need AI).
  2. Try to enrich it with AI output via the cache.
  3. On AI failure, serve stale cache if any exists, otherwise return a
     503 with a structured "degraded" body.

`build_meta` formats the per-response meta dict; `degraded_no_cache_response`
wraps the no-cache failure path so endpoints don't repeat the JSONResponse
boilerplate.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi.responses import JSONResponse

from app.core.ai_provider import AIProviderError


def build_fresh_meta() -> dict[str, Any]:
    return {"status": "fresh"}


def build_stale_meta(age_hours: float) -> dict[str, Any]:
    return {"status": "stale", "cached_age_hours": round(age_hours, 1)}


def build_degraded_with_cache_meta(
    age_hours: float,
    exc: AIProviderError,
) -> dict[str, Any]:
    return {
        "status": "degraded",
        "cached": True,
        "cached_age_hours": round(age_hours, 1),
        "message": exc.user_message,
        "retry_after_hours": exc.retry_after_hours,
    }


def degraded_no_cache_response(exc: AIProviderError) -> JSONResponse:
    """Return a 503 JSONResponse with the structured degraded body for the case
    where no cache entry exists at all."""
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "data": None,
            "meta": {
                "status": "degraded",
                "cached": False,
                "message": exc.user_message,
                "retry_after_hours": exc.retry_after_hours,
            },
        },
    )


def cache_age_hours(generated_at: datetime) -> float:
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - generated_at).total_seconds() / 3600.0
