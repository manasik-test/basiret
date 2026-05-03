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

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.storage import (
    LOCAL_MEDIA_DIR,
    delete_media,
    is_r2_configured,
    upload_media,
)
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
