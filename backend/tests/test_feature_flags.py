"""
Feature flag enforcement — starter tier gets 403, insights tier gets 200.
"""
from tests.conftest import ensure_feature_flag, seed_social_account_with_posts, seed_analysis_results


# ── 1. Starter tier blocked from sentiment (no flag) ────────

def test_starter_blocked_sentiment_no_flag(client, db, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/analytics/sentiment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail["locked"] is True
    assert detail["feature"] == "sentiment_analysis"


# ── 2. Starter tier blocked from segments ───────────────────

def test_starter_blocked_segments(client, db, starter_user):
    _, org, token = starter_user
    resp = client.get(
        "/api/v1/analytics/segments",
        params={"social_account_id": "00000000-0000-0000-0000-000000000000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["locked"] is True


# ── 3. Insights tier can access sentiment ───────────────────

def test_insights_can_access_sentiment(client, db, insights_user):
    _, org, token = insights_user
    # ensure feature flag is enabled for insights tier
    ensure_feature_flag(db, "insights", "sentiment_analysis", True)
    # seed data so the endpoint has something to return
    account = seed_social_account_with_posts(db, org.id, num_posts=3)
    seed_analysis_results(db, account.id)

    resp = client.get(
        "/api/v1/analytics/sentiment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_analyzed" in data
    assert "sentiment" in data
    assert data["total_analyzed"] == 3


# ── 4. Starter blocked even when flag exists but disabled ───

def test_starter_blocked_with_disabled_flag(client, db, starter_user):
    _, _, token = starter_user
    ensure_feature_flag(db, "starter", "sentiment_analysis", False)
    resp = client.get(
        "/api/v1/analytics/sentiment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["locked"] is True
