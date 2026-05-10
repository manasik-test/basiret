"""Post Creator endpoints — drafts, schedules, and the calendar view used
by the Content Plan tabs.

All routes are JWT-gated and scoped to the caller's organization. The
`/upload` endpoint accepts multipart media (jpg/png/webp/mp4/mov, max
50 MB) and stores it via the R2-or-local storage abstraction. The
post-management endpoints (`/posts`, `/posts/{id}`, `/calendar`) read +
write the `scheduled_post` table directly.

Sprint 5 will add the Instagram-publishing dispatcher that picks up rows
with `status='publishing'`. Sprint 4 will populate `source_image_url`
when AI media generation lands. Until then, those columns are tracked
but unused.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from uuid import UUID as PyUUID

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.ai_degradation import degraded_no_cache_response
from app.core.ai_image import (
    GEMINI_IMAGE_MODEL,
    _gemini_generate_image_bytes,
    analyze_image_url as openai_analyze_image_url,
    dalle_size_for_ratio,
    generate_dalle_image,
)
from app.core.ai_provider import AIProviderError
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.storage import (
    LOCAL_MEDIA_DIR,
    delete_media,
    is_r2_configured,
    upload_media,
)
from app.models.organization import Organization
from app.models.scheduled_post import ScheduledPost
from app.models.social_account import SocialAccount
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Constants ─────────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

# Mapping of accepted MIME types to the `media_type` column value. We
# reject every other content-type at the boundary so a malicious upload
# can't slip past as e.g. text/html.
_IMAGE_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_VIDEO_MIME = {"video/mp4", "video/quicktime", "video/mov"}

DRAFT_TTL = timedelta(days=15)

ValidStatus = Literal[
    "draft", "scheduled", "publishing", "published", "failed", "cancelled",
]


# ── Schemas ───────────────────────────────────────────────────────────────


class CreatePostRequest(BaseModel):
    social_account_id: Optional[str] = None
    media_urls: list[str] = Field(default_factory=list)
    media_type: Optional[str] = None
    caption_ar: Optional[str] = None
    caption_en: Optional[str] = None
    hashtags: list[str] = Field(default_factory=list)
    ratio: Optional[Literal["1:1", "4:5", "16:9"]] = None
    scheduled_at: Optional[datetime] = None
    status: ValidStatus = "draft"
    content_plan_day: Optional[date] = None
    ai_generated_media: bool = False
    ai_generated_caption: bool = False
    source_image_url: Optional[str] = None
    image_analysis: Optional[dict] = None


class UpdatePostRequest(BaseModel):
    media_urls: Optional[list[str]] = None
    media_type: Optional[str] = None
    caption_ar: Optional[str] = None
    caption_en: Optional[str] = None
    hashtags: Optional[list[str]] = None
    ratio: Optional[Literal["1:1", "4:5", "16:9"]] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[ValidStatus] = None
    error_message: Optional[str] = None
    image_analysis: Optional[dict] = None


# ── Helpers ───────────────────────────────────────────────────────────────


def _serialize(post: ScheduledPost) -> dict:
    """Normalize a SQLAlchemy row into the JSON shape the frontend wants."""
    return {
        "id": str(post.id),
        "organization_id": str(post.organization_id),
        "social_account_id": str(post.social_account_id),
        "media_urls": post.media_urls or [],
        "media_type": post.media_type,
        "caption_ar": post.caption_ar,
        "caption_en": post.caption_en,
        "hashtags": post.hashtags or [],
        "ratio": post.ratio,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "status": post.status,
        "platform_post_id": post.platform_post_id,
        "ai_generated_media": post.ai_generated_media,
        "ai_generated_caption": post.ai_generated_caption,
        "source_image_url": post.source_image_url,
        "image_analysis": post.image_analysis,
        "content_plan_day": post.content_plan_day.isoformat() if post.content_plan_day else None,
        "draft_expires_at": (
            post.draft_expires_at.isoformat() if post.draft_expires_at else None
        ),
        "error_message": post.error_message,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


def _resolve_account_id(db: Session, user: User, requested: Optional[str]):
    """Pick the social_account_id this post belongs to.

    If the caller passed one, validate that it belongs to their org; else
    fall back to the org's first active account. 422 if nothing matches —
    Sprint 3 doesn't ship a "create a draft without an account" path.
    """
    if requested:
        try:
            requested_uuid = PyUUID(requested)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid social_account_id") from exc
        account = (
            db.query(SocialAccount)
            .filter(
                SocialAccount.id == requested_uuid,
                SocialAccount.organization_id == user.organization_id,
            )
            .first()
        )
        if not account:
            raise HTTPException(status_code=404, detail="Social account not found")
        return account.id

    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active.is_(True),
        )
        .order_by(SocialAccount.connected_at.asc())
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=422,
            detail="No active Instagram account connected — connect one before creating a post.",
        )
    return account.id


def _scoped_post_or_404(db: Session, user: User, post_id: str) -> ScheduledPost:
    try:
        post_uuid = PyUUID(post_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Post not found") from exc
    post = (
        db.query(ScheduledPost)
        .filter(
            ScheduledPost.id == post_uuid,
            ScheduledPost.organization_id == user.organization_id,
        )
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/creator/upload")
async def upload(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Accept a single image/video file, store it, return its public URL."""
    content_type = (file.content_type or "").lower()
    if content_type in _IMAGE_MIME:
        media_type = "image"
    elif content_type in _VIDEO_MIME:
        media_type = "video"
    else:
        raise HTTPException(
            status_code=422,
            detail=(
                "Unsupported media type. Allowed: jpg, png, webp, mp4, mov."
            ),
        )

    body = await file.read()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File exceeds the 50 MB upload limit.",
        )
    if not body:
        raise HTTPException(status_code=422, detail="Empty file.")

    url = upload_media(body, file.filename or "upload.bin", content_type)
    logger.info(
        "creator upload by user=%s type=%s size=%d",
        user.id, media_type, len(body),
    )
    return {
        "success": True,
        "data": {
            "url": url,
            "media_type": media_type,
            "filename": file.filename,
        },
    }


class AnalyzeImageRequest(BaseModel):
    image_url: str = Field(..., min_length=8)


@router.post("/creator/analyze-image")
def analyze_image(
    body: AnalyzeImageRequest = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze a previously-uploaded image with GPT-4o Vision.

    The image must already be reachable at the supplied URL (typically the URL
    returned by `POST /creator/upload`). Returns the structured product
    description used by the caption generator. AI failures degrade with the
    standard `meta.status='degraded'` envelope so the wizard can still proceed
    with empty analysis instead of erroring out.
    """
    primary_account_id = _resolve_primary_account_id(db, user)
    try:
        result = openai_analyze_image_url(
            body.image_url,
            account_id=primary_account_id,
            source="user",
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

    logger.info(
        "creator analyze-image by user=%s account=%s style=%s",
        user.id, primary_account_id, result.get("detected_style"),
    )
    return {
        "success": True,
        "data": result,
        "meta": {"status": "fresh"},
    }


class GenerateImageRequest(BaseModel):
    description: str = Field(..., min_length=3, max_length=2000)
    ratio: Literal["1:1", "4:5", "16:9"] = "1:1"
    account_id: Optional[str] = None


@router.post("/creator/generate-image")
def generate_image(
    body: GenerateImageRequest = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a brand-aware image via DALL-E 3, persist it on R2, return URL.

    Brand identity (primary color, image style, tone) and business profile
    (industry, city) are folded into the DALL-E prompt so generated images
    match the rest of the account's content. The generated URL hosted by
    OpenAI expires within ~1 hour so we download + re-upload to R2 inside
    this request — the URL we return points at our storage backend.
    """
    primary_account_id = _resolve_primary_account_id(db, user, body.account_id)

    org = (
        db.query(Organization)
        .filter(Organization.id == user.organization_id)
        .first()
    )
    brand = (org.brand_identity if org else None) or {}
    bp = (org.business_profile if org else None) or {}

    prompt = _build_dalle_prompt(body.description, body.ratio, brand, bp)

    try:
        gen = generate_dalle_image(
            prompt,
            ratio=body.ratio,
            account_id=primary_account_id,
            source="user",
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

    # The Gemini path uploads bytes to our storage internally and returns a
    # persistent URL; the DALL-E fallback returns OpenAI's ephemeral URL. We
    # detect which case we're in by sniffing the URL prefix — anything that
    # already lives on our storage (R2 public URL or local-media route) skips
    # the re-download/re-upload round-trip. Otherwise we have ~1h to grab the
    # bytes from OpenAI before they expire.
    gen_url = gen.get("url") or ""
    r2_prefix = (settings.R2_PUBLIC_URL or "").rstrip("/")
    r2_default_prefix = (
        f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/"
        if settings.R2_ACCOUNT_ID
        else ""
    )
    is_already_stored = (
        gen_url.startswith("/api/v1/media/")
        or (bool(r2_prefix) and gen_url.startswith(r2_prefix))
        or (bool(r2_default_prefix) and gen_url.startswith(r2_default_prefix))
    )
    if is_already_stored:
        final_url = gen_url
    else:
        try:
            import httpx
            with httpx.Client(timeout=60) as http:
                r = http.get(gen_url)
                r.raise_for_status()
                payload = r.content
        except Exception as exc:  # noqa: BLE001
            logger.exception("Image download failed url=%s", gen_url)
            raise HTTPException(
                status_code=502,
                detail="Failed to download generated image",
            ) from exc
        final_url = upload_media(payload, "ai-generated.png", "image/png")
    logger.info(
        "creator generate-image by user=%s account=%s ratio=%s size=%s",
        user.id, primary_account_id, body.ratio, gen.get("size"),
    )
    return {
        "success": True,
        "data": {
            "url": final_url,
            "prompt_used": prompt,
            "revised_prompt": gen.get("revised_prompt"),
            "ratio": body.ratio,
            "size": gen.get("size") or dalle_size_for_ratio(body.ratio),
        },
        "meta": {"status": "fresh"},
    }


def _build_dalle_prompt(
    description: str,
    ratio: str,
    brand: dict,
    business_profile: dict,
) -> str:
    """Compose the DALL-E 3 prompt from the user description + account context.

    Layered: user's own description first (their intent dominates), then style
    cues from brand identity, then business context (industry / city), then
    a final instruction about social-feed framing. Empty fields are skipped.
    """
    parts: list[str] = [description.strip()]

    style = (brand.get("image_style") or "").strip().lower()
    tone = (brand.get("tone") or "").strip().lower()
    primary_color = (brand.get("primary_color") or "").strip()

    style_descriptors = {
        "luxurious": "luxurious, refined, high-end product photography, soft directional light, premium materials",
        "luxury": "luxurious, refined, high-end product photography, soft directional light, premium materials",
        "minimal": "minimal, clean composition, generous negative space, neutral palette, soft natural light",
        "vibrant": "vibrant, saturated colors, energetic composition, contemporary lighting",
        "playful": "playful, joyful, candid composition, warm color palette, lively styling",
        "clean": "clean studio aesthetic, even lighting, uncluttered background, professional product styling",
    }
    if style in style_descriptors:
        parts.append(style_descriptors[style])

    if tone and tone not in ("", "friendly"):
        parts.append(f"{tone} mood")

    if primary_color:
        parts.append(f"complement the brand color {primary_color}")

    industry = (business_profile.get("industry") or "").strip()
    city = (business_profile.get("city") or "").strip()
    if industry:
        parts.append(f"Created for a {industry} brand")
    if city:
        parts.append(f"based in {city}")

    aspect = {
        "1:1": "square 1:1 framing for an Instagram feed post",
        "4:5": "portrait 4:5 framing for an Instagram feed post",
        "16:9": "landscape 16:9 framing suitable for an Instagram cover",
    }.get(ratio, "square 1:1 framing for an Instagram feed post")
    parts.append(aspect)

    parts.append(
        "Photorealistic, sharp focus, no text, no watermarks, no logos, no people's faces."
    )
    return ". ".join(p for p in parts if p)


def _resolve_primary_account_id(
    db: Session, user: User, requested: Optional[str] = None,
) -> Optional[str]:
    """Return the social_account_id used for AI usage logging.

    Mirrors `_resolve_account_id` but returns `str` (or None when the org has
    no connected accounts). Doesn't 422 on empty — analyze + generate should
    still work for a brand-new user before they've connected Instagram.
    """
    if requested:
        try:
            requested_uuid = PyUUID(requested)
        except ValueError:
            return None
        account = (
            db.query(SocialAccount)
            .filter(
                SocialAccount.id == requested_uuid,
                SocialAccount.organization_id == user.organization_id,
            )
            .first()
        )
        return str(account.id) if account else None

    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active.is_(True),
        )
        .order_by(SocialAccount.connected_at.asc())
        .first()
    )
    return str(account.id) if account else None


@router.get("/creator/test-gemini-image")
def test_gemini_image(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Diagnostic endpoint: try Gemini image generation in isolation.

    Hits Gemini directly (bypassing the DALL-E fallback in
    `generate_dalle_image`) with a hardcoded prompt and returns either
    `{ok: true, model, bytes_len, r2_url}` on success or
    `{ok: false, model, error_class, error_message, error_repr}` on
    failure. Lets us verify model-name + API-key + connectivity in prod
    without going through the whole Post Creator wizard.

    Auth-gated like the rest of /creator/* — no anonymous abuse surface.
    Logs at every stage so prod logs tell the full story even when the
    HTTP response is consumed by a tool that doesn't surface bodies.
    """
    primary_account_id = _resolve_primary_account_id(db, user)
    test_prompt = (
        "A simple square photograph of a single ripe red apple on a plain "
        "white background, soft natural lighting, photorealistic. No text, "
        "no watermarks, no logos."
    )

    logger.info(
        "test-gemini-image: starting model=%s account=%s user=%s",
        GEMINI_IMAGE_MODEL, primary_account_id, user.id,
    )

    try:
        image_bytes = _gemini_generate_image_bytes(
            test_prompt,
            account_id=primary_account_id,
            source="user",
        )
    except AIProviderError as exc:
        # Mapped error — message is user-safe.
        logger.warning(
            "test-gemini-image: AIProviderError model=%s class=%s message=%s",
            GEMINI_IMAGE_MODEL, exc.__class__.__name__, str(exc),
        )
        return {
            "ok": False,
            "model": GEMINI_IMAGE_MODEL,
            "error_class": exc.__class__.__name__,
            "error_message": str(exc),
            "user_message": exc.user_message,
        }
    except Exception as exc:  # noqa: BLE001
        # Unmapped — bubble the raw exception details so we can adjust the
        # mapper if a new failure class shows up.
        logger.exception(
            "test-gemini-image: unmapped exception model=%s class=%s",
            GEMINI_IMAGE_MODEL, exc.__class__.__name__,
        )
        return {
            "ok": False,
            "model": GEMINI_IMAGE_MODEL,
            "error_class": exc.__class__.__name__,
            "error_message": str(exc),
            "error_repr": repr(exc),
        }

    # Upload so the URL is shareable / inspectable in a browser.
    try:
        url = upload_media(image_bytes, "test-gemini.png", "image/png")
    except Exception as exc:  # noqa: BLE001
        logger.exception("test-gemini-image: storage upload failed")
        return {
            "ok": True,
            "model": GEMINI_IMAGE_MODEL,
            "bytes_len": len(image_bytes),
            "r2_url": None,
            "upload_error": str(exc),
        }

    logger.info(
        "test-gemini-image: success model=%s bytes=%d url=%s",
        GEMINI_IMAGE_MODEL, len(image_bytes), url,
    )
    return {
        "ok": True,
        "model": GEMINI_IMAGE_MODEL,
        "bytes_len": len(image_bytes),
        "r2_url": url,
    }


@router.post("/creator/posts")
def create_post(
    body: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a scheduled_post row.

    `status='scheduled'` requires `scheduled_at`. `status='draft'` (the
    default) sets `draft_expires_at` 15 days from now so the cleanup task
    can reclaim abandoned drafts + their R2 media.
    """
    if body.status == "scheduled" and not body.scheduled_at:
        raise HTTPException(
            status_code=422,
            detail="scheduled_at is required when status='scheduled'.",
        )

    account_id = _resolve_account_id(db, user, body.social_account_id)

    now = datetime.now(timezone.utc)
    draft_expires_at = now + DRAFT_TTL if body.status == "draft" else None

    post = ScheduledPost(
        organization_id=user.organization_id,
        social_account_id=account_id,
        media_urls=body.media_urls or [],
        media_type=body.media_type,
        caption_ar=body.caption_ar,
        caption_en=body.caption_en,
        hashtags=body.hashtags or [],
        ratio=body.ratio,
        scheduled_at=body.scheduled_at,
        status=body.status,
        ai_generated_media=body.ai_generated_media,
        ai_generated_caption=body.ai_generated_caption,
        source_image_url=body.source_image_url,
        image_analysis=body.image_analysis,
        content_plan_day=body.content_plan_day,
        draft_expires_at=draft_expires_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"success": True, "data": _serialize(post)}


@router.get("/creator/posts")
def list_posts(
    status_filter: Optional[ValidStatus] = Query(None, alias="status"),
    account_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List posts for the caller's organization.

    Newest first. The `?status=` filter is a single value (frontend tabs
    each issue their own request). `?account_id=` is for multi-account
    orgs; defaults to all accounts in the org when omitted.
    """
    q = db.query(ScheduledPost).filter(
        ScheduledPost.organization_id == user.organization_id,
    )
    if status_filter:
        q = q.filter(ScheduledPost.status == status_filter)
    if account_id:
        try:
            account_uuid = PyUUID(account_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid account_id") from exc
        q = q.filter(ScheduledPost.social_account_id == account_uuid)

    rows = q.order_by(ScheduledPost.created_at.desc()).all()
    return {"success": True, "data": [_serialize(p) for p in rows]}


@router.get("/creator/posts/{post_id}")
def get_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _scoped_post_or_404(db, user, post_id)
    return {"success": True, "data": _serialize(post)}


@router.put("/creator/posts/{post_id}")
def update_post(
    post_id: str,
    body: UpdatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _scoped_post_or_404(db, user, post_id)
    payload = body.model_dump(exclude_unset=True)

    # If the user is moving from draft → scheduled, require scheduled_at;
    # going the other way (scheduled → draft) clears the scheduled_at and
    # re-arms the 15-day expiry.
    new_status = payload.get("status", post.status)
    new_scheduled_at = payload.get("scheduled_at", post.scheduled_at)
    if new_status == "scheduled" and not new_scheduled_at:
        raise HTTPException(
            status_code=422,
            detail="scheduled_at is required when status='scheduled'.",
        )

    for key, value in payload.items():
        setattr(post, key, value)

    if new_status == "draft" and post.draft_expires_at is None:
        post.draft_expires_at = datetime.now(timezone.utc) + DRAFT_TTL
    if new_status != "draft":
        post.draft_expires_at = None

    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return {"success": True, "data": _serialize(post)}


@router.delete("/creator/posts/{post_id}")
def delete_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a post + its media. Media deletes are best-effort — the DB
    row is removed even if R2 cleanup fails (logged for follow-up)."""
    post = _scoped_post_or_404(db, user, post_id)
    urls = list(post.media_urls or [])
    db.delete(post)
    db.commit()

    for url in urls:
        try:
            delete_media(url)
        except Exception:
            logger.exception("media delete failed for url=%s post_id=%s", url, post_id)

    return {"success": True, "data": {"id": post_id}}


@router.get("/creator/calendar")
def calendar_view(
    month: str = Query(..., description="YYYY-MM"),
    account_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return posts grouped by date for a calendar month view.

    A post is bucketed by `scheduled_at` if set, else `published_at`,
    else `created_at` (for raw drafts). Anything that lands in the
    requested month — regardless of status — is returned, so the
    Calendar tab can colour-code by status client-side.
    """
    try:
        year_str, month_str = month.split("-")
        year = int(year_str)
        month_num = int(month_str)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=422, detail="month must be YYYY-MM",
        ) from exc

    if month_num < 1 or month_num > 12:
        raise HTTPException(status_code=422, detail="invalid month")

    start = datetime(year, month_num, 1, tzinfo=timezone.utc)
    if month_num == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)

    q = db.query(ScheduledPost).filter(
        ScheduledPost.organization_id == user.organization_id,
    )
    if account_id:
        try:
            account_uuid = PyUUID(account_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid account_id") from exc
        q = q.filter(ScheduledPost.social_account_id == account_uuid)

    rows = q.all()

    grouped: dict[str, list[dict]] = {}
    for post in rows:
        # Prefer scheduled_at, fall back to published_at, then created_at.
        anchor = post.scheduled_at or post.published_at or post.created_at
        if anchor is None:
            continue
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        if anchor < start or anchor >= end:
            continue
        key = anchor.date().isoformat()
        grouped.setdefault(key, []).append(_serialize(post))

    return {
        "success": True,
        "data": {date_key: {"posts": posts} for date_key, posts in grouped.items()},
    }


@router.get("/media/{filename}")
def serve_local_media(filename: str):
    """Dev-only static handler for the local-fallback storage backend.

    No-op when R2 is configured — production reads media directly from
    the public bucket URL, this route is never hit. Kept lightweight (no
    auth) since the local fallback is meant for dev, not for serving
    sensitive content.
    """
    if is_r2_configured():
        raise HTTPException(status_code=404, detail="Not found")
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = LOCAL_MEDIA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
