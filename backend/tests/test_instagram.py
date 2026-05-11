"""
Instagram endpoint tests — auth URL, sync trigger, account disconnect.
"""
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch, MagicMock

import httpx

from app.core.config import settings
from app.core.security import decode_token, create_oauth_state_token
from app.tasks.instagram_sync import (
    _fetch_carousel_children,
    _fetch_insights_for_media,
)
from tests.conftest import seed_social_account_with_posts


def _mock_client(responses: list[MagicMock]) -> MagicMock:
    """Build a fake httpx.Client whose .get() returns the given responses in order."""
    client = MagicMock(spec=httpx.Client)
    client.get.side_effect = responses
    return client


def _ok_resp(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


def _err_resp(status: int, body: str = "") -> MagicMock:
    """Build an httpx response that .raise_for_status() will turn into HTTPStatusError."""
    resp = MagicMock()
    resp.status_code = status
    resp.text = body
    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "boom", request=MagicMock(), response=resp,
    )
    return resp


# ── 1. Get Instagram auth URL ──────────────────────────────

def test_instagram_auth_url(client, starter_user):
    user, _, token = starter_user
    resp = client.get(
        "/api/v1/instagram/auth-url",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    url = resp.json()["url"]
    assert "instagram.com/oauth/authorize" in url

    qs = parse_qs(urlparse(url).query)

    # client_id MUST be the Instagram App ID (NOT the Facebook App ID).
    # Meta's OAuth endpoint rejects the FB app ID with "Invalid platform app",
    # which is the regression this assertion guards against.
    assert qs["client_id"][0] == settings.INSTAGRAM_APP_ID
    if settings.META_APP_ID and settings.META_APP_ID != settings.INSTAGRAM_APP_ID:
        assert qs["client_id"][0] != settings.META_APP_ID

    # State must be a single-purpose JWT identifying the requesting user.
    state = qs["state"][0]
    payload = decode_token(state)
    assert payload is not None
    assert payload["type"] == "oauth_state"
    assert payload["sub"] == str(user.id)


# ── 2. Auth URL requires authentication ────────────────────

def test_instagram_auth_url_no_auth(client):
    resp = client.get("/api/v1/instagram/auth-url")
    assert resp.status_code == 403  # HTTPBearer missing


# ── 3. Sync triggers Celery task ───────────────────────────

def test_instagram_sync(client, db, starter_user):
    _, org, token = starter_user
    # seed an account so sync finds something
    account = seed_social_account_with_posts(db, org.id, num_posts=1)

    with patch("app.api.v1.instagram.sync_instagram_posts") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "fake-task-id"
        mock_task.delay.return_value = mock_result

        resp = client.post(
            "/api/v1/instagram/sync",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    tasks = resp.json()["data"]["tasks"]
    assert len(tasks) >= 1
    assert tasks[0]["task_id"] == "fake-task-id"


# ── 4. Disconnect account ──────────────────────────────────

def test_disconnect_account(client, db, starter_user):
    _, org, token = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=0)

    resp = client.delete(
        f"/api/v1/instagram/accounts/{account.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # verify account is deactivated
    db.refresh(account)
    assert account.is_active is False


# ── 5. Disconnect nonexistent account → 404 ────────────────

def test_disconnect_nonexistent_account(client, starter_user):
    _, _, token = starter_user
    resp = client.delete(
        "/api/v1/instagram/accounts/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ── 6. Callback is public (no JWT) and validates state ─────

def test_callback_no_state_redirects_invalid(client):
    """Public endpoint — no auth header — but missing state should redirect with error."""
    resp = client.get(
        "/api/v1/instagram/callback?code=fake_code",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "ig=invalid_state" in resp.headers["location"]


def test_callback_invalid_state_redirects_invalid(client):
    resp = client.get(
        "/api/v1/instagram/callback?code=fake_code&state=not-a-jwt",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "ig=invalid_state" in resp.headers["location"]


def test_callback_user_denied_redirects_denied(client):
    resp = client.get(
        "/api/v1/instagram/callback?error=access_denied",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "ig=denied" in resp.headers["location"]


def test_callback_unknown_user_redirects(client):
    """Valid state JWT but the user_id doesn't exist in DB."""
    state = create_oauth_state_token("00000000-0000-0000-0000-000000000000")
    resp = client.get(
        f"/api/v1/instagram/callback?code=fake_code&state={state}",
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "ig=user_not_found" in resp.headers["location"]


def test_callback_full_flow_connects_account(client, db, starter_user):
    """Happy path: valid state → mocked Meta exchange → social_account row stored → redirect.

    Also captures the outbound POST + GET to Meta and asserts client_secret
    on both legs is the Instagram product's secret (INSTAGRAM_APP_SECRET),
    NOT the Facebook product's (META_APP_SECRET). Guards against the
    regression where the Instagram OAuth flow used the wrong app secret
    and Meta returned the misleading "redirect_uri identical..." error.
    """
    user, org, _ = starter_user
    state = create_oauth_state_token(str(user.id))

    fake_short = MagicMock(status_code=200, json=lambda: {"access_token": "short_tok", "user_id": "9988"})
    fake_long = MagicMock(status_code=200, json=lambda: {"access_token": "long_tok", "expires_in": 5_184_000})
    fake_me = MagicMock(status_code=200, json=lambda: {"id": "9988", "username": "test_handle"})

    captured_post: dict = {}
    captured_long_get_params: dict = {}

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, _url, data=None, **__):
            if data:
                captured_post.update(data)
            return fake_short

        async def get(self, url, params=None, **__):
            if "access_token" in url:
                if params:
                    captured_long_get_params.update(params)
                return fake_long
            return fake_me

    with patch("app.api.v1.instagram.httpx.AsyncClient", FakeAsyncClient):
        resp = client.get(
            f"/api/v1/instagram/callback?code=fake_code&state={state}",
            follow_redirects=False,
        )

    assert resp.status_code == 302
    assert "ig=connected" in resp.headers["location"]

    # Short-token exchange must use the Instagram product credentials —
    # NOT the Facebook product's. Both id AND secret are the IG pair.
    assert captured_post["client_id"] == settings.INSTAGRAM_APP_ID
    assert captured_post["client_secret"] == settings.INSTAGRAM_APP_SECRET
    if settings.META_APP_SECRET and settings.META_APP_SECRET != settings.INSTAGRAM_APP_SECRET:
        assert captured_post["client_secret"] != settings.META_APP_SECRET

    # Long-lived exchange (ig_exchange_token) must use the same IG secret.
    assert captured_long_get_params["client_secret"] == settings.INSTAGRAM_APP_SECRET
    if settings.META_APP_SECRET and settings.META_APP_SECRET != settings.INSTAGRAM_APP_SECRET:
        assert captured_long_get_params["client_secret"] != settings.META_APP_SECRET

    from app.models.social_account import SocialAccount, Platform
    account = db.query(SocialAccount).filter_by(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id="9988",
    ).first()
    assert account is not None
    assert account.username == "test_handle"
    assert account.is_active is True


def test_callback_reconnect_same_ig_keeps_single_row(client, db, starter_user):
    """Connect → reconnect with the SAME Instagram account must update the
    existing row in place, NOT create a duplicate. Guards the invariant in
    instagram.py: Meta's `ig_user_id` is the upsert key, and the second
    callback's lookup must hit the row the first callback created.
    """
    user, org, _ = starter_user
    from app.models.social_account import SocialAccount, Platform

    fake_short = MagicMock(status_code=200, json=lambda: {"access_token": "short_tok", "user_id": "7777"})
    fake_long = MagicMock(status_code=200, json=lambda: {"access_token": "long_tok", "expires_in": 5_184_000})
    fake_me = MagicMock(status_code=200, json=lambda: {"id": "7777", "username": "same_handle"})

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, *_, **__):
            return fake_short

        async def get(self, url, *_, **__):
            return fake_long if "access_token" in url else fake_me

    # First connect — state JWT #1 (nonces are one-time-use)
    state1 = create_oauth_state_token(str(user.id))
    with patch("app.api.v1.instagram.httpx.AsyncClient", FakeAsyncClient):
        resp1 = client.get(
            f"/api/v1/instagram/callback?code=fake_code_1&state={state1}",
            follow_redirects=False,
        )
    assert resp1.status_code == 302
    assert "ig=connected" in resp1.headers["location"]

    # Second connect — state JWT #2, same Meta `ig_user_id` (the user
    # reconnected the same IG account)
    state2 = create_oauth_state_token(str(user.id))
    with patch("app.api.v1.instagram.httpx.AsyncClient", FakeAsyncClient):
        resp2 = client.get(
            f"/api/v1/instagram/callback?code=fake_code_2&state={state2}",
            follow_redirects=False,
        )
    assert resp2.status_code == 302
    assert "ig=connected" in resp2.headers["location"]

    # Exactly ONE row, refreshed by the second callback.
    rows = db.query(SocialAccount).filter_by(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id="7777",
    ).all()
    assert len(rows) == 1, f"expected single row after reconnect, got {len(rows)}"
    assert rows[0].is_active is True


def test_callback_reconnect_different_ig_creates_second_row(client, db, starter_user):
    """Connect IG account A → reconnect with IG account B (same org) must
    create a SECOND row. Multi-account-per-org is a real (Enterprise)
    feature and the callback must not collapse distinct accounts into one.
    """
    user, org, _ = starter_user
    from app.models.social_account import SocialAccount, Platform

    fake_long = MagicMock(status_code=200, json=lambda: {"access_token": "long_tok", "expires_in": 5_184_000})

    def _make_client(ig_user_id: str, username: str):
        fake_short = MagicMock(status_code=200, json=lambda: {"access_token": "short_tok", "user_id": ig_user_id})
        fake_me = MagicMock(status_code=200, json=lambda: {"id": ig_user_id, "username": username})

        class FakeAsyncClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return False

            async def post(self, *_, **__):
                return fake_short

            async def get(self, url, *_, **__):
                return fake_long if "access_token" in url else fake_me

        return FakeAsyncClient

    # Connect account A
    state1 = create_oauth_state_token(str(user.id))
    with patch("app.api.v1.instagram.httpx.AsyncClient", _make_client("1111", "account_a")):
        resp1 = client.get(
            f"/api/v1/instagram/callback?code=fake_code_a&state={state1}",
            follow_redirects=False,
        )
    assert resp1.status_code == 302
    assert "ig=connected" in resp1.headers["location"]

    # Connect account B
    state2 = create_oauth_state_token(str(user.id))
    with patch("app.api.v1.instagram.httpx.AsyncClient", _make_client("2222", "account_b")):
        resp2 = client.get(
            f"/api/v1/instagram/callback?code=fake_code_b&state={state2}",
            follow_redirects=False,
        )
    assert resp2.status_code == 302
    assert "ig=connected" in resp2.headers["location"]

    rows = (
        db.query(SocialAccount)
        .filter_by(organization_id=org.id, platform=Platform.instagram)
        .order_by(SocialAccount.connected_at.asc())
        .all()
    )
    ids = {r.platform_account_id for r in rows}
    assert "1111" in ids and "2222" in ids, f"expected both accounts present, got {ids}"
    assert len([r for r in rows if r.platform_account_id in {"1111", "2222"}]) == 2


def test_sync_without_account_returns_400(client, starter_user):
    """No connected IG account → /sync must refuse with a clear 400.

    Previously this path silently bootstrapped a placeholder `social_account`
    row from INSTAGRAM_TEST_TOKEN, which produced the same class of
    stale-platform-account-id duplicate that bit us in prod on 2026-05-11.
    The single source of truth for `social_account` rows is the OAuth
    callback; /sync must fail cleanly when there's nothing to sync.
    """
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/instagram/sync",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "Connect" in detail and "Instagram" in detail


def test_callback_state_replay_rejected(client, starter_user):
    """A previously-consumed state JWT must NOT be replayable, even within its TTL."""
    user, _, _ = starter_user
    state = create_oauth_state_token(str(user.id))

    fake_short = MagicMock(status_code=200, json=lambda: {"access_token": "short_tok", "user_id": "5566"})
    fake_long = MagicMock(status_code=200, json=lambda: {"access_token": "long_tok", "expires_in": 5_184_000})
    fake_me = MagicMock(status_code=200, json=lambda: {"id": "5566", "username": "replay_handle"})

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, *_, **__):
            return fake_short

        async def get(self, url, *_, **__):
            return fake_long if "access_token" in url else fake_me

    with patch("app.api.v1.instagram.httpx.AsyncClient", FakeAsyncClient):
        first = client.get(
            f"/api/v1/instagram/callback?code=fake_code&state={state}",
            follow_redirects=False,
        )
        second = client.get(
            f"/api/v1/instagram/callback?code=fake_code&state={state}",
            follow_redirects=False,
        )

    assert first.status_code == 302
    assert "ig=connected" in first.headers["location"]
    # Second use of the same JWT must fail nonce consumption.
    assert second.status_code == 302
    assert "ig=invalid_state" in second.headers["location"]


# ── 7. Carousel: album-level insights + children structure ──


def test_fetch_insights_for_album_succeeds():
    """Album-level /insights returns reach/views/saved/shares for CAROUSEL_ALBUM.

    Per-child insights are NOT supported by Instagram (always 400), so we rely
    on the album-level call exclusively.
    """
    client = _mock_client([
        _ok_resp({"data": [
            {"name": "reach", "values": [{"value": 15}]},
            {"name": "saved", "values": [{"value": 0}]},
            {"name": "shares", "values": [{"value": 0}]},
            {"name": "views", "values": [{"value": 105}]},
        ]}),
    ])
    out = _fetch_insights_for_media(client, "album_1", "CAROUSEL_ALBUM", "tok")
    assert out == {"reach": 15, "impressions": 105, "shares": 0, "saves": 0}


def test_fetch_insights_for_album_degrades_on_403():
    """Missing scope / unsupported metric → zero dict, no raise."""
    client = _mock_client([_err_resp(403, "no permission")])
    out = _fetch_insights_for_media(client, "album_1", "CAROUSEL_ALBUM", "tok")
    assert out == {"reach": 0, "impressions": 0, "shares": 0, "saves": 0}


def test_fetch_carousel_children_returns_list_on_success():
    """Happy path: /children returns a list of {id, media_type} per slide."""
    client = _mock_client([
        _ok_resp({"data": [
            {"id": "child_1", "media_type": "IMAGE"},
            {"id": "child_2", "media_type": "VIDEO"},
            {"id": "child_3", "media_type": "IMAGE"},
        ]}),
    ])
    children = _fetch_carousel_children(client, "album_1", "tok")
    assert children == [
        {"id": "child_1", "media_type": "IMAGE"},
        {"id": "child_2", "media_type": "VIDEO"},
        {"id": "child_3", "media_type": "IMAGE"},
    ]
    # slide_count derived in the caller — verify the array is a count source
    assert len(children) == 3


def test_fetch_carousel_children_returns_empty_on_403():
    """Missing scope / forbidden: degrade to [] without raising."""
    client = _mock_client([_err_resp(403, "no permission")])
    assert _fetch_carousel_children(client, "album_1", "tok") == []


def test_fetch_carousel_children_returns_empty_on_empty_data():
    """Album with no children (shouldn't happen, but) returns []."""
    client = _mock_client([_ok_resp({"data": []})])
    assert _fetch_carousel_children(client, "album_1", "tok") == []
