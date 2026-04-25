"""Tests for the new batch tasks scheduled via Celery Beat.

generate_insights_all_accounts   — queues per-account EN + AR insight generation
sync_all_active_accounts         — queues per-account IG syncs, skips recent + tokenless

The test DB is shared across the whole suite, so any ``is_active=True``
social_account from a previous test can leak into these queries. Each test
cleans up its own accounts in a ``finally`` block AND scopes its
assertions to the specific account ids it created (instead of counting
total ``.delay`` invocations).
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import uuid as _u

from app.models.engagement_metric import EngagementMetric
from app.models.post import Post, ContentType, LanguageCode
from app.models.social_account import SocialAccount, Platform
from app.tasks.insights import generate_insights_all_accounts
from app.tasks.instagram_sync import sync_all_active_accounts


def _make_account(db, org_id, *, is_active=True, has_token=True, username=None):
    uid = _u.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org_id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=username or f"sched_{uid}",
        access_token_encrypted="encrypted_token" if has_token else None,
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
        is_active=is_active,
    )
    db.add(account)
    db.flush()
    return account


def _add_engagement_metric(db, account, recorded_at):
    """Add a post + engagement_metric with a specific recorded_at timestamp."""
    uid = _u.uuid4().hex[:8]
    p = Post(
        social_account_id=account.id,
        platform_post_id=f"p_{uid}",
        platform="instagram",
        content_type=ContentType.image,
        language=LanguageCode.en,
        caption="hello",
        posted_at=recorded_at,
    )
    db.add(p)
    db.flush()
    m = EngagementMetric(
        post_id=p.id, likes=1, comments=0, shares=0, saves=0,
        reach=0, impressions=0, engagement_rate=0.0,
        recorded_at=recorded_at,
    )
    db.add(m)
    db.commit()


def _cleanup(db, accounts):
    for a in accounts:
        db.query(Post).filter(Post.social_account_id == a.id).delete()
        db.query(SocialAccount).filter(SocialAccount.id == a.id).delete()
    db.commit()


def _called_ids(mock_delay) -> set[str]:
    """Return the set of social_account_ids the batch task queued."""
    return {c.args[0] for c in mock_delay.call_args_list}


def _called_pairs(mock_delay) -> set[tuple[str, str]]:
    """Return (social_account_id, language) pairs queued by insights batch."""
    return {(c.args[0], c.args[1]) for c in mock_delay.call_args_list}


# ── 1. generate_insights_all_accounts queues 2x per active account ─────

def test_generate_insights_all_accounts_queues_each(db, starter_user, insights_user):
    _, org_a, _ = starter_user
    _, org_b, _ = insights_user
    a1 = _make_account(db, org_a.id)
    a2 = _make_account(db, org_b.id)
    inactive = _make_account(db, org_a.id, is_active=False)
    db.commit()
    try:
        with patch("app.tasks.insights.generate_weekly_insights.delay") as mock_delay:
            result = generate_insights_all_accounts()

        pairs = _called_pairs(mock_delay)
        # Each active account queues both EN and AR
        assert (str(a1.id), "English") in pairs
        assert (str(a1.id), "Arabic") in pairs
        assert (str(a2.id), "English") in pairs
        assert (str(a2.id), "Arabic") in pairs
        # Inactive account never queued
        assert not any(pid == str(inactive.id) for pid, _ in pairs)
        # Call count == tasks_queued returned
        assert result["tasks_queued"] == mock_delay.call_count
        # Each account yields exactly 2 tasks
        assert result["tasks_queued"] == 2 * result["accounts"]
    finally:
        _cleanup(db, [a1, a2, inactive])


# ── 2. sync_all_active_accounts skips recently-synced accounts ─────────

def test_sync_all_skips_recent(db, starter_user):
    _, org, _ = starter_user
    fresh = _make_account(db, org.id)
    stale = _make_account(db, org.id)
    db.commit()

    now = datetime.now(timezone.utc)
    # fresh: synced 1 hour ago → skip
    _add_engagement_metric(db, fresh, now - timedelta(hours=1))
    # stale: synced 30 hours ago → should re-sync
    _add_engagement_metric(db, stale, now - timedelta(hours=30))

    try:
        with patch("app.tasks.instagram_sync.sync_instagram_posts.delay") as mock_delay:
            sync_all_active_accounts()

        called = _called_ids(mock_delay)
        assert str(stale.id) in called
        assert str(fresh.id) not in called
    finally:
        _cleanup(db, [fresh, stale])


# ── 3. sync_all_active_accounts queues never-synced accounts ───────────

def test_sync_all_queues_new_accounts(db, starter_user):
    _, org, _ = starter_user
    never_synced = _make_account(db, org.id)
    db.commit()

    try:
        with patch("app.tasks.instagram_sync.sync_instagram_posts.delay") as mock_delay:
            sync_all_active_accounts()

        called = _called_ids(mock_delay)
        assert str(never_synced.id) in called
    finally:
        _cleanup(db, [never_synced])


# ── 4. sync_all_active_accounts skips accounts without tokens ──────────

def test_sync_all_skips_tokenless(db, starter_user):
    _, org, _ = starter_user
    # has_token=False creates an account with NULL access_token_encrypted, which
    # the SQL filter drops before we even look at recency.
    no_token = _make_account(db, org.id, has_token=False)
    db.commit()

    try:
        with patch("app.tasks.instagram_sync.sync_instagram_posts.delay") as mock_delay:
            sync_all_active_accounts()

        called = _called_ids(mock_delay)
        assert str(no_token.id) not in called
    finally:
        _cleanup(db, [no_token])


# ── 5. Beat schedule is registered on the Celery app ───────────────────

def test_beat_schedule_is_wired():
    from app.core.celery_app import celery
    assert "weekly-insights-all-accounts" in celery.conf.beat_schedule
    assert "daily-instagram-sync" in celery.conf.beat_schedule
    # Task names in the schedule must match the registered task names
    assert (
        celery.conf.beat_schedule["weekly-insights-all-accounts"]["task"]
        == "generate_insights_all_accounts"
    )
    assert (
        celery.conf.beat_schedule["daily-instagram-sync"]["task"]
        == "sync_all_active_accounts"
    )
