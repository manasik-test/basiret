"""
Vision + image-generation helpers, layered on top of `ai_provider`.

`analyze_image_url(url)` runs OpenAI GPT-4o Vision against a public image URL
and returns a structured product description used by the caption generator.

`generate_dalle_image(prompt, ratio)` calls DALL-E 3 and returns the temporary
hosted URL (caller is responsible for downloading + re-uploading to R2 before
the URL expires).

Both helpers share the same exception taxonomy as `ai_provider` — quota
errors, transient failures, and bad-response cases all surface as
`AIProviderError` subclasses so endpoints can degrade uniformly. Every
successful call is logged in `ai_usage_log`, identical to the text/json path.

Vision and image-generation calls go through the same per-account rate-limit
gate as the text providers (OpenAI bucket).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.ai_provider import (
    AIInvalidResponseError,
    AIProviderError,
    AIProviderUnavailableError,
    AIQuotaExceededError,
    AISource,
    _check_rate_limit,
    _log_usage,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Aspect-ratio mapping ─────────────────────────────────────────────────

# DALL-E 3 only accepts these three exact sizes. We map the Post Creator's
# 1:1 / 4:5 / 16:9 ratios to the closest supported size and let the user
# crop on the frontend if they need an exact 4:5.
_RATIO_TO_DALLE_SIZE: dict[str, str] = {
    "1:1": "1024x1024",
    "4:5": "1024x1792",   # closest portrait (DALL-E only ships 1024x1792)
    "16:9": "1792x1024",
}


def dalle_size_for_ratio(ratio: str) -> str:
    return _RATIO_TO_DALLE_SIZE.get(ratio, "1024x1024")


# ── OpenAI client + exception mapping ────────────────────────────────────


def _openai_client():
    from openai import OpenAI
    if not settings.OPENAI_API_KEY:
        raise AIProviderUnavailableError(
            "OPENAI_API_KEY not configured", provider="openai",
        )
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _map_openai_exception(exc: Exception) -> AIProviderError:
    cls_name = exc.__class__.__name__
    msg = str(exc)
    if cls_name == "RateLimitError" or "429" in msg or "rate_limit" in msg.lower():
        return AIQuotaExceededError(msg, provider="openai")
    if cls_name in (
        "APITimeoutError",
        "APIConnectionError",
        "InternalServerError",
        "APIStatusError",
    ):
        return AIProviderUnavailableError(msg, provider="openai")
    if cls_name == "AuthenticationError":
        return AIProviderUnavailableError(
            "OpenAI authentication failed", provider="openai",
        )
    if "timeout" in msg.lower() or "connection" in msg.lower():
        return AIProviderUnavailableError(msg, provider="openai")
    logger.warning("OpenAI image/vision call failed (%s): %s", cls_name, exc)
    return AIProviderUnavailableError(msg, provider="openai")


# ── Vision: analyze an uploaded product image ────────────────────────────


_VISION_SYSTEM = (
    "You are a product-photography analyst for an Instagram content tool. "
    "Given an uploaded image, return a tight JSON object with exactly these keys: "
    "product_description (one short sentence describing what's in the image, "
    "no marketing fluff), detected_style (one of: 'luxury', 'minimal', 'vibrant', "
    "'clean', 'playful'), dominant_colors (array of 2-4 hex strings starting with #), "
    "suggested_tone (one of: 'professional', 'friendly', 'luxurious', 'playful', "
    "'inspiring'), content_suggestions (array of exactly 3 short content angles "
    "the creator could use, each 2-5 words). "
    "Return ONLY the JSON object — no preamble, no code fences, no commentary."
)


def analyze_image_url(
    image_url: str,
    *,
    account_id: str | None = None,
    source: AISource = "user",
) -> dict[str, Any]:
    """Run GPT-4o Vision on a publicly-accessible image URL and return the
    structured description.

    Raises an `AIProviderError` subclass on quota, transport, or parsing
    failures — never returns a partial dict.
    """
    if source == "user":
        _check_rate_limit(provider="openai", account_id=account_id, task="vision")

    client = _openai_client()
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _VISION_SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Analyze this product image."},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                },
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
    except AIProviderError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _map_openai_exception(exc) from exc

    try:
        raw = (resp.choices[0].message.content or "").strip()
    except (IndexError, AttributeError) as exc:
        raise AIInvalidResponseError(
            "OpenAI vision response missing choices[0].message.content",
            provider="openai",
        ) from exc

    if not raw:
        raise AIInvalidResponseError(
            "OpenAI vision returned empty body", provider="openai",
        )

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise AIInvalidResponseError(
            f"OpenAI vision returned non-JSON: {exc}", provider="openai",
        ) from exc

    if not isinstance(parsed, dict):
        raise AIInvalidResponseError(
            "OpenAI vision JSON wasn't an object", provider="openai",
        )

    # Normalize: ensure all expected keys exist with sane defaults so the
    # caller can store the dict directly without per-key existence checks.
    normalized = {
        "product_description": str(parsed.get("product_description") or "").strip(),
        "detected_style": str(parsed.get("detected_style") or "clean").strip().lower(),
        "dominant_colors": [
            c for c in (parsed.get("dominant_colors") or []) if isinstance(c, str)
        ][:4],
        "suggested_tone": str(parsed.get("suggested_tone") or "friendly").strip().lower(),
        "content_suggestions": [
            s for s in (parsed.get("content_suggestions") or []) if isinstance(s, str)
        ][:3],
    }

    if not normalized["product_description"]:
        raise AIInvalidResponseError(
            "OpenAI vision returned no product_description", provider="openai",
        )

    tokens = getattr(getattr(resp, "usage", None), "total_tokens", None)
    _log_usage(
        provider="openai", task="vision", account_id=account_id,
        source=source, tokens_used=tokens,
    )
    return normalized


# ── Image generation: DALL-E 3 ───────────────────────────────────────────


def generate_dalle_image(
    prompt: str,
    *,
    ratio: str = "1:1",
    account_id: str | None = None,
    source: AISource = "user",
) -> dict[str, Any]:
    """Call DALL-E 3 with `prompt` + a size derived from `ratio`. Returns
    `{"url": <temporary OpenAI-hosted URL>, "revised_prompt": <str>}`.

    The returned URL expires within ~1 hour — callers are expected to download
    the bytes immediately and re-upload to R2 (see `posts_creator.generate_image`).

    Logs a single ai_usage_log row with `tokens_used=0` (DALL-E charges per
    image, not per token, so the existing tokens column is left empty).
    """
    if source == "user":
        _check_rate_limit(
            provider="openai", account_id=account_id, task="image_generation",
        )

    size = dalle_size_for_ratio(ratio)
    client = _openai_client()
    try:
        resp = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            n=1,
            quality="standard",
            response_format="url",
        )
    except AIProviderError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise _map_openai_exception(exc) from exc

    try:
        first = resp.data[0]
        url = getattr(first, "url", None) or ""
        revised = getattr(first, "revised_prompt", None) or prompt
    except (IndexError, AttributeError) as exc:
        raise AIInvalidResponseError(
            "DALL-E response missing data[0].url", provider="openai",
        ) from exc

    if not url:
        raise AIInvalidResponseError(
            "DALL-E returned empty url", provider="openai",
        )

    # DALL-E doesn't bill per token; log the call with tokens_used=0 so the
    # admin dashboard still shows the call volume per account.
    _log_usage(
        provider="openai", task="image_generation", account_id=account_id,
        source=source, tokens_used=0,
    )
    return {"url": url, "revised_prompt": revised, "size": size}
