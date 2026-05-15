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


# ── Phase C: per-language personas (Bug 2, 2026-05-15) ──────────


def _persona_stub(language: str, n: int) -> list:
    """Fake `_generate_persona_descriptions` output — N personas tagged with
    the language so tests can assert the right call went to the right row."""
    return [
        {
            "name": f"Persona-{language}-{i}",
            "tagline": f"Tagline {language} {i}",
            "description": f"Description in {language} for cluster {i}",
        }
        for i in range(n)
    ]


@patch("app.tasks.segmentation._generate_persona_descriptions")
@patch("app.tasks.segmentation._compute_segment_extras")
def test_save_segments_writes_one_row_per_cluster_per_language(
    mock_extras, mock_personas
):
    """_save_segments now persists 2× rows per cluster — one for EN persona
    prose and one for AR. The unique constraint
    (account_id, cluster_id, language) enforces no duplicates."""
    from app.tasks.segmentation import _save_segments, _LANGUAGES

    mock_extras.return_value = {
        "content_type_breakdown": {"video": 1, "image": 0, "carousel": 0},
        "top_topics": [],
        "best_day_hour": None,
    }

    # Return persona stubs that vary by language so we can verify the right
    # text landed in the right row.
    mock_personas.side_effect = lambda *args, **kwargs: _persona_stub(
        kwargs.get("language", "en"), len(args[0]),
    )

    # Seed a social account so the FK on audience_segment.social_account_id
    # actually resolves.
    from app.models.organization import Organization as _Org
    from app.models.social_account import SocialAccount as _SA, Platform as _Platform
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz

    db = SessionLocal()
    try:
        slug = f"test-org-{uuid.uuid4().hex[:8]}"
        org = _Org(name=slug, slug=slug)
        db.add(org)
        db.flush()
        sa = _SA(
            organization_id=org.id,
            platform=_Platform.instagram,
            platform_account_id=f"ig_{uuid.uuid4().hex[:8]}",
            username=f"u_{uuid.uuid4().hex[:8]}",
            access_token_encrypted="fake",
            token_expires_at=_dt.now(_tz.utc) + _td(days=30),
            is_active=True,
        )
        db.add(sa)
        db.commit()
        account_id = sa.id

        # Two clusters, two posts each — minimum that exercises the loop.
        labels = [0, 0, 1, 1]
        # _save_segments stores post_ids verbatim in characteristics JSONB —
        # use strings so the JSON encoder doesn't choke on UUID objects.
        post_ids = [str(uuid.uuid4()) for _ in range(4)]
        centroids = np.array([
            [10, 2, 0.05, 0.5, 0.5, 0.0, 1.0, 0.0, 0.0, 14.0, 3.0],
            [20, 5, 0.10, 0.7, 0.7, 0.0, 0.0, 1.0, 0.0, 18.0, 5.0],
        ])

        _save_segments(db, account_id, labels, centroids, post_ids, k=2, silhouette=0.42)

        rows = (
            db.query(AudienceSegment)
            .filter(AudienceSegment.social_account_id == account_id)
            .all()
        )
        # 2 clusters × 2 languages = 4 rows total
        assert len(rows) == 2 * len(_LANGUAGES)

        langs_present = {r.language for r in rows}
        assert langs_present == {"en", "ar"}

        # Each (cluster_id, language) is unique
        pairs = {(r.cluster_id, r.language) for r in rows}
        assert len(pairs) == 4

        # Persona prose actually got plumbed through with the right language
        en_descriptions = [
            r.characteristics["persona_description"]
            for r in rows if r.language == "en"
        ]
        ar_descriptions = [
            r.characteristics["persona_description"]
            for r in rows if r.language == "ar"
        ]
        assert all("in en" in d for d in en_descriptions)
        assert all("in ar" in d for d in ar_descriptions)
    finally:
        # Cleanup. FK cascade handles audience_segment.
        db.query(_SA).filter(_SA.id == sa.id).delete()
        db.query(_Org).filter(_Org.id == org.id).delete()
        db.commit()
        db.close()


def test_audience_segment_unique_constraint_blocks_duplicate_lang_per_cluster():
    """The new UNIQUE (account, cluster_id, language) constraint must reject
    two rows for the same (account, cluster_id, language) tuple — that's the
    integrity check protecting the delete-then-insert pattern from leaving
    duplicates if the segmentation task ever races."""
    from sqlalchemy.exc import IntegrityError
    from app.models.organization import Organization as _Org
    from app.models.social_account import SocialAccount as _SA, Platform as _Platform
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz

    db = SessionLocal()
    try:
        slug = f"test-org-{uuid.uuid4().hex[:8]}"
        org = _Org(name=slug, slug=slug)
        db.add(org)
        db.flush()
        sa = _SA(
            organization_id=org.id,
            platform=_Platform.instagram,
            platform_account_id=f"ig_{uuid.uuid4().hex[:8]}",
            username=f"u_{uuid.uuid4().hex[:8]}",
            access_token_encrypted="fake",
            token_expires_at=_dt.now(_tz.utc) + _td(days=30),
            is_active=True,
        )
        db.add(sa)
        db.commit()

        first = AudienceSegment(
            social_account_id=sa.id,
            cluster_id=0,
            segment_label="A",
            size_estimate=5,
            language="en",
            characteristics={},
        )
        dup = AudienceSegment(
            social_account_id=sa.id,
            cluster_id=0,
            segment_label="B",
            size_estimate=5,
            language="en",
            characteristics={},
        )
        db.add(first)
        db.commit()
        db.add(dup)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        # Different language for the same cluster IS allowed — that's the
        # whole point of the partition.
        other = AudienceSegment(
            social_account_id=sa.id,
            cluster_id=0,
            segment_label="C",
            size_estimate=5,
            language="ar",
            characteristics={},
        )
        db.add(other)
        db.commit()
    finally:
        db.query(AudienceSegment).filter(
            AudienceSegment.social_account_id == sa.id,
        ).delete()
        db.query(_SA).filter(_SA.id == sa.id).delete()
        db.query(_Org).filter(_Org.id == org.id).delete()
        db.commit()
        db.close()


def test_bust_ai_caches_for_org_deletes_audience_segment_rows(insights_user):
    """`_bust_ai_caches_for_org` was missing audience_segment from its
    delete set — diagnosed during the 2026-05-15 three-bug diagnostic.
    After the fix, calling it must clear segments too."""
    from app.api.v1.auth import _bust_ai_caches_for_org
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from app.models.social_account import SocialAccount as _SA, Platform as _Platform

    user, org, _token = insights_user
    db = SessionLocal()
    try:
        sa = _SA(
            organization_id=org.id,
            platform=_Platform.instagram,
            platform_account_id=f"ig_{uuid.uuid4().hex[:8]}",
            username=f"u_{uuid.uuid4().hex[:8]}",
            access_token_encrypted="fake",
            token_expires_at=_dt.now(_tz.utc) + _td(days=30),
            is_active=True,
        )
        db.add(sa)
        db.flush()

        # Seed both an EN and an AR segment row.
        for lang in ("en", "ar"):
            db.add(AudienceSegment(
                social_account_id=sa.id,
                cluster_id=0,
                segment_label=f"L-{lang}",
                size_estimate=1,
                language=lang,
                characteristics={},
            ))
        db.commit()

        before = (
            db.query(AudienceSegment)
            .filter(AudienceSegment.social_account_id == sa.id)
            .count()
        )
        assert before == 2

        _bust_ai_caches_for_org(db, org.id)
        db.commit()

        after = (
            db.query(AudienceSegment)
            .filter(AudienceSegment.social_account_id == sa.id)
            .count()
        )
        assert after == 0
    finally:
        db.query(_SA).filter(_SA.id == sa.id).delete()
        db.commit()
        db.close()


def test_get_segments_filters_by_language(insights_user):
    """GET /segments?language=ar returns AR rows; ?language=en returns EN rows.
    Both languages coexist for the same cluster."""
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from app.models.social_account import SocialAccount as _SA, Platform as _Platform
    from fastapi.testclient import TestClient as _TC

    user, org, token = insights_user
    db = SessionLocal()
    sa = None
    try:
        sa = _SA(
            organization_id=org.id,
            platform=_Platform.instagram,
            platform_account_id=f"ig_{uuid.uuid4().hex[:8]}",
            username=f"u_{uuid.uuid4().hex[:8]}",
            access_token_encrypted="fake",
            token_expires_at=_dt.now(_tz.utc) + _td(days=30),
            is_active=True,
        )
        db.add(sa)
        db.flush()

        for lang in ("en", "ar"):
            db.add(AudienceSegment(
                social_account_id=sa.id,
                cluster_id=0,
                segment_label="Cluster 0",
                size_estimate=10,
                language=lang,
                characteristics={"persona_description": f"description in {lang}"},
            ))
        db.commit()

        with _TC(app) as tc:
            headers = {"Authorization": f"Bearer {token}"}
            r_en = tc.get(
                "/api/v1/analytics/segments",
                params={"social_account_id": str(sa.id), "language": "en"},
                headers=headers,
            )
            assert r_en.status_code == 200
            en_segs = r_en.json()["data"]["segments"]
            assert len(en_segs) == 1
            assert "description in en" in en_segs[0]["characteristics"]["persona_description"]

            r_ar = tc.get(
                "/api/v1/analytics/segments",
                params={"social_account_id": str(sa.id), "language": "ar"},
                headers=headers,
            )
            assert r_ar.status_code == 200
            ar_segs = r_ar.json()["data"]["segments"]
            assert len(ar_segs) == 1
            assert "description in ar" in ar_segs[0]["characteristics"]["persona_description"]
    finally:
        db.query(AudienceSegment).filter(
            AudienceSegment.social_account_id == sa.id
        ).delete() if sa else None
        db.query(_SA).filter(_SA.id == sa.id).delete() if sa else None
        db.commit()
        db.close()


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
