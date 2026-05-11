"""Sprint 5 — Instagram Publishing pipeline tests.

All Instagram Graph API calls are mocked at the `httpx.AsyncClient` layer
so the suite stays hermetic. Each test asserts both the DB side-effects
(post.status, post.platform_post_id, account.needs_reauth) and the exact
sequence of Graph calls made (count + URLs hit).
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.core import instagram_publisher as ig
from app.core.encryption import encrypt_token
from app.models.scheduled_post import ScheduledPost
from app.models.social_account import Platform, SocialAccount
from app.tasks.post_publisher import dispatch_due_posts, publish_scheduled_post


# ── Helpers ──────────────────────────────────────────────────────────


def _make_account(db, org_id, *, token: str = "fake-token"):
    """Seed a social_account row with a real Fernet-encrypted token so the
    publisher's decrypt_token() round-trips successfully.
    """
    account = SocialAccount(
        organization_id=org_id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uuid.uuid4().hex[:8]}",
        username=f"user_{uuid.uuid4().hex[:6]}",
        access_token_encrypted=encrypt_token(token),
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
        is_active=True,
        needs_reauth=False,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _make_post(
    db, org_id, account_id, *,
    media_urls=None,
    media_type="image",
    caption="hello",
    status="publishing",
    scheduled_at=None,
):
    post = ScheduledPost(
        organization_id=org_id,
        social_account_id=account_id,
        media_urls=media_urls or ["https://cdn.example/img.png"],
        media_type=media_type,
        caption_en=caption,
        hashtags=[],
        status=status,
        scheduled_at=scheduled_at,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def _resp(status_code: int, payload: dict):
    """Build a fake httpx.Response that supports .json() and .status_code."""
    r = MagicMock()
    r.status_code = status_code
    r.json.return_value = payload
    return r


class _FakeAsyncClient:
    """Stand-in for httpx.AsyncClient that returns a programmed sequence
    of responses. Records every call so tests can assert URL + payload."""

    def __init__(self, responses):
        # responses: list of (method, response) tuples in expected order
        self._responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, data=None, **kwargs):
        self.calls.append(("POST", url, data))
        method, resp = self._responses.pop(0)
        assert method == "POST", f"Expected POST, got next={method} for url={url}"
        return resp

    async def get(self, url, params=None, **kwargs):
        self.calls.append(("GET", url, params))
        method, resp = self._responses.pop(0)
        assert method == "GET", f"Expected GET, got next={method} for url={url}"
        return resp


def _patch_client(responses):
    """Patch httpx.AsyncClient inside instagram_publisher with our fake."""
    fake = _FakeAsyncClient(responses)
    return patch.object(ig.httpx, "AsyncClient", return_value=fake), fake


# Always-skip the real container-poll sleep so tests don't burn 2-5s each.
async def _no_sleep(_seconds):
    return None


# ── Publisher tests ──────────────────────────────────────────────────


def test_publish_image_post(db, insights_user):
    """Image: POST media → GET status (FINISHED) → POST media_publish = 3 calls."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    responses = [
        ("POST", _resp(200, {"id": "container-1"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "PLATFORM-POST-1"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep):
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-POST-1"
    db.refresh(post)
    assert post.status == "published"
    assert post.platform_post_id == "PLATFORM-POST-1"
    assert post.published_at is not None
    assert len(fake.calls) == 3
    assert fake.calls[0][0] == "POST" and "/media" in fake.calls[0][1] and "media_publish" not in fake.calls[0][1]
    assert fake.calls[1][0] == "GET"  and fake.calls[1][2]["fields"] == "status_code"
    assert fake.calls[2][0] == "POST" and "media_publish" in fake.calls[2][1]


def test_publish_carousel(db, insights_user):
    """Carousel of 3 items: each child + parent now also polls before publish.

    3 child creates × (POST + GET FINISHED) + parent (POST + GET FINISHED)
    + 1 publish = 3*2 + 2 + 1 = 9 calls.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(
        db, org.id, account.id,
        media_urls=[
            "https://cdn.example/a.png",
            "https://cdn.example/b.png",
            "https://cdn.example/c.png",
        ],
        media_type="image",
    )

    responses = [
        ("POST", _resp(200, {"id": "item-1"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "item-2"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "item-3"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "carousel-1"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "PLATFORM-CAROUSEL-1"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep):
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-CAROUSEL-1"
    assert len(fake.calls) == 9
    # Item create + poll triples (calls 0,2,4 are creates with is_carousel_item)
    for i in (0, 2, 4):
        assert fake.calls[i][2]["is_carousel_item"] == "true"
    # Carousel container creation at call 6
    assert fake.calls[6][2]["media_type"] == "CAROUSEL"
    assert fake.calls[6][2]["children"] == "item-1,item-2,item-3"
    # Final publish at call 8
    assert "media_publish" in fake.calls[8][1]


def test_publish_video_polls_until_ready(db, insights_user):
    """Reel: container create → 3 status_code polls → publish = 5 calls."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(
        db, org.id, account.id,
        media_urls=["https://cdn.example/clip.mp4"],
        media_type="reel",
    )

    responses = [
        ("POST", _resp(200, {"id": "video-container-1"})),
        ("GET",  _resp(200, {"status_code": "IN_PROGRESS"})),
        ("GET",  _resp(200, {"status_code": "IN_PROGRESS"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "PLATFORM-REEL-1"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep):
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-REEL-1"
    assert len(fake.calls) == 5
    assert all(c[0] == "GET" for c in fake.calls[1:4])


def test_publish_container_stuck_in_progress_times_out(db, insights_user):
    """Container that never reaches FINISHED inside the timeout → PublishError
    with is_retryable=True; no /media_publish call is ever made.

    Faking out asyncio.sleep AND datetime.now to simulate the 60s timeout
    deadline being reached without burning real wall time.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    # Enough IN_PROGRESS responses that the loop will exit on the timeout
    # check rather than running out of mocked responses.
    responses = [("POST", _resp(200, {"id": "stuck-container"}))]
    for _ in range(40):
        responses.append(("GET", _resp(200, {"status_code": "IN_PROGRESS"})))

    # Advance virtual time by 5s on each "sleep" call, blowing past the 60s
    # CONTAINER_POLL_TIMEOUT_SECONDS deadline after ~13 polls.
    virtual_now = [datetime.now(timezone.utc)]

    def _fake_datetime_now(_tz=None):
        return virtual_now[0]

    fake_dt_cls = MagicMock(wraps=datetime)
    fake_dt_cls.now = _fake_datetime_now

    async def _advance(_seconds):
        virtual_now[0] = virtual_now[0] + timedelta(seconds=5)

    patcher, fake = _patch_client(responses)
    with patcher, \
         patch.object(ig.asyncio, "sleep", _advance), \
         patch.object(ig, "datetime", fake_dt_cls), \
         pytest.raises(ig.PublishError) as exc_info:
        asyncio.run(ig.publish_post(account, post, db))

    assert exc_info.value.is_retryable is True
    assert exc_info.value.is_transient_readiness is False
    # No /media_publish call should ever have been issued.
    publish_calls = [c for c in fake.calls if "media_publish" in c[1]]
    assert publish_calls == []


def test_publish_container_returns_error(db, insights_user):
    """Container with status_code=ERROR → terminal PublishError; no publish call."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    responses = [
        ("POST", _resp(200, {"id": "bad-container"})),
        ("GET",  _resp(200, {"status_code": "ERROR"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep), \
         pytest.raises(ig.PublishError) as exc_info:
        asyncio.run(ig.publish_post(account, post, db))

    assert exc_info.value.is_retryable is False
    db.refresh(post)
    assert post.status == "failed"
    publish_calls = [c for c in fake.calls if "media_publish" in c[1]]
    assert publish_calls == []


def test_publish_handles_token_expired(db, insights_user):
    """OAuthException code 190 → status='failed' + needs_reauth=True."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    responses = [
        ("POST", _resp(401, {"error": {"code": 190, "message": "Token expired"}})),
    ]
    patcher, _ = _patch_client(responses)
    with patcher, pytest.raises(ig.PublishError) as exc_info:
        asyncio.run(ig.publish_post(account, post, db))

    assert exc_info.value.is_token_expired
    db.refresh(post)
    db.refresh(account)
    assert post.status == "failed"
    assert post.error_message
    assert account.needs_reauth is True
    assert account.is_active is False


# ── Error-classifier tests ───────────────────────────────────────────


def test_real_rate_limit_code_classified_correctly(db, insights_user):
    """Real Meta rate-limit code (17 = User Request Limit) → is_rate_limited=True,
    is_transient_readiness=False.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id, status="scheduled",
                      scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1))

    responses = [
        ("POST", _resp(400, {"error": {"code": 17, "message": "User request limit reached"}})),
    ]
    captured = {}

    class _RetryCalled(Exception):
        pass

    def _fake_retry(*, exc=None, countdown=None):  # noqa: ARG001
        captured["countdown"] = countdown
        captured["exc"] = exc
        raise _RetryCalled()

    patcher, _ = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep), \
         patch.object(publish_scheduled_post, "retry", side_effect=_fake_retry), \
         pytest.raises(_RetryCalled):
        publish_scheduled_post.run(str(post.id))

    # Real rate limit → 1-hour countdown.
    assert captured["countdown"] == 60 * 60
    assert captured["exc"].is_rate_limited is True
    assert captured["exc"].is_transient_readiness is False
    db.refresh(post)
    # Task instance owns the row across retries; stays 'publishing'.
    assert post.status == "publishing"


def test_code_9007_treated_as_container_not_ready_short_retry(db, insights_user):
    """Code 9007 → is_transient_readiness=True, is_rate_limited=False; retry
    with short (10s) countdown, not the 1h rate-limit backoff.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id, status="scheduled",
                      scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1))

    # Force container polling to succeed so we reach /media_publish, where we
    # inject the 9007.
    responses = [
        ("POST", _resp(200, {"id": "container-9007"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(400, {"error": {"code": 9007, "message": "Media ID is not available"}})),
    ]
    captured = {}

    class _RetryCalled(Exception):
        pass

    def _fake_retry(*, exc=None, countdown=None):  # noqa: ARG001
        captured["countdown"] = countdown
        captured["exc"] = exc
        raise _RetryCalled()

    patcher, _ = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep), \
         patch.object(publish_scheduled_post, "retry", side_effect=_fake_retry), \
         pytest.raises(_RetryCalled):
        publish_scheduled_post.run(str(post.id))

    assert captured["countdown"] == 10  # CONTAINER_NOT_READY_RETRY_SECONDS
    assert captured["exc"].is_transient_readiness is True
    assert captured["exc"].is_rate_limited is False


def test_code_9007_exhausts_after_max_retries(db, insights_user):
    """9007 with self.request.retries >= CONTAINER_NOT_READY_MAX_RETRIES (3) →
    no further retry; the task returns the exhaustion sentinel.

    Uses `task.apply(args=..., retries=3)` rather than patching `.request`
    because Celery's `request` is a property without a deleter — patch_object
    can't tear down cleanly. `.apply()` runs the task eagerly with the given
    retries count visible to `self.request.retries`.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id, status="publishing")

    responses = [
        ("POST", _resp(200, {"id": "container-9007"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(400, {"error": {"code": 9007, "message": "Media ID is not available"}})),
    ]

    patcher, _ = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep):
        async_result = publish_scheduled_post.apply(args=[str(post.id)], retries=3)

    assert async_result.successful(), async_result.traceback
    result = async_result.get()
    assert result["status"] == "failed"
    assert result["reason"] == "container_not_ready_exhausted"


# ── Dispatcher tests ─────────────────────────────────────────────────


def test_dispatch_due_posts_picks_up_only_scheduled_and_due(db, insights_user):
    """Dispatcher must NOT pick up `publishing` rows (Celery owns those during
    retry). Only `scheduled` + scheduled_at<=now is dispatchable.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)

    now = datetime.now(timezone.utc)
    due       = _make_post(db, org.id, account.id, status="scheduled", scheduled_at=now - timedelta(minutes=5))
    not_due   = _make_post(db, org.id, account.id, status="scheduled", scheduled_at=now + timedelta(hours=1))
    in_flight = _make_post(db, org.id, account.id, status="publishing")
    draft     = _make_post(db, org.id, account.id, status="draft")

    delays = []

    def _record_delay(post_id):
        delays.append(post_id)
        return MagicMock(id="task-fake")

    async def _no_refresh(_acct, _db):
        return False

    with patch.object(publish_scheduled_post, "delay", side_effect=_record_delay), \
         patch.object(ig, "refresh_token_if_needed", _no_refresh):
        result = dispatch_due_posts.run()

    assert str(due.id) in delays
    # Critical: in-flight rows must NOT be re-dispatched (was the source of the
    # 2026-05-11 tight retry loop).
    assert str(in_flight.id) not in delays
    assert str(not_due.id) not in delays
    assert str(draft.id) not in delays
    assert set(delays) == set(result["queued"])


def test_concurrent_dispatch_while_publishing_no_second_publish(db, insights_user):
    """Atomic claim guarantees that even if .delay() were called twice for the
    same row, only ONE task-instance proceeds with publishing.

    Simulated by: row is `scheduled`. First task call claims it (status flips
    to `publishing`). Second task call finds status='publishing' and short-
    circuits as `noop`.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id, status="scheduled",
                      scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1))

    # First call: full happy path (image post).
    responses_first = [
        ("POST", _resp(200, {"id": "container-1"})),
        ("GET",  _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "PLATFORM-POST-1"})),
    ]
    patcher1, fake1 = _patch_client(responses_first)
    with patcher1, patch.object(ig.asyncio, "sleep", _no_sleep):
        r1 = publish_scheduled_post.run(str(post.id))
    assert r1["status"] == "published"
    db.refresh(post)
    assert post.status == "published"

    # Second concurrent invocation: row is no longer 'scheduled' → claim fails,
    # NO Graph calls are issued. Mock returns no responses; if any HTTP call
    # were made, the FakeAsyncClient.pop(0) would raise IndexError and the
    # test would fail loudly.
    patcher2, fake2 = _patch_client([])
    with patcher2:
        r2 = publish_scheduled_post.run(str(post.id))
    assert r2["status"] in {"noop", "already_published"}
    assert fake2.calls == []  # no second publish


# ── Token expiry / refresh ──────────────────────────────────────────


def test_token_refresh_updates_db(db, insights_user):
    """Token within 7 days of expiry → refresh call → encrypted token replaced."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id, token="old-token")
    account.token_expires_at = datetime.now(timezone.utc) + timedelta(days=3)
    db.commit()

    responses = [
        ("GET", _resp(200, {"access_token": "fresh-token", "expires_in": 5_184_000})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher:
        refreshed = asyncio.run(ig.refresh_token_if_needed(account, db))

    assert refreshed is True
    db.refresh(account)
    from app.core.encryption import decrypt_token
    assert decrypt_token(account.access_token_encrypted) == "fresh-token"
    assert account.token_expires_at > datetime.now(timezone.utc) + timedelta(days=50)
    assert len(fake.calls) == 1
    assert "refresh_access_token" in fake.calls[0][1]


# ── Post-now API path ───────────────────────────────────────────────


def test_dispatcher_picks_up_stale_publishing_row(db, insights_user):
    """Worker crashed mid-publish → row stuck in `publishing` with an old
    publishing_started_at. Dispatcher's stale-recovery branch must pick it
    up so the row isn't pinned forever.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)

    # 15 minutes ago — comfortably beyond the 10-min stale window.
    stale_ts = datetime.now(timezone.utc) - timedelta(minutes=15)
    post = _make_post(db, org.id, account.id, status="publishing")
    post.publishing_started_at = stale_ts
    db.commit()

    delays = []

    def _record_delay(post_id):
        delays.append(post_id)
        return MagicMock(id="task-fake")

    async def _no_refresh(_acct, _db):
        return False

    with patch.object(publish_scheduled_post, "delay", side_effect=_record_delay), \
         patch.object(ig, "refresh_token_if_needed", _no_refresh):
        result = dispatch_due_posts.run()

    assert str(post.id) in delays
    assert str(post.id) in result["queued"]


def test_dispatcher_skips_recent_publishing_row(db, insights_user):
    """A row that started publishing 2 minutes ago is NOT stale — Celery's
    retry queue still owns it. Dispatcher must skip it.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)

    fresh_ts = datetime.now(timezone.utc) - timedelta(minutes=2)
    post = _make_post(db, org.id, account.id, status="publishing")
    post.publishing_started_at = fresh_ts
    db.commit()

    delays = []

    def _record_delay(post_id):
        delays.append(post_id)
        return MagicMock(id="task-fake")

    async def _no_refresh(_acct, _db):
        return False

    with patch.object(publish_scheduled_post, "delay", side_effect=_record_delay), \
         patch.object(ig, "refresh_token_if_needed", _no_refresh):
        result = dispatch_due_posts.run()

    assert str(post.id) not in delays
    assert str(post.id) not in result["queued"]


def test_rate_limit_retry_bumps_publishing_started_at(db, insights_user):
    """On real rate-limit retry, publishing_started_at must be bumped to NOW
    so the 10-minute stale window restarts from the retry — otherwise the
    1-hour Celery countdown would race the dispatcher's stale-recovery.
    """
    _user, org, _token = insights_user
    account = _make_account(db, org.id)

    # Seed the row with an OLD publishing_started_at (12 min ago) — if the
    # rate-limit branch forgets to bump, this would still look stale after
    # commit.
    old_ts = datetime.now(timezone.utc) - timedelta(minutes=12)
    post = _make_post(db, org.id, account.id, status="scheduled",
                      scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    post.publishing_started_at = old_ts
    db.commit()

    responses = [
        ("POST", _resp(400, {"error": {"code": 17, "message": "User request limit reached"}})),
    ]

    class _RetryCalled(Exception):
        pass

    def _fake_retry(*, exc=None, countdown=None):  # noqa: ARG001
        raise _RetryCalled()

    patcher, _ = _patch_client(responses)
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep), \
         patch.object(publish_scheduled_post, "retry", side_effect=_fake_retry), \
         pytest.raises(_RetryCalled):
        publish_scheduled_post.run(str(post.id))

    db.refresh(post)
    assert post.status == "publishing"
    # publishing_started_at must have been bumped — well within the last minute.
    assert post.publishing_started_at is not None
    age = datetime.now(timezone.utc) - post.publishing_started_at
    assert age < timedelta(minutes=1), f"publishing_started_at not bumped (age={age})"


def test_post_now_stores_scheduled_and_fires_delay(client, db, insights_user):
    """The "Post now" API request (status='publishing' in body) must:
      1. Store the row as status='scheduled' with scheduled_at=NOW(),
         so the publisher's atomic-claim path can transition it.
      2. Immediately .delay() the publish task so the user sees a fast
         result instead of waiting for the next beat tick.
    """
    _user, org, token = insights_user
    account = _make_account(db, org.id)

    with patch.object(publish_scheduled_post, "delay") as mock_delay:
        res = client.post(
            "/api/v1/creator/posts",
            json={
                "social_account_id": str(account.id),
                "media_urls": ["https://cdn.example/x.png"],
                "media_type": "image",
                "caption_en": "Post now flow",
                "status": "publishing",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert res.status_code == 200, res.text
    body = res.json()["data"]
    # Row stored as scheduled, not publishing.
    assert body["status"] == "scheduled"
    assert body["scheduled_at"] is not None
    # delay() still fires once for the immediate-publish optimization.
    assert mock_delay.call_count == 1
    assert mock_delay.call_args[0][0] == body["id"]
