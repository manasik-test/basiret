"""Tests for the Post Creator endpoints + draft-cleanup Celery tasks.

Storage is mocked at the module level rather than via moto — keeps the
test suite hermetic, fast, and independent of any AWS-protocol quirks.
"""
import io
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.scheduled_post import ScheduledPost
from app.tasks.draft_cleanup import cleanup_expired_drafts, warn_expiring_drafts
from tests.conftest import seed_social_account_with_posts


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _png_bytes() -> bytes:
    """Smallest possible PNG payload — header + 1x1 pixel."""
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x00"
        b"\x00\x00\x00:~\x9bU\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00"
        b"\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


# ── Upload endpoint ──────────────────────────────────────────


def test_upload_returns_url(client, insights_user, db):
    """Happy path: PNG upload returns a URL + media_type=image."""
    user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    fake_url = "https://cdn.example/posts/uuid-test.png"
    with patch("app.api.v1.posts_creator.upload_media", return_value=fake_url) as mock_upload:
        files = {"file": ("test.png", _png_bytes(), "image/png")}
        res = client.post(
            "/api/v1/creator/upload", files=files, headers=_auth(token),
        )

    assert res.status_code == 200, res.text
    assert mock_upload.call_count == 1
    body = res.json()["data"]
    assert body["url"] == fake_url
    assert body["media_type"] == "image"
    assert body["filename"] == "test.png"


def test_upload_rejects_invalid_type(client, insights_user):
    """A PDF upload should be refused with 422 before hitting storage."""
    _user, _org, token = insights_user
    files = {"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")}
    res = client.post(
        "/api/v1/creator/upload", files=files, headers=_auth(token),
    )
    assert res.status_code == 422
    assert "Unsupported" in res.json()["detail"]


def test_upload_rejects_oversized(client, insights_user):
    """51 MB file → 413, mocked-out upload should never be called."""
    _user, _org, token = insights_user
    big = b"\x00" * (51 * 1024 * 1024)
    with patch("app.api.v1.posts_creator.upload_media") as mock_upload:
        files = {"file": ("huge.mp4", big, "video/mp4")}
        res = client.post(
            "/api/v1/creator/upload", files=files, headers=_auth(token),
        )
    assert res.status_code == 413
    assert mock_upload.call_count == 0


# ── Post creation ────────────────────────────────────────────


def test_create_post_draft_sets_expiry(client, insights_user, db):
    """`status='draft'` sets draft_expires_at ≈ now + 15 days."""
    _user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    res = client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["https://cdn.example/x.png"],
            "media_type": "image",
            "caption_en": "hello world",
            "ratio": "1:1",
            "status": "draft",
        },
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["status"] == "draft"
    expires = datetime.fromisoformat(data["draft_expires_at"])
    expected = datetime.now(timezone.utc) + timedelta(days=15)
    delta = abs((expires - expected).total_seconds())
    assert delta < 30, f"draft_expires_at off by {delta}s"


def test_create_post_scheduled_requires_scheduled_at(client, insights_user, db):
    """status='scheduled' without scheduled_at → 422."""
    _user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)
    res = client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["https://cdn.example/x.png"],
            "media_type": "image",
            "ratio": "1:1",
            "status": "scheduled",
        },
        headers=_auth(token),
    )
    assert res.status_code == 422


# ── Listing ──────────────────────────────────────────────────


def test_list_posts_filtered_by_status(client, insights_user, db):
    """Seed 1 draft + 1 scheduled, ?status=draft returns 1."""
    _user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    # Draft
    client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["a"], "media_type": "image", "ratio": "1:1",
            "status": "draft",
        },
        headers=_auth(token),
    )
    # Scheduled
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["b"], "media_type": "image", "ratio": "1:1",
            "status": "scheduled", "scheduled_at": future,
        },
        headers=_auth(token),
    )

    res = client.get(
        "/api/v1/creator/posts?status=draft", headers=_auth(token),
    )
    assert res.status_code == 200
    rows = res.json()["data"]
    assert len(rows) == 1
    assert rows[0]["status"] == "draft"


# ── Calendar ─────────────────────────────────────────────────


def test_calendar_groups_by_date(client, insights_user, db):
    """Two scheduled posts on the same date → both appear under one key."""
    _user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)
    target = datetime(2027, 6, 15, 10, 0, tzinfo=timezone.utc)
    body = {
        "media_urls": ["x"], "media_type": "image", "ratio": "1:1",
        "status": "scheduled", "scheduled_at": target.isoformat(),
    }
    client.post("/api/v1/creator/posts", json=body, headers=_auth(token))
    body["scheduled_at"] = target.replace(hour=15).isoformat()
    client.post("/api/v1/creator/posts", json=body, headers=_auth(token))

    res = client.get(
        "/api/v1/creator/calendar?month=2027-06", headers=_auth(token),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "2027-06-15" in data
    assert len(data["2027-06-15"]["posts"]) == 2


# ── Delete ───────────────────────────────────────────────────


def test_delete_post_removes_media(client, insights_user, db):
    """DELETE removes the row + calls delete_media for every URL."""
    _user, org, token = insights_user
    seed_social_account_with_posts(db, org.id)
    res = client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["https://cdn.example/a.png", "https://cdn.example/b.png"],
            "media_type": "carousel", "ratio": "1:1", "status": "draft",
        },
        headers=_auth(token),
    )
    post_id = res.json()["data"]["id"]

    with patch("app.api.v1.posts_creator.delete_media") as mock_del:
        res = client.delete(
            f"/api/v1/creator/posts/{post_id}", headers=_auth(token),
        )
    assert res.status_code == 200
    assert mock_del.call_count == 2

    # Row gone
    res = client.get(f"/api/v1/creator/posts/{post_id}", headers=_auth(token))
    assert res.status_code == 404


# ── Org isolation ────────────────────────────────────────────


def test_org_isolation(client, db):
    """User A creates a post; User B (different org) gets 404 on GET."""
    from tests.conftest import create_test_user
    from app.models.subscription import PlanTier

    user_a, org_a, token_a = create_test_user(db, plan_tier=PlanTier.insights)
    user_b, org_b, token_b = create_test_user(db, plan_tier=PlanTier.insights)
    seed_social_account_with_posts(db, org_a.id)
    seed_social_account_with_posts(db, org_b.id)

    create = client.post(
        "/api/v1/creator/posts",
        json={
            "media_urls": ["x"], "media_type": "image",
            "ratio": "1:1", "status": "draft",
        },
        headers=_auth(token_a),
    )
    post_id = create.json()["data"]["id"]

    # User B can't see it.
    res = client.get(
        f"/api/v1/creator/posts/{post_id}", headers=_auth(token_b),
    )
    assert res.status_code == 404

    # Cleanup — fixtures don't have create_test_user teardown; do it manually
    # to keep the test suite leak-free.
    from app.models.subscription import Subscription
    from app.models.user import User as UserModel
    from app.models.organization import Organization as OrgModel
    db.query(ScheduledPost).filter(
        ScheduledPost.organization_id.in_([org_a.id, org_b.id])
    ).delete(synchronize_session=False)
    for org in (org_a, org_b):
        db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
    for u in (user_a, user_b):
        db.query(UserModel).filter(UserModel.id == u.id).delete()
    for org in (org_a, org_b):
        db.query(OrgModel).filter(OrgModel.id == org.id).delete()
    db.commit()


# ── Cleanup task ─────────────────────────────────────────────


def test_cleanup_expired_drafts_deletes_correct_rows(insights_user, db):
    """Expired draft is deleted; fresh draft survives."""
    _user, org, _token = insights_user
    account = seed_social_account_with_posts(db, org.id)

    expired = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_urls=["https://cdn.example/old.png"],
        media_type="image",
        status="draft",
        draft_expires_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    fresh = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_urls=["https://cdn.example/new.png"],
        media_type="image",
        status="draft",
        draft_expires_at=datetime.now(timezone.utc) + timedelta(days=10),
    )
    db.add_all([expired, fresh])
    db.commit()
    expired_id = expired.id
    fresh_id = fresh.id

    with patch("app.tasks.draft_cleanup.delete_media") as mock_del:
        result = cleanup_expired_drafts()

    assert result == {"deleted": 1}
    assert mock_del.call_count == 1
    db.expire_all()
    assert db.query(ScheduledPost).filter(ScheduledPost.id == expired_id).first() is None
    assert db.query(ScheduledPost).filter(ScheduledPost.id == fresh_id).first() is not None

    # Cleanup the survivor.
    db.query(ScheduledPost).filter(ScheduledPost.id == fresh_id).delete()
    db.commit()


def test_warn_expiring_drafts_finds_correct_rows(insights_user, db):
    """Warn fires for drafts expiring in the 1–3 day window only."""
    _user, org, _token = insights_user
    account = seed_social_account_with_posts(db, org.id)

    in_window = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_type="image",
        status="draft",
        draft_expires_at=datetime.now(timezone.utc) + timedelta(days=2),
    )
    far_future = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_type="image",
        status="draft",
        draft_expires_at=datetime.now(timezone.utc) + timedelta(days=10),
    )
    db.add_all([in_window, far_future])
    db.commit()

    result = warn_expiring_drafts()
    assert result["warned"] == 1

    # Cleanup
    db.query(ScheduledPost).filter(ScheduledPost.id.in_([in_window.id, far_future.id])).delete()
    db.commit()


# Silence the unused-import lint for io / uuid (kept for future test growth).
_ = (io, uuid)
