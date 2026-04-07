"""
Analytics endpoint tests — overview, accounts list, sentiment, segments with seeded data.
"""
from unittest.mock import patch, MagicMock
from tests.conftest import (
    seed_social_account_with_posts,
    seed_analysis_results,
    ensure_feature_flag,
)


# ── 1. Overview with no data ───────────────────────────────

def test_overview_empty(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_posts"] == 0
    assert data["connected_accounts"] == 0


# ── 2. Overview with seeded data ────────────────────────────

def test_overview_with_data(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=3)

    resp = client.get(
        "/api/v1/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_posts"] == 3
    assert data["total_likes"] > 0
    assert data["connected_accounts"] == 1


# ── 3. Accounts list ───────────────────────────────────────

def test_accounts_list(client, db, starter_user):
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=1)

    resp = client.get(
        "/api/v1/analytics/accounts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    accounts = resp.json()["data"]["accounts"]
    assert len(accounts) >= 1
    assert accounts[0]["platform"] == "instagram"


# ── 4. Trigger analysis (Celery task mocked) ───────────────

def test_trigger_analysis(client, starter_user):
    _, _, token = starter_user
    with patch("app.api.v1.analytics.analyze_posts") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "analysis-task-id"
        mock_task.delay.return_value = mock_result

        resp = client.post(
            "/api/v1/analytics/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["task_id"] == "analysis-task-id"
    assert resp.json()["data"]["status"] == "queued"


# ── 5. Segments endpoint with data (insights tier) ─────────

def test_segments_with_data(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "audience_segmentation", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=5)

    # segments endpoint returns empty when no segments generated yet
    resp = client.get(
        "/api/v1/analytics/segments",
        params={"social_account_id": str(account.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["segment_count"] == 0
    assert data["social_account_id"] == str(account.id)


# ── 6. Regenerate segments triggers Celery task ─────────────

def test_regenerate_segments(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "audience_segmentation", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=3)

    with patch("app.api.v1.analytics.segment_audience") as mock_task:
        mock_result = MagicMock()
        mock_result.id = "segment-task-id"
        mock_task.delay.return_value = mock_result

        resp = client.post(
            "/api/v1/analytics/segments/regenerate",
            params={"social_account_id": str(account.id)},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["task_id"] == "segment-task-id"
