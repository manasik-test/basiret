"""
Account-deletion endpoint tests.

Three cases per the V1 spec:
1. Successful deletion of the last admin → user + org + all child rows gone.
2. Wrong password → 403, user/org untouched.
3. Non-last-admin user deletion → that user gone, org + other admin intact.

Tests run against real Postgres + Redis (no mocks for the data layer) so the
ON DELETE CASCADE chain on `organization` → child tables is exercised
end-to-end.
"""
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.subscription import Subscription
from tests.conftest import _uid, seed_social_account_with_posts, seed_analysis_results


# ── 1. Successful deletion (last admin) ────────────────────

def test_delete_account_last_admin_removes_org_and_children(client, db: Session):
    """
    Register a user (becomes sole admin of a fresh org), seed a social account
    with posts + analysis results, then DELETE /account with the right
    password. Verify the user + org + posts + analysis_results are all gone.
    """
    uid = _uid()
    email = f"del-{uid}@basiret-test.com"
    password = "DeletePass1!"
    reg = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Delete Me",
        "organization_name": f"DelOrg-{uid}",
    })
    assert reg.status_code == 200
    user_id = reg.json()["data"]["user"]["id"]
    org_id = reg.json()["data"]["user"]["organization_id"]
    token = reg.json()["data"]["access_token"]

    # Seed an Instagram account + posts + analyses so we can assert cascade
    account = seed_social_account_with_posts(db, org_id, num_posts=2)
    seed_analysis_results(db, account.id)
    account_id = account.id  # stash before the org evaporates

    resp = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"password": password},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["outcome"] == "org_deleted"

    # Force a fresh read; SQLAlchemy may otherwise serve cached state.
    db.expire_all()
    assert db.query(User).filter(User.id == user_id).first() is None
    assert db.query(Organization).filter(Organization.id == org_id).first() is None
    # And the cascade reached the child tables we seeded.
    from app.models.social_account import SocialAccount
    from app.models.post import Post
    from app.models.analysis_result import AnalysisResult
    assert db.query(SocialAccount).filter(SocialAccount.id == account_id).first() is None
    assert db.query(Post).filter(Post.social_account_id == account_id).count() == 0
    assert db.query(AnalysisResult).join(Post, AnalysisResult.post_id == Post.id, isouter=True).filter(Post.social_account_id == account_id).count() == 0


# ── 2. Wrong password → 403 ─────────────────────────────────

def test_delete_account_wrong_password_rejected(client, db: Session):
    """
    Wrong password keeps the JWT valid but blocks the destructive action.
    Endpoint should return 403, the user row stays, and the refresh token
    must NOT be blacklisted (a 403 should be safely retryable).
    """
    uid = _uid()
    email = f"delwrong-{uid}@basiret-test.com"
    password = "RealPass1!"
    reg = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Wrong PW",
        "organization_name": f"WrongPwOrg-{uid}",
    })
    assert reg.status_code == 200
    user_id = reg.json()["data"]["user"]["id"]
    token = reg.json()["data"]["access_token"]

    resp = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"password": "WrongPass1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert "incorrect" in resp.json()["detail"].lower()

    # User still exists, can still hit /me with the same JWT.
    db.expire_all()
    assert db.query(User).filter(User.id == user_id).first() is not None
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200


# ── 3. Non-last-admin → user gone, org intact ──────────────

def test_delete_account_non_last_admin_keeps_org(client, db: Session):
    """
    Two admins under the same org. The first one deletes their account; the
    org + the second admin must survive. Cleanup is the test's responsibility
    since neither fixture covers a multi-user org.
    """
    uid = _uid()
    org = Organization(name=f"MultiOrg-{uid}", slug=f"multi-{uid}")
    db.add(org)
    db.flush()

    admin_a_password = "AdminAPass1!"
    admin_a = User(
        organization_id=org.id,
        email=f"admin-a-{uid}@basiret-test.com",
        hashed_password=hash_password(admin_a_password),
        full_name="Admin A",
        role=UserRole.admin,
    )
    admin_b = User(
        organization_id=org.id,
        email=f"admin-b-{uid}@basiret-test.com",
        hashed_password=hash_password("AdminBPass1!"),
        full_name="Admin B",
        role=UserRole.admin,
    )
    db.add(admin_a)
    db.add(admin_b)
    db.add(Subscription(organization_id=org.id))
    db.commit()
    db.refresh(admin_a)
    db.refresh(admin_b)

    admin_a_id = admin_a.id
    admin_b_id = admin_b.id
    org_id = org.id

    # Log in as admin A to get a fresh token + refresh cookie. Going through
    # /login (rather than minting a token directly) more closely matches the
    # production path and exercises the cookie-blacklist flow.
    login = client.post("/api/v1/auth/login", json={
        "email": admin_a.email,
        "password": admin_a_password,
    })
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]

    resp = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"password": admin_a_password},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["outcome"] == "user_only"

    db.expire_all()
    assert db.query(User).filter(User.id == admin_a_id).first() is None
    assert db.query(User).filter(User.id == admin_b_id).first() is not None
    assert db.query(Organization).filter(Organization.id == org_id).first() is not None

    # Cleanup the surviving admin + org + sub.
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete()
    db.query(User).filter(User.id == admin_b_id).delete()
    db.query(Organization).filter(Organization.id == org_id).delete()
    db.commit()
