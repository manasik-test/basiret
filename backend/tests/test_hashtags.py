"""Hashtag intelligence endpoint tests."""
from datetime import datetime, timedelta, timezone

from app.models.post import Post, ContentType, LanguageCode
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform


def _make_account_with_posts(db, org_id, posts_spec):
    """Create an IG account + posts with given (caption, content_type, likes, comments, days_ago).

    Returns the social_account.
    """
    import uuid as _u
    uid = _u.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org_id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"hashtest_{uid}",
        access_token_encrypted="encrypted",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
        is_active=True,
    )
    db.add(account)
    db.flush()

    for i, (caption, ct, likes, comments, days_ago) in enumerate(posts_spec):
        p = Post(
            social_account_id=account.id,
            platform_post_id=f"htp_{uid}_{i}",
            platform="instagram",
            content_type=ct,
            language=LanguageCode.en,
            caption=caption,
            posted_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        )
        db.add(p)
        db.flush()
        db.add(EngagementMetric(
            post_id=p.id, likes=likes, comments=comments,
            shares=0, saves=0, reach=0, impressions=0, engagement_rate=0.0,
        ))

    db.commit()
    db.refresh(account)
    return account


# ── 1. Happy path: correctly sorts by avg_engagement DESC ─────

def test_hashtags_sorted_by_avg_engagement(client, db, starter_user):
    _, org, token = starter_user
    _make_account_with_posts(db, org.id, [
        # Two posts with #sale → avg 15
        ("Big #sale today!", ContentType.image, 10, 5, 1),
        ("Another #sale post", ContentType.image, 20, 0, 2),
        # Two posts with #coffee → avg 50
        ("Morning #coffee", ContentType.image, 40, 10, 1),
        ("Best #coffee beans", ContentType.image, 50, 0, 2),
    ])

    resp = client.get(
        "/api/v1/analytics/hashtags",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    tags = data["hashtags"]
    assert len(tags) == 2
    # coffee (avg 50) should rank above sale (avg 17.5)
    assert tags[0]["hashtag"] == "coffee"
    assert tags[1]["hashtag"] == "sale"
    assert tags[0]["avg_engagement"] > tags[1]["avg_engagement"]


# ── 2. Baseline delta is correct ──────────────────────────────

def test_hashtags_baseline_delta(client, db, starter_user):
    _, org, token = starter_user
    # 4 posts: baseline = (15 + 20 + 50 + 50) / 4 = 33.75
    _make_account_with_posts(db, org.id, [
        ("Big #sale today!", ContentType.image, 10, 5, 1),   # eng 15
        ("Another #sale post", ContentType.image, 20, 0, 2),  # eng 20
        ("Morning #coffee", ContentType.image, 40, 10, 1),    # eng 50
        ("Best #coffee beans", ContentType.image, 50, 0, 2),  # eng 50
    ])

    resp = client.get(
        "/api/v1/analytics/hashtags",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = resp.json()["data"]
    assert data["account_baseline_avg"] == 33.75
    coffee = next(t for t in data["hashtags"] if t["hashtag"] == "coffee")
    sale = next(t for t in data["hashtags"] if t["hashtag"] == "sale")
    # coffee: avg 50, delta +16.25
    assert coffee["avg_engagement_delta"] == 16.25
    # sale: avg 17.5, delta -16.25
    assert sale["avg_engagement_delta"] == -16.25


# ── 3. Minimum 2 uses filter ──────────────────────────────────

def test_hashtags_filter_single_use(client, db, starter_user):
    _, org, token = starter_user
    _make_account_with_posts(db, org.id, [
        # #oneshot only appears once → excluded
        ("Trying #oneshot today", ContentType.image, 100, 100, 1),
        # #regular appears twice → included
        ("Hello #regular world", ContentType.image, 10, 5, 2),
        ("Another #regular post", ContentType.image, 15, 5, 3),
    ])

    resp = client.get(
        "/api/v1/analytics/hashtags",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = resp.json()["data"]
    tags = [t["hashtag"] for t in data["hashtags"]]
    assert "oneshot" not in tags
    assert "regular" in tags


# ── 4. Empty account returns empty array, not error ───────────

def test_hashtags_empty_account(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/analytics/hashtags",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["hashtags"] == []
    assert data["account_baseline_avg"] == 0.0
    assert data["total_posts_analyzed"] == 0


# ── 5. Unauth → 403 (HTTPBearer without creds returns 403 in this repo) ─

def test_hashtags_unauthenticated(client):
    resp = client.get("/api/v1/analytics/hashtags")
    assert resp.status_code == 403
