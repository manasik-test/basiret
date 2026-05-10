"""
Vision + image-generation helpers, layered on top of `ai_provider`.

`analyze_image_url(url)` runs OpenAI GPT-4o Vision against a public image URL
and returns a structured product description used by the caption generator.

`generate_dalle_image(prompt, ratio)` is the image-generation entry point.
Despite the name, it tries Gemini 2.0 Flash image generation
(`gemini-2.0-flash-exp-image-generation`) first and falls back to DALL-E 3
when Gemini fails — so callers don't need to know which provider produced
the image. The function uploads the bytes to R2 internally on the Gemini
path and returns a persistent URL; the DALL-E fallback returns OpenAI's
ephemeral URL and relies on the caller to re-upload.

Both helpers share the same exception taxonomy as `ai_provider` — quota
errors, billing limits, transient failures, and bad-response cases all
surface as `AIProviderError` subclasses so endpoints can degrade uniformly.
Every successful call is logged in `ai_usage_log`, identical to the
text/json path; the `provider` column distinguishes which backend served
the request.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.ai_provider import (
    AIBillingLimitError,
    AIInvalidResponseError,
    AIProviderError,
    AIProviderUnavailableError,
    AIQuotaExceededError,
    AISource,
    _check_rate_limit,
    _log_usage,
)
from app.core.config import settings
from app.core.storage import upload_media

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
    msg_lower = msg.lower()
    # Billing-cap errors come back as BadRequestError; route to a dedicated
    # exception so the user sees a tailored message ("billing limit reached")
    # instead of the generic "service temporarily unreachable" 503 — retrying
    # tomorrow doesn't help when the cap is the issue.
    if "billing_hard_limit_reached" in msg_lower or "billing_not_active" in msg_lower:
        return AIBillingLimitError(msg, provider="openai")
    if cls_name == "RateLimitError" or "429" in msg or "rate_limit" in msg_lower:
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
    if "timeout" in msg_lower or "connection" in msg_lower:
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


# ── Gemini exception mapping (mirrors GeminiProvider._map_exception) ─────


def _map_gemini_exception(exc: Exception) -> AIProviderError:
    cls_name = exc.__class__.__name__
    msg = str(exc)
    msg_lower = msg.lower()
    if cls_name == "ResourceExhausted" or "429" in msg or "quota" in msg_lower:
        return AIQuotaExceededError(msg, provider="gemini")
    if cls_name in ("DeadlineExceeded", "ServiceUnavailable", "InternalServerError"):
        return AIProviderUnavailableError(msg, provider="gemini")
    if cls_name in ("RetryError", "GoogleAPIError", "GoogleAPICallError"):
        return AIProviderUnavailableError(msg, provider="gemini")
    if "timeout" in msg_lower or "connection" in msg_lower:
        return AIProviderUnavailableError(msg, provider="gemini")
    logger.warning("Gemini image call failed (unmapped: %s): %s", cls_name, exc)
    return AIProviderUnavailableError(msg, provider="gemini")


# ── Gemini image generation (primary path) ───────────────────────────────


# Gemini image-generation model. The previous experimental name
# `gemini-2.0-flash-exp-image-generation` was retired by Google and now 404s
# silently — symptom is "service temporarily unreachable" with no upstream
# explanation. `gemini-2.5-flash-image` is the GA model as of 2026-05-10
# (per ai.google.dev/gemini-api/docs/image-generation). The TEXT+IMAGE
# modality pair is what Google's own examples use; pure ["IMAGE"] is
# rejected by some model versions.
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
GEMINI_IMAGE_MODALITIES = ["TEXT", "IMAGE"]


def _gemini_generate_image_bytes(
    prompt: str,
    *,
    account_id: str | None,
    source: AISource,
) -> bytes:
    """Call Gemini image generation, return the raw image bytes.

    Gemini returns the image inline as `inline_data` on a content part, so
    there's no temporary URL to download — we get the bytes directly off the
    response. Logs `provider='gemini'` in ai_usage_log so the admin dashboard
    can distinguish Gemini-served from DALL-E-served generations.

    Logs the exact exception class, repr, and message at every failure point
    so prod diagnoses don't require code changes — see
    `/creator/test-gemini-image` for an isolated reproduction surface.
    """
    if source == "user":
        _check_rate_limit(
            provider="gemini", account_id=account_id, task="image_generation",
        )

    if not settings.GEMINI_API_KEY:
        logger.warning(
            "Gemini image generation skipped: GEMINI_API_KEY not set",
        )
        raise AIProviderUnavailableError(
            "GEMINI_API_KEY not configured", provider="gemini",
        )

    logger.info(
        "Gemini image-gen call: model=%s modalities=%s prompt_len=%d account=%s source=%s",
        GEMINI_IMAGE_MODEL, GEMINI_IMAGE_MODALITIES, len(prompt or ""),
        account_id, source,
    )

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_IMAGE_MODEL)
        # `response_modalities` belongs in generation_config. Passing it as a
        # plain dict (not GenerationConfig) keeps us forward-compatible with
        # SDK versions that haven't surfaced the dataclass field yet.
        resp = model.generate_content(
            prompt,
            generation_config={"response_modalities": GEMINI_IMAGE_MODALITIES},
        )
    except AIProviderError:
        raise
    except Exception as exc:  # noqa: BLE001
        # Log everything we can about the upstream failure before mapping.
        # `repr(exc)` includes the class name + args; `str(exc)` is the
        # human-readable message. Both can be useful when the SDK wraps an
        # underlying gRPC/HTTP error opaquely.
        logger.warning(
            "Gemini image-gen exception: model=%s class=%s repr=%r message=%s",
            GEMINI_IMAGE_MODEL, exc.__class__.__name__, exc, str(exc),
        )
        raise _map_gemini_exception(exc) from exc

    # Walk the candidates → parts → inline_data tree. The image bytes live on
    # the first part with `inline_data`; the SDK may or may not also include
    # a text part depending on the modality config.
    candidates = getattr(resp, "candidates", None) or []
    image_bytes: bytes | None = None
    text_parts: list[str] = []
    part_types: list[str] = []
    for cand in candidates:
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in (getattr(content, "parts", None) or []):
            # Track what we saw for diagnostic logging if no image was found.
            inline = getattr(part, "inline_data", None)
            text = getattr(part, "text", None)
            if inline and getattr(inline, "data", None):
                part_types.append(f"inline_data({getattr(inline, 'mime_type', '?')})")
            elif text:
                part_types.append("text")
                text_parts.append(text)
            else:
                part_types.append(f"other({type(part).__name__})")

            data = getattr(inline, "data", None) if inline else None
            if data:
                # `data` is already raw bytes in current SDK versions; older
                # ones may hand back base64 — guard for both.
                if isinstance(data, str):
                    import base64
                    image_bytes = base64.b64decode(data)
                else:
                    image_bytes = bytes(data)
                break
        if image_bytes:
            break

    if not image_bytes:
        # Surface the safety/finish reason and any text the model returned —
        # if Gemini blocked the prompt or ran into a content filter, this is
        # where we find out.
        finish_reasons = [
            str(getattr(c, "finish_reason", None)) for c in candidates
        ]
        prompt_feedback = getattr(resp, "prompt_feedback", None)
        block_reason = (
            str(getattr(prompt_feedback, "block_reason", None))
            if prompt_feedback else None
        )
        logger.warning(
            "Gemini image-gen returned no image: model=%s candidates=%d "
            "finish_reasons=%s block_reason=%s part_types=%s text_snippet=%r",
            GEMINI_IMAGE_MODEL, len(candidates), finish_reasons, block_reason,
            part_types, (text_parts[0][:200] if text_parts else None),
        )
        raise AIInvalidResponseError(
            "Gemini returned no inline image data", provider="gemini",
        )

    tokens = getattr(getattr(resp, "usage_metadata", None), "total_token_count", None)
    logger.info(
        "Gemini image-gen success: model=%s bytes=%d tokens=%s account=%s",
        GEMINI_IMAGE_MODEL, len(image_bytes), tokens, account_id,
    )
    _log_usage(
        provider="gemini", task="image_generation",
        account_id=account_id, source=source, tokens_used=tokens,
    )
    return image_bytes


# ── DALL-E 3 (fallback path) ─────────────────────────────────────────────


def _dalle_generate_image(
    prompt: str,
    *,
    ratio: str,
    account_id: str | None,
    source: AISource,
) -> dict[str, Any]:
    """Call DALL-E 3, return `{url, revised_prompt, size}`. URL is OpenAI-hosted
    and expires within ~1 hour — callers must download promptly."""
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

    _log_usage(
        provider="openai", task="image_generation", account_id=account_id,
        source=source, tokens_used=0,
    )
    return {"url": url, "revised_prompt": revised, "size": size}


# ── Public entry point: Gemini-first, DALL-E fallback ────────────────────


def generate_dalle_image(
    prompt: str,
    *,
    ratio: str = "1:1",
    account_id: str | None = None,
    source: AISource = "user",
) -> dict[str, Any]:
    """Generate an image. Tries Gemini 2.0 Flash image generation first; on
    any AIProviderError (quota / billing / transport / parsing), falls back
    to DALL-E 3. Returns the same `{url, revised_prompt, size}` shape
    regardless of which backend served the call.

    Gemini path: bytes come back inline, we upload them to R2 here and return
    the persistent URL. Caller's existing post-processing pipeline still runs
    (download + re-upload) but short-circuits when it recognizes one of our
    own URLs — see `posts_creator.generate_image`.

    DALL-E fallback path: same shape but the URL is OpenAI's ephemeral one,
    so the caller still needs to download + re-upload before it expires.

    Function name retained for compatibility with existing callers.
    """
    # Try Gemini first.
    try:
        image_bytes = _gemini_generate_image_bytes(
            prompt, account_id=account_id, source=source,
        )
    except AIProviderError as gemini_exc:
        logger.info(
            "Gemini image generation failed, falling back to DALL-E: %s (%s)",
            gemini_exc.__class__.__name__, gemini_exc,
        )
    else:
        # Upload immediately so the persistent URL goes back to the caller.
        url = upload_media(image_bytes, "ai-generated.png", "image/png")
        return {
            "url": url,
            "revised_prompt": prompt,
            "size": dalle_size_for_ratio(ratio),
        }

    # Fallback: DALL-E. If this also fails the AIProviderError propagates and
    # the endpoint serves a 503 with the standard degraded envelope.
    return _dalle_generate_image(
        prompt, ratio=ratio, account_id=account_id, source=source,
    )
