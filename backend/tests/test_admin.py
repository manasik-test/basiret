"""
Admin endpoint tests — system_admin only.
"""
from tests.conftest import ensure_feature_flag


# ── 1. List users (system_admin) ────────────────────────────

def test_admin_list_users(client, system_admin_user):
    _, _, token = system_admin_user
    resp = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "users" in data
    assert isinstance(data["users"], list)
    assert len(data["users"]) >= 1  # at least the admin user itself


# ── 2. Update user role ─────────────────────────────────────

def test_admin_update_user_role(client, db, system_admin_user, starter_user):
    admin_user, _, admin_token = system_admin_user
    target_user, _, _ = starter_user

    resp = client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        json={"role": "manager"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["role"] == "manager"


# ── 3. Update user with invalid role → 400 ──────────────────

def test_admin_update_user_invalid_role(client, system_admin_user, starter_user):
    _, _, admin_token = system_admin_user
    target_user, _, _ = starter_user

    resp = client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        json={"role": "superuser"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "invalid role" in resp.json()["detail"].lower()


# ── 4. Deactivate user ──────────────────────────────────────

def test_admin_deactivate_user(client, db, system_admin_user, starter_user):
    _, _, admin_token = system_admin_user
    target_user, _, _ = starter_user

    resp = client.patch(
        f"/api/v1/admin/users/{target_user.id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False


# ── 5. List organizations ───────────────────────────────────

def test_admin_list_orgs(client, system_admin_user):
    _, _, token = system_admin_user
    resp = client.get(
        "/api/v1/admin/orgs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "organizations" in data
    assert len(data["organizations"]) >= 1


# ── 6. List feature flags ───────────────────────────────────

def test_admin_list_flags(client, db, system_admin_user):
    _, _, token = system_admin_user
    # ensure at least one flag exists
    ensure_feature_flag(db, "starter", "sentiment_analysis", False)

    resp = client.get(
        "/api/v1/admin/flags",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    flags = resp.json()["data"]["flags"]
    assert len(flags) >= 1


# ── 7. Toggle feature flag ──────────────────────────────────

def test_admin_toggle_flag(client, db, system_admin_user):
    _, _, token = system_admin_user
    flag = ensure_feature_flag(db, "starter", "test_feature", False)

    resp = client.patch(
        f"/api/v1/admin/flags/{flag.id}",
        json={"is_enabled": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["is_enabled"] is True
