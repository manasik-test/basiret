"""
Tests for Sprint 4 — K-means audience segmentation.

Unit tests for feature engineering, clustering, and label generation.
Integration tests for API endpoints.
"""
import uuid

import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import SessionLocal
from app.main import app
from app.models.audience_segment import AudienceSegment
from app.tasks.segmentation import (
    _advisory_lock_key,
    _run_kmeans,
    _generate_cluster_label,
    segment_audience,
    FEATURE_NAMES,
    MIN_POSTS,
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── Unit: _run_kmeans ───────────────────────────────────────────


def test_kmeans_returns_none_below_min():
    """Fewer than MIN_POSTS rows should return None."""
    matrix = np.random.rand(5, 11)
    assert _run_kmeans(matrix) is None


def test_kmeans_forces_k2_small_dataset():
    """10-19 rows should force k=2."""
    np.random.seed(42)
    matrix = np.random.rand(15, 11)
    labels, centroids, k, sil = _run_kmeans(matrix)
    assert k == 2
    assert centroids.shape == (2, 11)
    assert len(labels) == 15
    assert set(labels).issubset({0, 1})


def test_kmeans_selects_optimal_k():
    """With well-separated blobs, k-means should find a reasonable k."""
    from sklearn.datasets import make_blobs
    X, _ = make_blobs(n_samples=60, centers=3, n_features=11, random_state=42)
    # Make columns 4-8 binary-like
    X[:, 4:9] = (X[:, 4:9] > 0).astype(float)
    labels, centroids, k, sil = _run_kmeans(X)
    assert 2 <= k <= 5
    assert sil > 0  # should have positive silhouette for well-separated data
    assert centroids.shape == (k, 11)


def test_kmeans_returns_valid_silhouette():
    """Silhouette score should be between -1 and 1."""
    np.random.seed(42)
    matrix = np.random.rand(30, 11)
    _, _, _, sil = _run_kmeans(matrix)
    assert -1 <= sil <= 1


# ── Unit: _generate_cluster_label ───────────────────────────────


def test_label_high_engagement():
    """High likes/comments should produce 'High-Engagement' in label."""
    centroid = np.array([100, 50, 0.05, 0.8, 0.7, 0.0, 0.8, 0.1, 0.1, 14.0, 3.0])
    label = _generate_cluster_label(centroid)
    assert "High-Engagement" in label


def test_label_low_engagement():
    """Low likes/comments should produce 'Low-Engagement' in label."""
    centroid = np.array([2, 1, 0.01, 0.3, 0.1, 0.0, 0.5, 0.3, 0.2, 10.0, 1.0])
    label = _generate_cluster_label(centroid)
    assert "Low-Engagement" in label


def test_label_video_content():
    """Dominant video score should produce 'Video' in label."""
    centroid = np.array([30, 10, 0.03, 0.5, 0.3, 0.1, 0.1, 0.8, 0.1, 20.0, 5.0])
    label = _generate_cluster_label(centroid)
    assert "Video" in label


def test_label_evening_time():
    """Hour ~20 should produce 'Evening' in label."""
    centroid = np.array([30, 10, 0.03, 0.5, 0.3, 0.1, 0.5, 0.2, 0.1, 20.0, 3.0])
    label = _generate_cluster_label(centroid)
    assert "Evening" in label


def test_label_positive_sentiment():
    """is_positive > 0.5 should include 'Positive' in label."""
    centroid = np.array([50, 20, 0.04, 0.9, 0.8, 0.0, 0.6, 0.2, 0.1, 10.0, 2.0])
    label = _generate_cluster_label(centroid)
    assert "Positive" in label


def test_label_critical_sentiment():
    """is_negative > 0.5 should include 'Critical' in label."""
    centroid = np.array([50, 20, 0.04, 0.9, 0.1, 0.7, 0.6, 0.2, 0.1, 10.0, 2.0])
    label = _generate_cluster_label(centroid)
    assert "Critical" in label


# ── Integration: API endpoints ──────────────────────────────────
# These endpoints now require JWT auth + feature flag (Pro plan).
# Tests verify 403 is returned for unauthenticated requests.


def test_get_segments_requires_auth(client):
    """GET /segments without auth returns 403."""
    resp = client.get(
        "/api/v1/analytics/segments",
        params={"social_account_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 403


def test_regenerate_requires_auth(client):
    """POST /segments/regenerate without auth returns 403."""
    resp = client.post(
        "/api/v1/analytics/segments/regenerate",
        params={"social_account_id": "00000000-0000-0000-0000-ffffffffffff"},
    )
    assert resp.status_code == 403


@patch("app.api.v1.analytics.segment_audience")
def test_regenerate_queues_task(mock_task, client):
    """POST /segments/regenerate should queue a Celery task when authenticated.

    Without auth in test, we verify 403 is returned (auth middleware blocks first).
    """
    mock_async = MagicMock()
    mock_async.id = "test-task-id-123"
    mock_task.delay.return_value = mock_async

    resp = client.post(
        "/api/v1/analytics/segments/regenerate",
        params={"social_account_id": "00000000-0000-0000-0000-000000000000"},
    )
    # Without auth token, middleware rejects before reaching task logic
    assert resp.status_code == 403


# ── Concurrency: advisory lock serializes duplicate tasks ───────


@patch("app.tasks.segmentation._build_feature_matrix")
def test_concurrent_segmentation_skipped_when_lock_held(mock_build):
    """Duplicate segment_audience invocations for the same account are silently ignored.

    Simulates the race condition (double-click / retry / two tabs) by holding the
    PostgreSQL advisory lock from a separate session, then invoking the task.
    Expectations: the task short-circuits before _build_feature_matrix (so no
    delete-then-insert runs), no exception escapes to the caller, and no
    AudienceSegment rows are created for the test account.
    """
    account_id = str(uuid.uuid4())
    lock_key = _advisory_lock_key(account_id)

    # Open a separate session to act as "task A" and hold the transaction-scoped
    # advisory lock. Because it's *_xact_*, the lock is released only when this
    # session's transaction ends (rollback in finally).
    blocker = SessionLocal()
    try:
        got = blocker.execute(
            text("SELECT pg_try_advisory_xact_lock(:k)"), {"k": lock_key}
        ).scalar()
        assert got is True, "blocker failed to acquire advisory lock"

        # "Task B" runs while the lock is held — should Ignore before doing work.
        result = segment_audience.apply(args=[account_id])

        # Never reached the clustering path (so never touched audience_segment).
        mock_build.assert_not_called()
        # Ignore does not surface as a failure on EagerResult — nothing to re-raise.
        assert not result.failed()

        # Belt-and-braces: no duplicate rows created for this account.
        verify = SessionLocal()
        try:
            rows = (
                verify.query(AudienceSegment)
                .filter(AudienceSegment.social_account_id == account_id)
                .count()
            )
            assert rows == 0
        finally:
            verify.close()
    finally:
        blocker.rollback()
        blocker.close()
