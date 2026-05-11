"""Celery tasks that publish scheduled_post rows to Instagram.

Two tasks live here:

  * `publish_scheduled_post(post_id)` — picks up a single post and runs it
    through the publisher. Retries on transient errors (rate limit, 5xx,
    container-not-ready, network blip) with category-specific backoff;
    treats token expiry / malformed media as terminal so we don't burn
    quota.

  * `dispatch_due_posts()` — Beat-driven dispatcher that runs every minute
    and queues `publish_scheduled_post.delay(...)` for any post whose
    `scheduled_at` has passed AND whose status is exactly `scheduled`.
    It does NOT pick up in-flight rows — Celery's own retry mechanism
    handles those, and re-dispatching them caused the 2026-05-11 tight
    retry loop that burned ~70+ Meta API calls in 36 minutes.

State machine (enforced by the atomic claim in publish_scheduled_post):

    draft      ─────────────────────────────────────┐ (UI only)
    scheduled  ──atomic UPDATE→  publishing ─→ published
                                            └──→ failed
                                            └──→ (Celery retry; status stays
                                                  publishing because the same
                                                  task instance owns the row)
    cancelled                                       │ (UI only)

`publishing` is only ever set by:
  (a) the atomic claim inside the task (transition from `scheduled`)
  (b) the API's "Post now" handler, which now ALSO writes
      `status='scheduled', scheduled_at=NOW()` and lets the same atomic
      claim path take over — keeping a single transition point.

Token refresh runs from the dispatcher (not per-post) so a single check per
account per minute is enough to keep tokens warm without spamming the
refresh endpoint from every publish call.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from celery import Task
from sqlalchemy import text
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

# Backoff schedule by failure class:
#   * Real Meta rate limit (codes 4/17/32/613 or HTTP 429) — Meta itself
#     asks for ~1h between calls when this fires. Anything shorter just
#     re-trips the same limit.
#   * 5xx + network blips — short exponential backoff. Usually clears in
#     seconds.
#   * Container-not-ready (code 9007) — with polling in place this should
#     be unreachable; if it does surface, it's a brief readiness gap. Very
#     short backoff (10s), capped at 3 tries before we give up on the post.
RATE_LIMIT_RETRY_SECONDS = 60 * 60
DEFAULT_RETRY_SECONDS = 60
CONTAINER_NOT_READY_RETRY_SECONDS = 10
CONTAINER_NOT_READY_MAX_RETRIES = 3


def _run_async(coro):
    """Run an async coroutine inside a Celery task.

    Each task invocation gets its own loop so concurrent worker processes
    don't share state. asyncio.run cleans up properly on completion.
    """
    return asyncio.run(coro)


def _claim_post(db: Session, post_id: str) -> bool:
    """Atomically claim a scheduled post for publishing.

    Returns True if this task instance now owns the row (status flipped from
    `scheduled` to `publishing`), False if no row was eligible (already
    settled, already in-flight by another worker, or doesn't exist).

    The UPDATE ... RETURNING pattern serializes against any concurrent
    claim attempt at the row level — only one caller can flip a given row
    from `scheduled` to `publishing`. Beat dispatches that race with the
    "Post now" API path resolve cleanly: whoever wins the UPDATE proceeds;
    the loser sees `None` and short-circuits.
    """
    row = db.execute(
        text(
            "UPDATE scheduled_post "
            "SET status = 'publishing', error_message = NULL "
            "WHERE id = :id AND status = 'scheduled' "
            "RETURNING id"
        ),
        {"id": post_id},
    ).fetchone()
    db.commit()
    return row is not None


@celery.task(name="publish_scheduled_post", bind=True, max_retries=3)
def publish_scheduled_post(self: Task, post_id: str) -> dict:
    """Publish a single scheduled_post to Instagram.

    First call atomically claims the row (status `scheduled` → `publishing`).
    Celery retries skip the claim — `self.request.retries > 0` means we're
    re-entering the same task instance that already owns the row, so the
    row should still be `publishing` from our first call.

    Idempotent in the sense that already-settled rows short-circuit
    immediately. A row that's `publishing` but NOT from our own retry is
    treated as already-claimed-by-another-worker and skipped.
    """
    db: Session = SessionLocal()
    is_retry = self.request.retries > 0
    try:
        if not is_retry:
            # First attempt: atomic claim. If it fails the row isn't
            # `scheduled` — either already settled, or another worker took
            # it. Either way, this task has no work to do.
            if not _claim_post(db, post_id):
                # Surface what state the row is actually in for the log.
                post = (
                    db.query(ScheduledPost)
                    .filter(ScheduledPost.id == post_id)
                    .first()
                )
                actual = post.status if post else "missing"
                logger.info(
                    "publish_scheduled_post: post %s not claimable (status=%s)",
                    post_id, actual,
                )
                return {"status": "noop", "reason": "not_claimable", "actual": actual}

        post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
        if post is None:
            logger.warning("publish_scheduled_post: post %s vanished mid-flight", post_id)
            return {"status": "missing"}

        # Defense-in-depth: if a retry re-entered but the row is no longer
        # `publishing`, something else mutated it (manual recovery, cancel,
        # etc.) — abort instead of fighting that.
        if is_retry and post.status != "publishing":
            logger.info(
                "publish_scheduled_post: retry aborted, post %s status=%s (not publishing)",
                post_id, post.status,
            )
            return {"status": "aborted_retry", "actual_status": post.status}

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

        try:
            platform_post_id = _run_async(publish_post(account, post, db))
        except PublishError as exc:
            # Token expired → terminal. The user must reconnect.
            if exc.is_token_expired:
                # publish_post already set status=failed + flipped
                # account.needs_reauth before raising; nothing to do here.
                return {"status": "failed", "reason": "token_expired"}

            # Real Meta rate limit → 1-hour backoff. Status stays
            # `publishing` so the dispatcher does NOT re-pick it up; the
            # retry comes from Celery itself.
            if exc.is_rate_limited:
                logger.info(
                    "publish %s rate-limited (code=%s); Celery retry in %ss",
                    post_id, exc.code, RATE_LIMIT_RETRY_SECONDS,
                )
                # Clear publish_post's status='failed' write — we're
                # actively retrying this row, not giving up.
                post.status = "publishing"
                db.commit()
                raise self.retry(exc=exc, countdown=RATE_LIMIT_RETRY_SECONDS)

            # Container-not-ready (code 9007) → short backoff, capped at
            # CONTAINER_NOT_READY_MAX_RETRIES to bound the worst case. With
            # the publisher's polling layer this branch should be unreachable
            # in practice; the cap is a safety net.
            if exc.is_container_not_ready:
                if self.request.retries >= CONTAINER_NOT_READY_MAX_RETRIES:
                    logger.warning(
                        "publish %s exhausted container-not-ready retries", post_id,
                    )
                    return {"status": "failed", "reason": "container_not_ready_exhausted"}
                post.status = "publishing"
                db.commit()
                logger.info(
                    "publish %s container not ready (code 9007); Celery retry in %ss",
                    post_id, CONTAINER_NOT_READY_RETRY_SECONDS,
                )
                raise self.retry(exc=exc, countdown=CONTAINER_NOT_READY_RETRY_SECONDS)

            # Other retryable (5xx, network, container timeout) → short
            # exponential backoff.
            if exc.is_retryable:
                countdown = DEFAULT_RETRY_SECONDS * (2 ** self.request.retries)
                post.status = "publishing"
                db.commit()
                logger.info(
                    "publish %s transient failure (code=%s); Celery retry in %ss",
                    post_id, exc.code, countdown,
                )
                raise self.retry(exc=exc, countdown=countdown)

            # Terminal: malformed media, permission denied, container
            # explicitly rejected with status_code=ERROR, etc. publish_post
            # already wrote status='failed' before raising.
            return {"status": "failed", "reason": "terminal", "message": str(exc)}

        return {"status": "published", "platform_post_id": platform_post_id}
    finally:
        db.close()


@celery.task(name="dispatch_due_posts")
def dispatch_due_posts() -> dict:
    """Beat-driven dispatcher. Picks up scheduled+due posts ONLY (never
    in-flight `publishing` rows — Celery's own retry mechanism owns those)
    and queues per-post publish tasks. Runs every minute.

    Caps at DISPATCH_BATCH_LIMIT per tick so a sudden backlog doesn't
    overwhelm Instagram's per-token rate limit.

    The strict `status='scheduled'` filter is load-bearing: re-dispatching
    `status='publishing'` rows produces a tight retry loop because each
    new dispatch creates a fresh Meta media container and tries to publish
    it. Beat fires once per minute; an actively-retrying task may also fire
    within that minute via Celery's retry queue — double-dispatching means
    double the Meta API calls, double the quota burn.
    """
    db: Session = SessionLocal()
    queued: list[str] = []
    try:
        now = datetime.now(timezone.utc)

        rows = (
            db.query(ScheduledPost)
            .filter(
                ScheduledPost.status == "scheduled",
                ScheduledPost.scheduled_at <= now,
            )
            .order_by(ScheduledPost.scheduled_at.asc())
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
