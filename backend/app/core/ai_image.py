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
    "Given an uploaded image, identify the SPECIFIC product as concretely as you "
    "can — read the packaging, look for the brand mark, name the model. Return a "
    "tight JSON object with exactly these keys: "
    "product_description (one short sentence — what is in the image), "
    "brand_name (string — the brand visible on the packaging or product, or "
    "empty string if no brand mark is visible), "
    "product_name (string — the specific product name or model from the label, "
    "or empty string if not visible), "
    "key_features (array of up to 4 short noun phrases describing distinctive "
    "details a viewer would notice — e.g. 'gold cap', 'rose-gold lettering', "
    "'30ml glass bottle' — empty array if none stand out), "
    "label_text (string — verbatim text visible on the label/packaging, "
    "preserving the original language; empty string if none readable), "
    "detected_style (one of: 'luxury', 'minimal', 'vibrant', 'clean', 'playful'), "
    "dominant_colors (array of 2-4 hex strings starting with #), "
    "suggested_tone (one of: 'professional', 'friendly', 'luxurious', 'playful', "
    "'inspiring'), "
    "content_suggestions (array of exactly 3 short content angles the creator "
    "could use, each 2-5 words). "
    "Use empty strings or empty arrays — never null — for fields you cannot "
    "fill from the image. Do NOT invent a brand or product name; if the label "
    "is unreadable or absent, return empty strings. "
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
    # New product-identification fields (brand_name, product_name, key_features,
    # label_text) drive the brand-aware caption prompt — when populated, the
    # caption generator switches from generic copy to product-specific copy.
    normalized = {
        "product_description": str(parsed.get("product_description") or "").strip(),
        "brand_name": str(parsed.get("brand_name") or "").strip(),
        "product_name": str(parsed.get("product_name") or "").strip(),
        "key_features": [
            str(f).strip()
            for f in (parsed.get("key_features") or [])
            if isinstance(f, str) and str(f).strip()
        ][:4],
        "label_text": str(parsed.get("label_text") or "").strip(),
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


# ── Image editing: GPT-Image (transform an uploaded product photo) ────────


# OpenAI image-editing model. `gpt-image-2` exists but requires the org to
# be verified at platform.openai.com → Settings → Organization → Verify.
# Until that's done, `gpt-image-1` is available without verification, has
# the same `client.images.edit()` API, and produces the same b64_json
# inline-bytes response shape — drop-in upgrade later by changing this
# constant.
GPT_IMAGE_EDIT_MODEL = "gpt-image-1"

# Aspect ratios accepted by `client.images.edit()` for `gpt-image-1`. Same
# three the rest of the Post Creator surfaces use, mapped to the closest
# supported size; portrait (4:5) → 1024x1536 is the model's portrait shape.
_RATIO_TO_GPT_IMAGE_SIZE: dict[str, str] = {
    "1:1": "1024x1024",
    "4:5": "1024x1536",
    "16:9": "1536x1024",
}

# Style descriptors lifted from the brand-identity image_style enum, keyed
# the same way `_build_dalle_prompt` does. Kept inline here because the
# edit-prompt phrasing is subtly different from generate-from-scratch
# (it's about *transforming* an existing scene, not inventing one).
_EDIT_STYLE_DESCRIPTORS: dict[str, str] = {
    "luxurious": "luxurious refined product photography, soft directional lighting, premium materials feel",
    "luxury": "luxurious refined product photography, soft directional lighting, premium materials feel",
    "minimal": "minimal clean composition, generous negative space, neutral palette, soft natural light",
    "vibrant": "vibrant saturated colors, energetic composition, contemporary lighting",
    "playful": "playful joyful composition, warm color palette, lively styling",
    "clean": "clean studio aesthetic, even lighting, uncluttered background",
}


def _build_edit_prompt(
    description: str,
    ratio: str,
    brand_identity: dict | None,
    business_profile: dict | None,
) -> str:
    """Compose the GPT-Image edit prompt from the user description + brand
    + business context + the always-on "preserve product identity" tail.

    Distinct from `_build_dalle_prompt` (in posts_creator.py) because edit
    prompts must explicitly tell the model NOT to invent new objects — the
    user's product needs to remain the visual subject. Generation prompts
    don't have that constraint.
    """
    parts: list[str] = [description.strip()]

    brand = brand_identity or {}
    bp = business_profile or {}
    style = (brand.get("image_style") or "").strip().lower()
    tone = (brand.get("tone") or "").strip().lower()
    primary_color = (brand.get("primary_color") or "").strip()

    if style in _EDIT_STYLE_DESCRIPTORS:
        parts.append(_EDIT_STYLE_DESCRIPTORS[style])
    if tone and tone not in ("", "friendly"):
        parts.append(f"{tone} mood")
    if primary_color:
        parts.append(f"complement the brand color {primary_color}")

    industry = (bp.get("industry") or "").strip()
    city = (bp.get("city") or "").strip()
    if industry:
        parts.append(f"For a {industry} brand")
    if city:
        parts.append(f"based in {city}")

    aspect = {
        "1:1": "square 1:1 framing for an Instagram feed post",
        "4:5": "portrait 4:5 framing for an Instagram feed post",
        "16:9": "landscape 16:9 framing suitable for an Instagram cover",
    }.get(ratio, "square 1:1 framing for an Instagram feed post")
    parts.append(aspect)

    # The non-negotiable tail — every edit prompt ends with this so the
    # transformed image keeps the user's actual product identifiable.
    parts.append(
        "Professional Instagram product photography. Keep the product clearly "
        "visible and recognizable — preserve its shape, packaging, branding, "
        "and label so it stays the same product. Do not replace or invent a "
        "different product. No text overlays, no watermarks, no logos that "
        "weren't already on the product."
    )
    return ". ".join(p for p in parts if p)


def gpt_image_size_for_ratio(ratio: str) -> str:
    return _RATIO_TO_GPT_IMAGE_SIZE.get(ratio, "1024x1024")


def _download_image_bytes(image_url: str) -> bytes:
    """Pull the source image bytes from R2 (absolute URL) or the local-fallback
    media route (relative URL like `/api/v1/media/foo.png`).

    Local-fallback URLs are read DIRECTLY from `LOCAL_MEDIA_DIR` rather than
    round-tripped through HTTP. Going through HTTP would force the request
    out via FRONTEND_URL → nginx → back into a (possibly different) api
    container instance — needless network hop, and broken on prod where
    FRONTEND_URL is the frontend container's port (caught 2026-05-10:
    "ConnectError: [Errno 111] Connection refused" when the edit path tried
    to download an upload that landed in /tmp/basiret-media/).
    """
    from app.core.storage import LOCAL_MEDIA_DIR, LOCAL_MEDIA_URL_PREFIX

    # Local-fallback URL: read straight from disk. Reject anything that looks
    # like a path-traversal attempt — `_safe_filename` strips slashes on the
    # write side, but defense-in-depth on the read side.
    if image_url.startswith(LOCAL_MEDIA_URL_PREFIX):
        name = image_url[len(LOCAL_MEDIA_URL_PREFIX):]
        if "/" in name or ".." in name:
            raise AIProviderUnavailableError(
                f"Refusing suspicious local media path: {name}",
                provider="openai",
            )
        path = LOCAL_MEDIA_DIR / name
        if not path.exists():
            raise AIProviderUnavailableError(
                f"Local media file not found: {name}", provider="openai",
            )
        return path.read_bytes()

    # Absolute URL (R2 or any public host) → HTTP fetch.
    import httpx
    with httpx.Client(timeout=60) as http:
        r = http.get(image_url)
        r.raise_for_status()
        return r.content


def edit_product_image(
    image_url: str,
    *,
    description: str,
    ratio: str = "1:1",
    brand_identity: dict | None = None,
    business_profile: dict | None = None,
    account_id: str | None = None,
    source: AISource = "user",
) -> dict[str, Any]:
    """Transform an uploaded product image into a professional Instagram-ready
    version while keeping the product recognizable.

    Downloads the image at `image_url`, sends it to OpenAI's image-edit API
    (`gpt-image-1`), uploads the transformed bytes to R2, and returns
    `{"url": <persistent R2 URL>, "prompt_used": <full prompt>, "size": <px>}`.

    Logs `provider='openai', task='image_edit'` in ai_usage_log so the admin
    dashboard distinguishes edits from from-scratch generations.

    Raises an `AIProviderError` subclass on quota / billing / transport /
    parsing failures so the endpoint can degrade with a structured 503.
    """
    if source == "user":
        _check_rate_limit(
            provider="openai", account_id=account_id, task="image_edit",
        )

    prompt = _build_edit_prompt(description, ratio, brand_identity, business_profile)
    size = gpt_image_size_for_ratio(ratio)

    logger.info(
        "GPT-Image edit call: model=%s size=%s prompt_len=%d account=%s source=%s",
        GPT_IMAGE_EDIT_MODEL, size, len(prompt), account_id, source,
    )

    # Download the source image first so a transient R2 hiccup surfaces
    # cleanly rather than as a half-formed multipart upload to OpenAI.
    try:
        source_bytes = _download_image_bytes(image_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "GPT-Image edit: source download failed url=%s class=%s: %s",
            image_url, exc.__class__.__name__, exc,
        )
        raise AIProviderUnavailableError(
            f"Failed to fetch source image: {exc}", provider="openai",
        ) from exc

    # `client.images.edit` needs a file-like with a `.name` attribute (the
    # SDK uses it to set the multipart filename + content-type sniffing).
    import io
    file_obj = io.BytesIO(source_bytes)
    file_obj.name = "source.png"

    client = _openai_client()
    try:
        resp = client.images.edit(
            model=GPT_IMAGE_EDIT_MODEL,
            image=file_obj,
            prompt=prompt,
            size=size,
        )
    except AIProviderError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "GPT-Image edit failed: model=%s class=%s message=%s",
            GPT_IMAGE_EDIT_MODEL, exc.__class__.__name__, str(exc),
        )
        raise _map_openai_exception(exc) from exc

    try:
        first = resp.data[0]
    except (IndexError, AttributeError) as exc:
        raise AIInvalidResponseError(
            "GPT-Image edit response missing data[0]", provider="openai",
        ) from exc

    # `gpt-image-1` returns inline base64 bytes via `b64_json` — there's no
    # ephemeral URL like DALL-E 3. Decode then re-host on R2 for stability.
    b64 = getattr(first, "b64_json", None)
    if not b64:
        raise AIInvalidResponseError(
            "GPT-Image edit returned no b64_json data", provider="openai",
        )

    import base64
    try:
        image_bytes = base64.b64decode(b64)
    except (ValueError, TypeError) as exc:
        raise AIInvalidResponseError(
            f"GPT-Image edit returned invalid base64: {exc}", provider="openai",
        ) from exc

    final_url = upload_media(image_bytes, "ai-edited.png", "image/png")

    tokens = getattr(getattr(resp, "usage", None), "total_tokens", None)
    logger.info(
        "GPT-Image edit success: model=%s bytes=%d tokens=%s url=%s",
        GPT_IMAGE_EDIT_MODEL, len(image_bytes), tokens, final_url,
    )
    _log_usage(
        provider="openai", task="image_edit",
        account_id=account_id, source=source, tokens_used=tokens,
    )
    return {
        "url": final_url,
        "prompt_used": prompt,
        "size": size,
        "model": GPT_IMAGE_EDIT_MODEL,
    }


# ── Gemini exception mapping (mirrors GeminiProvider._map_exception) ─────


def _map_gemini_exception(exc: Exception) -> AIProviderError:
    cls_name = exc.__class__.__name__
    msg = str(exc)
    msg_lower = msg.lower()
    # 429 / quota — handle the legacy SDK's `ResourceExhausted` AND the
    # newer `google-genai` SDK's `ClientError` / `APIError` shapes (both
    # carry a 429 / RESOURCE_EXHAUSTED marker in the message).
    if (
        cls_name == "ResourceExhausted"
        or "429" in msg
        or "RESOURCE_EXHAUSTED" in msg
        or "quota" in msg_lower
    ):
        return AIQuotaExceededError(msg, provider="gemini")
    if cls_name in ("DeadlineExceeded", "ServiceUnavailable", "InternalServerError"):
        return AIProviderUnavailableError(msg, provider="gemini")
    if cls_name in ("RetryError", "GoogleAPIError", "GoogleAPICallError"):
        return AIProviderUnavailableError(msg, provider="gemini")
    # `google-genai` exception hierarchy: `ServerError` (5xx), `ClientError`
    # (4xx other than 429, which we caught above), `APIError` (base).
    if cls_name in ("ServerError", "ClientError", "APIError"):
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
        # Use the newer `google-genai` SDK (NOT the legacy
        # `google-generativeai` package). The legacy SDK's GenerationConfig
        # rejects `response_modalities` outright with
        # "Unknown field for GenerationConfig: response_modalities" —
        # caught in prod via /creator/test-gemini-image on 2026-05-10.
        # `google-genai` is the SDK Google's image-generation docs use.
        from google import genai as google_genai
        from google.genai import types as genai_types
        client = google_genai.Client(api_key=settings.GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_modalities=GEMINI_IMAGE_MODALITIES,
            ),
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
