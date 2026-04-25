"""Goals endpoint tests — create/list/delete + current_value computation + caps."""
from datetime import datetime, timedelta, timezone

from tests.conftest import seed_social_account_with_posts
from app.models.goal import Goal
from app.models.post import Post, ContentType, LanguageCode
from app.models.analysis_result import AnalysisResult
from app.models.comment import Comment
from app.models.social_account import SocialAccount, Platform


def _cleanup_goals(db, org_id):
    db.query(Goal).filter(Goal.organization_id == org_id).delete()
    db.commit()


# ── 1. Empty list when no goals yet ──────────────────────────

def test_list_goals_empty_with_account(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    resp = client.get(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["goals"] == []


def test_list_goals_no_account(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["goals"] == []


# ── 2. Create goal and see it in list with current_value ─────

def test_create_goal_appears_in_list(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=2)

    create = client.post(
        "/api/v1/goals",
        json={"metric": "posts_per_week", "target_value": 5, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200
    created = create.json()["data"]
    assert created["metric"] == "posts_per_week"
    assert created["target_value"] == 5
    assert created["current_value"] is not None  # computed from real data

    lst = client.get(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
    )
    goals = lst.json()["data"]["goals"]
    assert len(goals) == 1
    assert goals[0]["id"] == created["id"]
    _cleanup_goals(db, org.id)


# ── 3. Cannot create goal without a connected account ────────

def test_create_goal_no_account(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/goals",
        json={"metric": "posts_per_week", "target_value": 3, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# ── 4. Max 4 active goals enforced ───────────────────────────

def test_create_goal_max_enforced(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    metrics = [
        "avg_engagement_rate", "posts_per_week",
        "positive_sentiment_pct", "follower_growth_pct",
    ]
    for m in metrics:
        r = client.post(
            "/api/v1/goals",
            json={"metric": m, "target_value": 1, "period": "weekly"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200

    # 5th should fail
    r5 = client.post(
        "/api/v1/goals",
        json={"metric": "posts_per_week", "target_value": 10, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r5.status_code == 400
    _cleanup_goals(db, org.id)


# ── 5. Delete goal (soft) — no longer in list ────────────────

def test_delete_goal(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    create = client.post(
        "/api/v1/goals",
        json={"metric": "posts_per_week", "target_value": 3, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    goal_id = create.json()["data"]["id"]

    delete = client.delete(
        f"/api/v1/goals/{goal_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete.status_code == 200

    lst = client.get(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert lst.json()["data"]["goals"] == []
    _cleanup_goals(db, org.id)


# ── 6. Delete other-org goal → 404 ───────────────────────────

def test_delete_cross_org(client, db, starter_user, insights_user):
    _, org_a, token_a = starter_user
    _, _, token_b = insights_user
    seed_social_account_with_posts(db, org_a.id, num_posts=1)

    create = client.post(
        "/api/v1/goals",
        json={"metric": "posts_per_week", "target_value": 3, "period": "weekly"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    goal_id = create.json()["data"]["id"]

    # User B (different org) cannot delete it
    cross = client.delete(
        f"/api/v1/goals/{goal_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cross.status_code == 404
    _cleanup_goals(db, org_a.id)


# ── 7. current_value for positive_sentiment_pct ──────────────

def test_current_value_positive_sentiment(client, db, starter_user):
    _, org, token = starter_user
    import uuid as _u
    uid = _u.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"senti_{uid}",
        access_token_encrypted="enc",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
    )
    db.add(account); db.flush()

    p = Post(
        social_account_id=account.id,
        platform_post_id=f"p_{uid}_0",
        platform="instagram",
        content_type=ContentType.image,
        language=LanguageCode.en,
        caption="nice",
        posted_at=datetime.now(timezone.utc),
    )
    db.add(p); db.flush()

    # 2 positive, 1 negative → 66.67% positive
    for i, (txt, sentiment) in enumerate([
        ("love", "positive"),
        ("great", "positive"),
        ("bad", "negative"),
    ]):
        c = Comment(
            post_id=p.id,
            platform_comment_id=f"c_{uid}_{i}",
            text=txt,
            author_username="u",
            created_at=datetime.now(timezone.utc),
        )
        db.add(c); db.flush()
        db.add(AnalysisResult(
            comment_id=c.id,
            sentiment=sentiment,
            sentiment_score=0.5,
            topics=[],
            language_detected="en",
            model_used="test",
        ))
    db.commit()

    r = client.post(
        "/api/v1/goals",
        json={"metric": "positive_sentiment_pct", "target_value": 70, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    current = r.json()["data"]["current_value"]
    assert current is not None
    assert 65 <= current <= 67  # ~66.67
    _cleanup_goals(db, org.id)


# ── 8. Follower-growth goal returns None current_value ──────

def test_current_value_follower_growth_null(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)
    r = client.post(
        "/api/v1/goals",
        json={"metric": "follower_growth_pct", "target_value": 10, "period": "monthly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    # Not available from Instagram Basic Display API
    assert r.json()["data"]["current_value"] is None
    _cleanup_goals(db, org.id)


# ── 9. Unauthenticated → 403 (HTTPBearer) ────────────────────

def test_goals_unauthenticated(client):
    assert client.get("/api/v1/goals").status_code == 403
    assert client.post("/api/v1/goals", json={
        "metric": "posts_per_week", "target_value": 1, "period": "weekly",
    }).status_code == 403


# ── 10. Invalid metric → 422 ─────────────────────────────────

def test_create_goal_invalid_metric(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)
    r = client.post(
        "/api/v1/goals",
        json={"metric": "not_a_metric", "target_value": 1, "period": "weekly"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422
