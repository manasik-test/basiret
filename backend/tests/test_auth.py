"""
Auth endpoint tests — register, login, logout, refresh, duplicate email, wrong password.
Runs against real PostgreSQL + Redis.
"""
from tests.conftest import _uid


# ── 1. Register ─────────────────────────────────────────────

def test_register_success(client):
    uid = _uid()
    resp = client.post("/api/v1/auth/register", json={
        "email": f"reg-{uid}@basiret-test.com",
        "password": "StrongPass1!",
        "full_name": "Reg User",
        "organization_name": f"RegOrg-{uid}",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert body["data"]["user"]["role"] == "admin"
    # refresh cookie should be set
    assert "refresh_token" in resp.cookies


# ── 2. Duplicate email ─────────────────────────────────────

def test_register_duplicate_email(client):
    uid = _uid()
    email = f"dup-{uid}@basiret-test.com"
    payload = {
        "email": email,
        "password": "StrongPass1!",
        "full_name": "Dup User",
        "organization_name": f"DupOrg-{uid}",
    }
    # first registration succeeds
    resp1 = client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 200
    # second registration with same email fails
    payload["organization_name"] = f"DupOrg2-{uid}"
    resp2 = client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 400
    assert "already registered" in resp2.json()["detail"].lower()


# ── 3. Register weak password ──────────────────────────────

def test_register_weak_password(client):
    uid = _uid()
    resp = client.post("/api/v1/auth/register", json={
        "email": f"weak-{uid}@basiret-test.com",
        "password": "short",
        "full_name": "Weak User",
        "organization_name": f"WeakOrg-{uid}",
    })
    assert resp.status_code == 422  # pydantic validation


# ── 4. Login success ────────────────────────────────────────

def test_login_success(client):
    uid = _uid()
    email = f"login-{uid}@basiret-test.com"
    password = "LoginPass1!"
    # register first
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Login User",
        "organization_name": f"LoginOrg-{uid}",
    })
    # now login
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert body["data"]["user"]["email"] == email


# ── 5. Login wrong password ─────────────────────────────────

def test_login_wrong_password(client):
    uid = _uid()
    email = f"wrongpw-{uid}@basiret-test.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "CorrectPass1!",
        "full_name": "Wrong PW User",
        "organization_name": f"WrongOrg-{uid}",
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPass1!"})
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


# ── 6. Login nonexistent email ──────────────────────────────

def test_login_nonexistent_email(client):
    resp = client.post("/api/v1/auth/login", json={
        "email": f"noexist-{_uid()}@basiret-test.com",
        "password": "Whatever1!",
    })
    assert resp.status_code == 401


# ── 7. Refresh token ────────────────────────────────────────

def test_refresh_token(client):
    uid = _uid()
    email = f"refresh-{uid}@basiret-test.com"
    # Register sets the refresh cookie on the session-scoped client
    reg = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "RefreshPass1!",
        "full_name": "Refresh User",
        "organization_name": f"RefreshOrg-{uid}",
    })
    assert reg.status_code == 200
    # The TestClient persists cookies, so /refresh should see the cookie
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "access_token" in body["data"]


# ── 8. Logout ───────────────────────────────────────────────

def test_logout(client):
    uid = _uid()
    email = f"logout-{uid}@basiret-test.com"
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "LogoutPass1!",
        "full_name": "Logout User",
        "organization_name": f"LogoutOrg-{uid}",
    })
    resp = client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # after logout, refresh should fail (token blacklisted / cookie cleared)
    resp2 = client.post("/api/v1/auth/refresh")
    assert resp2.status_code == 401


# ── 9. GET /me with valid token ─────────────────────────────

def test_me_endpoint(client):
    uid = _uid()
    email = f"me-{uid}@basiret-test.com"
    reg = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "MePass1234!",
        "full_name": "Me User",
        "organization_name": f"MeOrg-{uid}",
    })
    assert reg.status_code == 200
    token = reg.json()["data"]["access_token"]
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["email"] == email
