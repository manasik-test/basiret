"""Tests for PATCH /auth/profile and POST /auth/change-password."""


# ── 1. Update name → /auth/me reflects the change ────────────

def test_update_profile_name(client, starter_user):
    _, _, token = starter_user
    resp = client.patch(
        "/api/v1/auth/profile",
        json={"full_name": "Updated Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["full_name"] == "Updated Name"

    # GET /me returns the new name
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.json()["data"]["full_name"] == "Updated Name"


# ── 2. Change password: old rejected, new accepted ───────────

def test_change_password_success(client, starter_user):
    user, _, token = starter_user
    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "TestPass123!", "new_password": "NewPass456!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Old password no longer works
    resp_old = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "TestPass123!"},
    )
    assert resp_old.status_code == 401

    # New password works
    resp_new = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "NewPass456!"},
    )
    assert resp_new.status_code == 200


# ── 3. Wrong current password → 400 ──────────────────────────

def test_change_password_wrong_current(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword", "new_password": "NewPass456!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


# ── 4. New password too short → 422 ──────────────────────────

def test_change_password_too_short(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "TestPass123!", "new_password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


# ── 5. Unauthenticated → 403 (HTTPBearer returns 403 without creds) ─

def test_update_profile_unauthenticated(client):
    resp = client.patch("/api/v1/auth/profile", json={"full_name": "Hacker"})
    assert resp.status_code == 403


def test_change_password_unauthenticated(client):
    resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "x", "new_password": "xxxxxxxx"},
    )
    assert resp.status_code == 403


# ── 6. full_name too short → 422 ─────────────────────────────

def test_update_profile_name_too_short(client, starter_user):
    _, _, token = starter_user
    resp = client.patch(
        "/api/v1/auth/profile",
        json={"full_name": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
