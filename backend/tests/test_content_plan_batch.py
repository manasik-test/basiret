"""Tests for the "Generate all 7 posts" Content Plan batch flow.

Covers:
  - POST /content-plan/batch-generate happy path (drafts + schedule)
  - 422 when no plan cached
  - 422 when fewer than 7 topics
  - 409 when a batch is already running
  - 403 for viewer + starter tier
  - GET /content-plan/batch-progress returns the row
  - GET /content-plan/batch-progress/latest
  - Remember preference persistence
  - Celery task happy path
  - Per-day image failure isolated to that day
  - Per-day caption failure isolated to that day
  - Schedule mode falls back to draft when scheduled_at is too close
  - /me returns batch_generate_* fields
"""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.ai_page_cache import AiPageCache
from app.models.batch_generate_progress import BatchGenerateProgress
from app.models.scheduled_post import ScheduledPost
from app.models.user import UserRole
from app.tasks.content_plan_batch import batch_generate_content_plan

from tests.conftest import (
    create_test_user,
    ensure_feature_flag,
    seed_social_account_with_posts,
)


# ── Helpers ────────────────────────────────────────────────────


def _seed_plan_cache(db, account_id: str, language: str = "en", *, topics: dict | None = None):
    """Insert an ai_page_cache row that looks like a fresh content-plan response.

    Defaults to 7 non-empty topics so the batch endpoint passes its "7-day plan
    complete" check. Caller can pass a partial topics dict to test the
    "incomplete plan" 422 path.
    """
    if topics is None:
        topics = {str(i): f"Plan topic {i}" for i in range(7)}
    row = AiPageCache(
        social_account_id=account_id,
        page_name="content-plan",
        language=language,
        content={"topics_by_idx": topics},
        generated_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    return row


@contextmanager
def stub_batch_dependencies(image_url: str = "https://r2.example/test.png",
                            caption_text: str = "Test caption #abc"):
    """Replace the slow / network-dependent helpers the Celery task calls.

    Patches:
      - generate_dalle_image      → returns a stable URL dict
      - analyze_image_url         → returns a tiny mock analysis
      - generate_caption_text     → returns a fixed string
    """
    with patch("app.tasks.content_plan_batch.generate_dalle_image",
               return_value={"url": image_url, "revised_prompt": "x", "size": "1024x1024"}), \
         patch("app.tasks.content_plan_batch.analyze_image_url",
               return_value={"product_description": "A test product"}), \
         patch("app.tasks.content_plan_batch.generate_caption_text",
               return_value=caption_text):
        yield


def _teardown_batch_rows(db, organization_id):
    db.query(BatchGenerateProgress).filter(
        BatchGenerateProgress.organization_id == organization_id,
    ).delete()
    db.query(ScheduledPost).filter(
        ScheduledPost.organization_id == organization_id,
    ).delete()
    db.commit()


# ── /me returns the new prefs ─────────────────────────────────


def test_me_returns_batch_prefs(client, insights_user):
    _, _, token = insights_user
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # Both fields present even before the user has clicked the dialog —
    # frontend reads them on mount.
    assert "batch_generate_default_action" in data
    assert "batch_generate_remember" in data
    assert data["batch_generate_default_action"] is None
    assert data["batch_generate_remember"] is False


# ── Auth / authorization ──────────────────────────────────────


def test_batch_generate_requires_auth(client):
    resp = client.post(
        "/api/v1/ai-pages/content-plan/batch-generate",
        json={"action": "drafts", "language": "en"},
    )
    assert resp.status_code == 403  # HTTPBearer missing header


def test_batch_generate_blocked_starter(client, starter_user):
    """Starter tier blocked by content_recommendations gate."""
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/ai-pages/content-plan/batch-generate",
        json={"action": "drafts", "language": "en"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # 403 from RequireFeature OR from require_admin_or_manager — both are
    # acceptable as "you can't do this." We just want it not to be 200.
    assert resp.status_code == 403


def test_batch_generate_viewer_forbidden(client, db):
    """Viewer role cannot trigger a batch — content mutation requires admin/manager."""
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    user, org, token = create_test_user(
        db, role=UserRole.viewer,
        plan_tier=__import__("app.models.subscription", fromlist=["PlanTier"]).PlanTier.insights,
    )
    try:
        resp = client.post(
            "/api/v1/ai-pages/content-plan/batch-generate",
            json={"action": "drafts", "language": "en"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
    finally:
        from app.models.subscription import Subscription
        from app.models.user import User
        from app.models.organization import Organization
        db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
        db.query(User).filter(User.id == user.id).delete()
        db.query(Organization).filter(Organization.id == org.id).delete()
        db.commit()


# ── Validation: missing cache / incomplete plan ──────────────


def test_batch_generate_422_no_plan_cached(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=2)

    resp = client.post(
        "/api/v1/ai-pages/content-plan/batch-generate",
        json={"action": "drafts", "language": "en"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
    assert "No content plan cached" in str(resp.json().get("detail", ""))


def test_batch_generate_422_incomplete_plan(client, db, insights_user):
    """Fewer than 7 days with topics → reject early."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(
        db, str(account.id), "en",
        topics={"0": "Topic 0", "1": "Topic 1"},  # only 2 of 7 — incomplete
    )
    try:
        resp = client.post(
            "/api/v1/ai-pages/content-plan/batch-generate",
            json={"action": "drafts", "language": "en"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
        assert "incomplete" in str(resp.json().get("detail", "")).lower()
    finally:
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


# ── Endpoint happy path: creates a row + persists prefs ──────


def test_batch_generate_creates_progress_row(client, db, insights_user):
    """POST creates a BatchGenerateProgress row, returns it, and doesn't actually
    run Celery (delay is patched)."""
    user, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")

    try:
        with patch(
            "app.tasks.content_plan_batch.batch_generate_content_plan.delay",
        ) as mock_delay:
            resp = client.post(
                "/api/v1/ai-pages/content-plan/batch-generate",
                json={
                    "social_account_id": str(account.id),
                    "action": "drafts",
                    "language": "en",
                    "remember": True,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "running"
        assert data["action"] == "drafts"
        assert data["language"] == "en"
        assert mock_delay.call_count == 1

        # Progress row written
        row = (
            db.query(BatchGenerateProgress)
            .filter(BatchGenerateProgress.id == data["id"])
            .first()
        )
        assert row is not None
        assert row.per_day_status is not None
        assert set(row.per_day_status.keys()) == {str(i) for i in range(7)}

        # Remember preference persisted on user
        db.refresh(user)
        assert user.batch_generate_default_action == "drafts"
        assert user.batch_generate_remember is True
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


def test_batch_generate_remember_false_clears_prefs(client, db, insights_user):
    """remember=False clears any previously-saved default action."""
    user, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")

    # Seed prior preference
    user.batch_generate_default_action = "schedule"
    user.batch_generate_remember = True
    db.commit()

    try:
        with patch("app.tasks.content_plan_batch.batch_generate_content_plan.delay"):
            resp = client.post(
                "/api/v1/ai-pages/content-plan/batch-generate",
                json={
                    "social_account_id": str(account.id),
                    "action": "drafts",
                    "language": "en",
                    "remember": False,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
        assert resp.status_code == 200
        db.refresh(user)
        assert user.batch_generate_default_action is None
        assert user.batch_generate_remember is False
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


# ── Duplicate batch protection ───────────────────────────────


def test_batch_generate_409_when_running_batch_exists(client, db, insights_user):
    user, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")

    # Manually create a "running" batch for this account+lang
    existing = BatchGenerateProgress(
        organization_id=org.id,
        social_account_id=account.id,
        user_id=user.id,
        language="en",
        action="drafts",
        status="running",
        per_day_status={str(i): {"status": "queued"} for i in range(7)},
    )
    db.add(existing)
    db.commit()

    try:
        resp = client.post(
            "/api/v1/ai-pages/content-plan/batch-generate",
            json={"action": "drafts", "language": "en"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
        detail = resp.json().get("detail", {})
        assert detail.get("batch_id") == str(existing.id)
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


# ── GET /content-plan/batch-progress ──────────────────────────


def test_get_batch_progress_returns_row(client, db, insights_user):
    user, org, token = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    row = BatchGenerateProgress(
        organization_id=org.id,
        social_account_id=account.id,
        user_id=user.id,
        language="en",
        action="drafts",
        status="running",
        per_day_status={str(i): {"status": "queued"} for i in range(7)},
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        resp = client.get(
            f"/api/v1/ai-pages/content-plan/batch-progress?batch_id={row.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == str(row.id)
        assert data["status"] == "running"
    finally:
        _teardown_batch_rows(db, org.id)


def test_get_batch_progress_404_cross_org(client, db, insights_user):
    """A batch from another org returns 404 (not 403, to avoid leaking existence)."""
    _, _, token = insights_user

    # Create a separate org with a batch row
    other_user, other_org, _ = create_test_user(db)
    other_account = seed_social_account_with_posts(db, other_org.id, num_posts=1)
    row = BatchGenerateProgress(
        organization_id=other_org.id,
        social_account_id=other_account.id,
        user_id=other_user.id,
        language="en",
        action="drafts",
        status="running",
        per_day_status={str(i): {"status": "queued"} for i in range(7)},
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        resp = client.get(
            f"/api/v1/ai-pages/content-plan/batch-progress?batch_id={row.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
    finally:
        _teardown_batch_rows(db, other_org.id)
        from app.models.subscription import Subscription
        from app.models.user import User
        from app.models.organization import Organization
        db.query(Subscription).filter(Subscription.organization_id == other_org.id).delete()
        db.query(User).filter(User.id == other_user.id).delete()
        db.query(Organization).filter(Organization.id == other_org.id).delete()
        db.commit()


def test_get_batch_progress_latest_returns_most_recent(client, db, insights_user):
    """Endpoint returns the newest started_at row for the account+language."""
    user, org, token = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    older = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="drafts", status="completed",
        per_day_status={str(i): {"status": "done"} for i in range(7)},
        started_at=datetime.now(timezone.utc) - timedelta(hours=2),
        completed_at=datetime.now(timezone.utc) - timedelta(hours=1, minutes=50),
    )
    newer = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="schedule", status="running",
        per_day_status={str(i): {"status": "queued"} for i in range(7)},
        started_at=datetime.now(timezone.utc) - timedelta(minutes=5),
    )
    db.add(older)
    db.add(newer)
    db.commit()
    db.refresh(newer)

    try:
        resp = client.get(
            "/api/v1/ai-pages/content-plan/batch-progress/latest?language=en",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data is not None
        assert data["id"] == str(newer.id)
        assert data["status"] == "running"
    finally:
        _teardown_batch_rows(db, org.id)


def test_get_batch_progress_latest_returns_null_when_none(client, db, insights_user):
    _, _, token = insights_user
    resp = client.get(
        "/api/v1/ai-pages/content-plan/batch-progress/latest?language=en",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] is None


# ── Celery task: happy path + per-day failure isolation ──────


def test_celery_task_happy_path_drafts(db, insights_user):
    """Runs the task end-to-end with stubbed AI helpers, asserts 7 draft posts."""
    user, org, _ = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=3)
    _seed_plan_cache(db, str(account.id), "en")

    progress = BatchGenerateProgress(
        organization_id=org.id,
        social_account_id=account.id,
        user_id=user.id,
        language="en",
        action="drafts",
        status="running",
        per_day_status={
            str(i): {"status": "queued", "scheduled_post_id": None, "error": None, "fell_back_to_draft": False}
            for i in range(7)
        },
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    batch_id = str(progress.id)

    try:
        with stub_batch_dependencies():
            result = batch_generate_content_plan(batch_id)

        assert result["status"] == "completed"

        db.refresh(progress)
        # All 7 days done
        assert all(
            (progress.per_day_status[str(i)] or {}).get("status") == "done"
            for i in range(7)
        )
        # 7 scheduled_post rows created — all drafts
        posts = (
            db.query(ScheduledPost)
            .filter(ScheduledPost.organization_id == org.id)
            .all()
        )
        assert len(posts) == 7
        assert all(p.status == "draft" for p in posts)
        assert all(p.scheduled_at is None for p in posts)
        assert all(p.content_plan_day is not None for p in posts)
        assert all(p.ai_generated_media for p in posts)
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


def test_celery_task_image_failure_isolated_to_day(db, insights_user):
    """When image gen raises for one day, that day is marked failed and the
    others continue independently."""
    user, org, _ = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")

    progress = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="drafts", status="running",
        per_day_status={
            str(i): {"status": "queued", "scheduled_post_id": None, "error": None, "fell_back_to_draft": False}
            for i in range(7)
        },
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    from app.core.ai_provider import AIProviderUnavailableError

    call_count = {"n": 0}
    def _flaky_image(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 3:  # Fail on the 3rd day
            raise AIProviderUnavailableError("image gen unavailable")
        return {"url": "https://r2/x.png", "revised_prompt": "x", "size": "1024x1024"}

    try:
        with patch(
            "app.tasks.content_plan_batch.generate_dalle_image",
            side_effect=_flaky_image,
        ), patch(
            "app.tasks.content_plan_batch.analyze_image_url",
            return_value={"product_description": "x"},
        ), patch(
            "app.tasks.content_plan_batch.generate_caption_text",
            return_value="A caption",
        ):
            batch_generate_content_plan(str(progress.id))

        db.refresh(progress)
        # Day 2 (0-indexed) failed; others done
        assert progress.per_day_status["2"]["status"] == "failed"
        assert progress.per_day_status["2"]["error"]
        # Other days succeeded
        for i in [0, 1, 3, 4, 5, 6]:
            assert progress.per_day_status[str(i)]["status"] == "done", (
                f"day {i} expected done, got {progress.per_day_status[str(i)]}"
            )
        # 6 posts persisted (not 7)
        posts = (
            db.query(ScheduledPost)
            .filter(ScheduledPost.organization_id == org.id)
            .all()
        )
        assert len(posts) == 6
        # Overall batch still 'completed' — not all failed
        assert progress.status == "completed"
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


def test_celery_task_caption_failure_isolated_to_day(db, insights_user):
    user, org, _ = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")
    progress = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="drafts", status="running",
        per_day_status={
            str(i): {"status": "queued", "scheduled_post_id": None, "error": None, "fell_back_to_draft": False}
            for i in range(7)
        },
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    from app.core.ai_provider import AIQuotaExceededError

    cap_count = {"n": 0}
    def _flaky_caption(*args, **kwargs):
        cap_count["n"] += 1
        if cap_count["n"] == 1:
            raise AIQuotaExceededError("caption quota exceeded")
        return "A caption"

    try:
        with patch(
            "app.tasks.content_plan_batch.generate_dalle_image",
            return_value={"url": "https://r2/x.png", "revised_prompt": "x", "size": "1024x1024"},
        ), patch(
            "app.tasks.content_plan_batch.analyze_image_url",
            return_value={"product_description": "x"},
        ), patch(
            "app.tasks.content_plan_batch.generate_caption_text",
            side_effect=_flaky_caption,
        ):
            batch_generate_content_plan(str(progress.id))

        db.refresh(progress)
        assert progress.per_day_status["0"]["status"] == "failed"
        for i in range(1, 7):
            assert progress.per_day_status[str(i)]["status"] == "done"
        posts = db.query(ScheduledPost).filter(ScheduledPost.organization_id == org.id).all()
        assert len(posts) == 6
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


def test_celery_task_schedule_too_close_falls_back_to_draft(db, insights_user):
    """When action='schedule' but the day's planned time is in the past or
    within SCHEDULE_TOO_CLOSE_MIN minutes, the row is saved as a draft and
    marked fell_back_to_draft=true."""
    user, org, _ = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_plan_cache(db, str(account.id), "en")
    progress = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="schedule", status="running",
        per_day_status={
            str(i): {"status": "queued", "scheduled_post_id": None, "error": None, "fell_back_to_draft": False}
            for i in range(7)
        },
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    # Pin "now" so that the very first day (today) has its planned hour already
    # passed — that day must fall back to draft. Use UTC midnight which forces
    # the day's 00:00 → 23:59 hours to mostly be in the past at any common hour.
    fake_now = datetime.now(timezone.utc).replace(hour=23, minute=58, second=0)

    try:
        with patch(
            "app.tasks.content_plan_batch.generate_dalle_image",
            return_value={"url": "https://r2/x.png", "revised_prompt": "x", "size": "1024x1024"},
        ), patch(
            "app.tasks.content_plan_batch.analyze_image_url",
            return_value={"product_description": "x"},
        ), patch(
            "app.tasks.content_plan_batch.generate_caption_text",
            return_value="A caption",
        ), patch(
            "app.tasks.content_plan_batch.datetime",
        ) as mock_dt:
            mock_dt.now.return_value = fake_now
            mock_dt.combine = datetime.combine
            batch_generate_content_plan(str(progress.id))

        db.refresh(progress)
        # Day 0 (today) must have fallen back to draft (its planned time is
        # 18:00 today, which is in the past relative to 23:58).
        assert progress.per_day_status["0"]["status"] == "done"
        assert progress.per_day_status["0"]["fell_back_to_draft"] is True

        post_today = (
            db.query(ScheduledPost)
            .filter(ScheduledPost.id == progress.per_day_status["0"]["scheduled_post_id"])
            .first()
        )
        assert post_today is not None
        assert post_today.status == "draft"
        assert post_today.scheduled_at is None
    finally:
        _teardown_batch_rows(db, org.id)
        db.query(AiPageCache).filter(AiPageCache.social_account_id == account.id).delete()
        db.commit()


# ── Task: missing cache failure mode ─────────────────────────


def test_celery_task_marks_failed_when_cache_disappears(db, insights_user):
    """Plan was regenerated between dialog click and task pickup — task should
    mark the row as failed, not silently produce empty-topic posts."""
    user, org, _ = insights_user
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    # NOTE: no cache row seeded
    progress = BatchGenerateProgress(
        organization_id=org.id, social_account_id=account.id, user_id=user.id,
        language="en", action="drafts", status="running",
        per_day_status={
            str(i): {"status": "queued", "scheduled_post_id": None, "error": None, "fell_back_to_draft": False}
            for i in range(7)
        },
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    try:
        result = batch_generate_content_plan(str(progress.id))
        assert result["status"] == "failed"
        db.refresh(progress)
        assert progress.status == "failed"
        assert progress.error_message
    finally:
        _teardown_batch_rows(db, org.id)
