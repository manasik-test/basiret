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


# ── Tests ────────────────────────────────────────────────────────────


def test_publish_image_post(db, insights_user):
    """Image: 2 Graph calls (media + media_publish) → status=published."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    responses = [
        ("POST", _resp(200, {"id": "container-1"})),
        ("POST", _resp(200, {"id": "PLATFORM-POST-1"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher:
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-POST-1"
    db.refresh(post)
    assert post.status == "published"
    assert post.platform_post_id == "PLATFORM-POST-1"
    assert post.published_at is not None
    assert len(fake.calls) == 2
    assert "/media" in fake.calls[0][1] and "media_publish" not in fake.calls[0][1]
    assert "media_publish" in fake.calls[1][1]


def test_publish_carousel(db, insights_user):
    """Carousel of 3 items: 3 item containers + 1 carousel container + 1 publish = 5 calls."""
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
        ("POST", _resp(200, {"id": "item-2"})),
        ("POST", _resp(200, {"id": "item-3"})),
        ("POST", _resp(200, {"id": "carousel-1"})),
        ("POST", _resp(200, {"id": "PLATFORM-CAROUSEL-1"})),
    ]
    patcher, fake = _patch_client(responses)
    with patcher:
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-CAROUSEL-1"
    assert len(fake.calls) == 5
    # First three creates should each carry is_carousel_item=true.
    for i in range(3):
        assert fake.calls[i][2]["is_carousel_item"] == "true"
    # Fourth create should be the carousel container with children.
    assert fake.calls[3][2]["media_type"] == "CAROUSEL"
    assert fake.calls[3][2]["children"] == "item-1,item-2,item-3"


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
        ("GET", _resp(200, {"status_code": "IN_PROGRESS"})),
        ("GET", _resp(200, {"status_code": "IN_PROGRESS"})),
        ("GET", _resp(200, {"status_code": "FINISHED"})),
        ("POST", _resp(200, {"id": "PLATFORM-REEL-1"})),
    ]
    patcher, fake = _patch_client(responses)
    # Skip the real 5s sleep so the test stays fast.
    async def _no_sleep(_seconds):
        return None
    with patcher, patch.object(ig.asyncio, "sleep", _no_sleep):
        platform_post_id = asyncio.run(ig.publish_post(account, post, db))

    assert platform_post_id == "PLATFORM-REEL-1"
    assert len(fake.calls) == 5
    # Polling calls hit the container resource with fields=status_code.
    assert all(c[0] == "GET" for c in fake.calls[1:4])
    for c in fake.calls[1:4]:
        assert c[2]["fields"] == "status_code"


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


def test_publish_retries_on_rate_limit(db, insights_user):
    """code 9007 → task wrapper schedules a retry instead of marking failed."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)
    post = _make_post(db, org.id, account.id)

    responses = [
        ("POST", _resp(400, {"error": {"code": 9007, "message": "Rate limited"}})),
    ]
    patcher, _ = _patch_client(responses)
    # Patch self.retry so we can detect that the task wrapper invoked it
    # rather than swallowing the rate-limit error or marking failed.
    class _RetryCalled(Exception):
        pass

    def _fake_retry(*, exc=None, countdown=None):  # noqa: ARG001
        raise _RetryCalled()

    with patcher, patch.object(
        publish_scheduled_post, "retry", side_effect=_fake_retry,
    ), pytest.raises(_RetryCalled):
        publish_scheduled_post.run(str(post.id))

    db.refresh(post)
    # Rate-limit retry resets to scheduled (or publishing if no scheduled_at).
    # We didn't set scheduled_at, so it stays publishing.
    assert post.status == "publishing"


def test_dispatch_due_posts_picks_up_correct_rows(db, insights_user):
    """Only scheduled+due and explicitly-publishing posts are dispatched."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id)

    now = datetime.now(timezone.utc)
    due = _make_post(db, org.id, account.id, status="scheduled", scheduled_at=now - timedelta(minutes=5))
    not_due = _make_post(db, org.id, account.id, status="scheduled", scheduled_at=now + timedelta(hours=1))
    publishing = _make_post(db, org.id, account.id, status="publishing")
    draft = _make_post(db, org.id, account.id, status="draft")

    delays = []

    def _record_delay(post_id):
        delays.append(post_id)
        return MagicMock(id="task-fake")

    # Skip the token-refresh side trip; it requires a network round-trip.
    async def _no_refresh(_acct, _db):
        return False

    with patch.object(publish_scheduled_post, "delay", side_effect=_record_delay), \
         patch.object(ig, "refresh_token_if_needed", _no_refresh):
        result = dispatch_due_posts.run()

    assert str(due.id) in delays
    assert str(publishing.id) in delays
    assert str(not_due.id) not in delays
    assert str(draft.id) not in delays
    assert set(delays) == set(result["queued"])


def test_post_now_triggers_immediate_publish(client, db, insights_user):
    """POSTing a row with status='publishing' should also call .delay()."""
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
    assert mock_delay.call_count == 1
    post_id = res.json()["data"]["id"]
    assert mock_delay.call_args[0][0] == post_id


def test_token_refresh_updates_db(db, insights_user):
    """Token within 7 days of expiry → refresh call → encrypted token replaced."""
    _user, org, _token = insights_user
    account = _make_account(db, org.id, token="old-token")
    # Force expiry within the refresh threshold.
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
    # Expiry should now be ~60 days out.
    assert account.token_expires_at > datetime.now(timezone.utc) + timedelta(days=50)
    assert len(fake.calls) == 1
    assert "refresh_access_token" in fake.calls[0][1]
