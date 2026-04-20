"""
Instagram endpoint tests — auth URL, sync trigger, account disconnect.
"""
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch, MagicMock

from app.core.security import decode_token, create_oauth_state_token
from tests.conftest import seed_social_account_with_posts


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

    # State must be a single-purpose JWT identifying the requesting user.
    qs = parse_qs(urlparse(url).query)
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
    """Happy path: valid state → mocked Meta exchange → social_account row stored → redirect."""
    user, org, _ = starter_user
    state = create_oauth_state_token(str(user.id))

    fake_short = MagicMock(status_code=200, json=lambda: {"access_token": "short_tok", "user_id": "9988"})
    fake_long = MagicMock(status_code=200, json=lambda: {"access_token": "long_tok", "expires_in": 5_184_000})
    fake_me = MagicMock(status_code=200, json=lambda: {"id": "9988", "username": "test_handle"})

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
        resp = client.get(
            f"/api/v1/instagram/callback?code=fake_code&state={state}",
            follow_redirects=False,
        )

    assert resp.status_code == 302
    assert "ig=connected" in resp.headers["location"]

    from app.models.social_account import SocialAccount, Platform
    account = db.query(SocialAccount).filter_by(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id="9988",
    ).first()
    assert account is not None
    assert account.username == "test_handle"
    assert account.is_active is True
