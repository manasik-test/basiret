"""
Instagram endpoint tests — auth URL, sync trigger, account disconnect.
"""
from unittest.mock import patch, MagicMock
from tests.conftest import seed_social_account_with_posts


# ── 1. Get Instagram auth URL ──────────────────────────────

def test_instagram_auth_url(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/instagram/auth-url",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "instagram.com/oauth/authorize" in resp.json()["url"]


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
