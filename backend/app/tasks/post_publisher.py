"""Celery tasks that publish scheduled_post rows to Instagram.

Two tasks live here:

  * `publish_scheduled_post(post_id)` — picks up a single post and runs it
    through the publisher. Retries on transient errors (rate limit, 5xx,
    network blip) with exponential backoff; treats token expiry / malformed
    media as terminal so we don't burn quota.

  * `dispatch_due_posts()` — Beat-driven dispatcher that runs every minute
    and queues `publish_scheduled_post.delay(...)` for any post whose
    scheduled_at has passed. Also picks up `status='publishing'` rows so
    the "Post now" button can hand off to the same pipeline.

Token refresh runs from the dispatcher (not per-post) so a single check per
account per minute is enough to keep tokens warm without spamming the
refresh endpoint from every publish call.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from celery import Task
from sqlalchemy.orm import Session

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.core.instagram_publisher import (
    PublishError,
    publish_post,
    refresh_token_if_needed,
)
from app.models.scheduled_post import ScheduledPost
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)


# Cap each dispatcher run so a backlog can't queue a thousand publishes
# in one minute and trip Instagram's per-token rate limit. Anything still
# pending after the cap waits for the next tick (60s later).
DISPATCH_BATCH_LIMIT = 10

# Rate-limit retry: Instagram says wait an hour. The other retryable
# failure modes (network, 5xx) get exponential backoff via Celery's default.
RATE_LIMIT_RETRY_SECONDS = 60 * 60
DEFAULT_RETRY_SECONDS = 60


def _run_async(coro):
    """Run an async coroutine inside a Celery task.

    Each task invocation gets its own loop so concurrent worker processes
    don't share state. asyncio.run cleans up properly on completion.
    """
    return asyncio.run(coro)


@celery.task(name="publish_scheduled_post", bind=True, max_retries=3)
def publish_scheduled_post(self: Task, post_id: str) -> dict:
    """Publish a single scheduled_post to Instagram.

    Idempotent in the sense that already-published posts short-circuit
    immediately — useful when Beat happens to re-enqueue a row that the
    "Post now" button just kicked off in parallel.
    """
    db: Session = SessionLocal()
    try:
        post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
        if post is None:
            logger.warning("publish_scheduled_post: post %s not found", post_id)
            return {"status": "missing"}

        if post.status == "published":
            return {"status": "already_published", "platform_post_id": post.platform_post_id}
        if post.status in {"failed", "cancelled"}:
            return {"status": post.status}

        # Don't publish a draft that hasn't been promoted yet.
        if post.status == "scheduled":
            now = datetime.now(timezone.utc)
            scheduled_at = post.scheduled_at
            if scheduled_at and scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            if scheduled_at and scheduled_at > now:
                logger.info("publish_scheduled_post: post %s not yet due (%s)", post_id, scheduled_at)
                return {"status": "not_due"}

        account = (
            db.query(SocialAccount)
            .filter(SocialAccount.id == post.social_account_id)
            .first()
        )
        if account is None or not account.is_active or account.needs_reauth:
            post.status = "failed"
            post.error_message = "Instagram account is disconnected or needs reauth"
            db.commit()
            return {"status": "failed", "reason": "account_unavailable"}

        # Mark in-flight so concurrent dispatch ticks don't re-queue this row.
        post.status = "publishing"
        post.error_message = None
        db.commit()

        try:
            platform_post_id = _run_async(publish_post(account, post, db))
        except PublishError as exc:
            if exc.is_token_expired:
                # Terminal — don't retry, the user has to reconnect.
                return {"status": "failed", "reason": "token_expired"}
            if exc.is_rate_limited:
                logger.info("publish %s rate-limited; retrying in %ss", post_id, RATE_LIMIT_RETRY_SECONDS)
                # Reset to scheduled so the dispatcher can pick it back up.
                post.status = "scheduled" if post.scheduled_at else "publishing"
                db.commit()
                raise self.retry(exc=exc, countdown=RATE_LIMIT_RETRY_SECONDS)
            if exc.is_retryable:
                # Transient — exponential backoff via Celery's default jitter.
                countdown = DEFAULT_RETRY_SECONDS * (2 ** self.request.retries)
                logger.info("publish %s transient failure; retrying in %ss", post_id, countdown)
                post.status = "scheduled" if post.scheduled_at else "publishing"
                db.commit()
                raise self.retry(exc=exc, countdown=countdown)
            # Terminal: malformed media, container rejected, etc.
            return {"status": "failed", "reason": "terminal", "message": str(exc)}

        return {"status": "published", "platform_post_id": platform_post_id}
    finally:
        db.close()


@celery.task(name="dispatch_due_posts")
def dispatch_due_posts() -> dict:
    """Beat-driven dispatcher. Picks up due scheduled posts + 'Post now'
    publishing rows, refreshes any near-expiry tokens, queues per-post
    publish tasks. Runs every minute.

    Caps at DISPATCH_BATCH_LIMIT per tick so a sudden backlog doesn't
    overwhelm Instagram's per-token rate limit.
    """
    db: Session = SessionLocal()
    queued: list[str] = []
    try:
        now = datetime.now(timezone.utc)

        # Find candidate posts: scheduled + due, OR explicitly publishing
        # (the latter is how "Post now" hands off to this pipeline).
        rows = (
            db.query(ScheduledPost)
            .filter(
                (
                    (ScheduledPost.status == "scheduled")
                    & (ScheduledPost.scheduled_at <= now)
                )
                | (ScheduledPost.status == "publishing")
            )
            .order_by(ScheduledPost.scheduled_at.asc().nullsfirst())
            .limit(DISPATCH_BATCH_LIMIT)
            .all()
        )

        # Refresh tokens for the unique accounts we're about to publish from
        # (one batched check per account, not per post). Skip ones the
        # publisher has already marked needs_reauth.
        account_ids = {r.social_account_id for r in rows}
        for account_id in account_ids:
            account = (
                db.query(SocialAccount)
                .filter(SocialAccount.id == account_id)
                .first()
            )
            if account is None or account.needs_reauth or not account.is_active:
                continue
            try:
                _run_async(refresh_token_if_needed(account, db))
            except Exception:  # noqa: BLE001
                logger.exception("refresh_token_if_needed failed account=%s", account_id)

        for row in rows:
            publish_scheduled_post.delay(str(row.id))
            queued.append(str(row.id))

        if queued:
            logger.info("dispatch_due_posts queued %d posts", len(queued))
        return {"queued": queued}
    finally:
        db.close()
