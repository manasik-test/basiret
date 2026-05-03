"""Daily Celery tasks for the Post Creator drafts lifecycle.

Two scheduled jobs:

  * `cleanup_expired_drafts` — runs at 02:00 UTC daily. Deletes any
    `scheduled_post` row where `status='draft'` and `draft_expires_at`
    is in the past. Each row's `media_urls` are cleaned up from R2 (or
    the local fallback) on a best-effort basis — failed media-deletes
    don't block the row delete, just get logged.

  * `warn_expiring_drafts` — runs at 09:00 UTC daily. Logs the IDs of
    drafts whose expiry lands in the next 1–3 days. Email notifications
    are deferred to V2; for now a structured log line is the trail
    sysadmins / pre-defense reviewers can rely on.

Both tasks operate under their own `SessionLocal()` so they don't rely
on a request-scoped session.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.core.storage import delete_media
from app.models.scheduled_post import ScheduledPost

logger = logging.getLogger(__name__)


@celery.task(name="cleanup_expired_drafts")
def cleanup_expired_drafts():
    """Hard-delete drafts past their TTL and reclaim their R2 media."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rows = (
            db.query(ScheduledPost)
            .filter(
                ScheduledPost.status == "draft",
                ScheduledPost.draft_expires_at.isnot(None),
                ScheduledPost.draft_expires_at < now,
            )
            .all()
        )
        deleted = 0
        for post in rows:
            urls = list(post.media_urls or [])
            for url in urls:
                try:
                    delete_media(url)
                except Exception:
                    logger.exception(
                        "draft cleanup: media delete failed url=%s post_id=%s",
                        url, post.id,
                    )
            db.delete(post)
            deleted += 1
        db.commit()
        logger.info("cleanup_expired_drafts: deleted=%d", deleted)
        return {"deleted": deleted}
    finally:
        db.close()


@celery.task(name="warn_expiring_drafts")
def warn_expiring_drafts():
    """Log drafts that will expire in the next 1–3 days.

    The 1-day floor avoids re-warning the same row every morning until
    cleanup runs at 02:00 the next day. Drafts already inside the cleanup
    window (expiry < now) are intentionally excluded — those are the
    cleanup task's responsibility.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        soon_start = now + timedelta(days=1)
        soon_end = now + timedelta(days=3)
        rows = (
            db.query(ScheduledPost)
            .filter(
                ScheduledPost.status == "draft",
                ScheduledPost.draft_expires_at.isnot(None),
                ScheduledPost.draft_expires_at >= soon_start,
                ScheduledPost.draft_expires_at <= soon_end,
            )
            .all()
        )
        for post in rows:
            logger.warning(
                "draft expiring soon: id=%s org=%s expires_at=%s",
                post.id, post.organization_id, post.draft_expires_at.isoformat(),
            )
        return {"warned": len(rows)}
    finally:
        db.close()
