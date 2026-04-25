"""Recommendation feedback endpoint tests."""
from tests.conftest import seed_social_account_with_posts
from app.models.recommendation_feedback import RecommendationFeedback


def _cleanup(db, org_id):
    db.query(RecommendationFeedback).filter(
        RecommendationFeedback.organization_id == org_id,
    ).delete()
    db.commit()


# ── 1. Submit helpful → stored ────────────────────────────────

def test_submit_helpful(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    resp = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": "Post more videos", "feedback": "helpful"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["feedback"] == "helpful"

    # Listing returns it
    lst = client.get(
        "/api/v1/analytics/insights/feedback",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert lst.status_code == 200
    entries = lst.json()["data"]["feedback"]
    assert len(entries) == 1
    assert entries[0]["feedback"] == "helpful"
    assert entries[0]["recommendation_text"] == "Post more videos"
    _cleanup(db, org.id)


# ── 2. Submit not_helpful → stored ────────────────────────────

def test_submit_not_helpful(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    resp = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": "Useless tip", "feedback": "not_helpful"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["feedback"] == "not_helpful"
    _cleanup(db, org.id)


# ── 3. Change vote → updated, not duplicated ──────────────────

def test_change_vote_is_upsert(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    text = "Post more videos"
    r1 = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": text, "feedback": "helpful"},
        headers={"Authorization": f"Bearer {token}"},
    )
    first_id = r1.json()["data"]["id"]

    r2 = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": text, "feedback": "not_helpful"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["id"] == first_id
    assert r2.json()["data"]["feedback"] == "not_helpful"

    # Only one row exists
    count = db.query(RecommendationFeedback).filter(
        RecommendationFeedback.organization_id == org.id,
    ).count()
    assert count == 1
    _cleanup(db, org.id)


# ── 4. Unauthenticated → 403 ───────────────────────────────────

def test_feedback_unauthenticated(client):
    resp = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": "x", "feedback": "helpful"},
    )
    assert resp.status_code == 403


# ── 5. No account connected → 400 ──────────────────────────────

def test_feedback_no_account(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": "x", "feedback": "helpful"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# ── 6. Invalid feedback value → 422 ────────────────────────────

def test_feedback_invalid_value(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)
    resp = client.post(
        "/api/v1/analytics/insights/feedback",
        json={"recommendation_text": "x", "feedback": "meh"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
    _cleanup(db, org.id)
