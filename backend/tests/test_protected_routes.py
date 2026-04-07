"""
Protected route enforcement — 401 without token, 401 bad token, 403 wrong role.
"""


# ── 1. No token → 401 on analytics ─────────────────────────

def test_analytics_overview_no_token(client):
    resp = client.get("/api/v1/analytics/overview")
    assert resp.status_code == 403  # HTTPBearer returns 403 when header missing


# ── 2. Invalid token → 401 ─────────────────────────────────

def test_analytics_overview_bad_token(client):
    resp = client.get(
        "/api/v1/analytics/overview",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401


# ── 3. Admin endpoint with non-admin → 403 ─────────────────

def test_admin_users_non_admin(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ── 4. Admin endpoint with viewer → 403 ─────────────────────

def test_admin_users_viewer(client, viewer_user):
    _, _, token = viewer_user
    resp = client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
