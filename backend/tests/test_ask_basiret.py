"""
Ask Basiret endpoint tests.

The endpoint is `POST /api/v1/ai-pages/ask` — a Pro-gated chat surface that
grounds Gemini answers in the account's own data. Each test uses a real DB
through the existing fixtures and mocks Gemini at the provider boundary so we
never touch the network.
"""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.ai_usage_log import AiUsageLog

from tests.conftest import (
    ensure_feature_flag,
    seed_analysis_results,
    seed_social_account_with_posts,
)


# ── Provider mock ──────────────────────────────────────────────


@contextmanager
def mock_ask_provider(text_response="From the data, here's the answer."):
    """Patch `get_provider("ask")` so generate_chat returns a canned reply
    without contacting Gemini. Also flips `_ai_available` true so the endpoint
    doesn't short-circuit on a missing GEMINI_API_KEY in CI."""
    class _FakeProvider:
        name = "fake"
        last_call = {}

        def generate_chat(self, system, history, new_user_message, *args, **kwargs):
            _FakeProvider.last_call = {
                "system": system,
                "history": list(history),
                "new_user_message": new_user_message,
            }
            return text_response

    with patch("app.api.v1.ai_pages._ai_available", return_value=True), \
         patch("app.api.v1.ai_pages.get_provider", return_value=_FakeProvider()):
        yield _FakeProvider


# ── 1. Happy path ───────────────────────────────────────────────


def test_ask_happy_path(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=4)
    seed_analysis_results(db, account.id)

    with mock_ask_provider(text_response="Your image posts perform best — keep them coming."):
        resp = client.post(
            "/api/v1/ai-pages/ask",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "question": "What type of content performs best for me?",
                "language": "en",
                "conversation_history": [],
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert "Your image posts perform best" in data["answer"]
    assert data["language"] == "en"
    # data_used should list which context buckets were populated. With seeded
    # posts + engagement we expect at least the post-derived buckets.
    assert "data_window" in data["data_used"]
    assert "top_content_type" in data["data_used"]
    assert "best_posting_time" in data["data_used"]


# ── 2. Empty account → friendly "no data" message ──────────────


def test_ask_empty_account(client, db, insights_user):
    """No connected social accounts → return a friendly explainer, not 503."""
    _, _, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)

    # Don't mock Gemini — the endpoint should short-circuit without ever
    # reaching the provider. If it does call out we want the test to fail.
    resp = client.post(
        "/api/v1/ai-pages/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "How am I doing?", "language": "en", "conversation_history": []},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["data_used"] == []
    assert "Connect" in data["answer"] or "sync" in data["answer"].lower()


def test_ask_account_without_analyzed_posts(client, db, insights_user):
    """Account exists but no posts at all → still falls into the friendly path."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    # Seed an account but with 0 posts
    from app.models.social_account import SocialAccount, Platform
    import uuid as _uuid
    suffix = _uuid.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id=f"ig_empty_{suffix}",
        username=f"empty_{suffix}",
        access_token_encrypted="enc",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
        is_active=True,
    )
    db.add(account)
    db.commit()

    resp = client.post(
        "/api/v1/ai-pages/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "anything", "language": "en", "conversation_history": []},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["data_used"] == []
    assert "synced" in data["answer"].lower() or "no analyzed" in data["answer"].lower()


# ── 3. Rate limit hit → 503 with structured degraded body ──────


def test_ask_rate_limit_hit(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    seed_analysis_results(db, account.id)

    # Pre-populate ai_usage_log with 20 ask rows in the last 24h to trip the
    # AI_ASK_DAILY_LIMIT_PER_ACCOUNT=20 default. Each row is its own commit so
    # the count query in the endpoint sees them.
    for _ in range(20):
        db.add(
            AiUsageLog(
                social_account_id=account.id,
                provider="gemini",
                task="ask",
                source="user",
                tokens_used=100,
            )
        )
    db.commit()

    try:
        with mock_ask_provider():
            resp = client.post(
                "/api/v1/ai-pages/ask",
                headers={"Authorization": f"Bearer {token}"},
                json={"question": "Anything?", "language": "en", "conversation_history": []},
            )
        assert resp.status_code == 503
        body = resp.json()
        assert body["success"] is False
        assert body["data"] is None
        meta = body["meta"]
        assert meta["status"] == "degraded"
        assert meta["cached"] is False
        assert meta["retry_after_hours"] == 24
        assert meta["limit"] == 20
    finally:
        # Clean up the seeded usage rows so other tests aren't affected
        db.query(AiUsageLog).filter(AiUsageLog.social_account_id == account.id).delete()
        db.commit()


# ── 4. Auth required ───────────────────────────────────────────


def test_ask_unauthenticated(client):
    resp = client.post(
        "/api/v1/ai-pages/ask",
        json={"question": "hi", "language": "en", "conversation_history": []},
    )
    # HTTPBearer returns 403 when the Authorization header is missing — same
    # behavior as every other protected endpoint in this suite.
    assert resp.status_code == 403


# ── 5. Pro feature gate — Starter blocked ──────────────────────


def test_ask_starter_blocked(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/ai-pages/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "hi", "language": "en", "conversation_history": []},
    )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail["locked"] is True
    assert detail["feature"] == "content_recommendations"


# ── 6. conversation_history >6 turns → 422 ─────────────────────


def test_ask_history_too_long(client, insights_user, db):
    _, _, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    too_many = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"turn {i}"}
        for i in range(7)
    ]
    resp = client.post(
        "/api/v1/ai-pages/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": "next?", "language": "en", "conversation_history": too_many},
    )
    assert resp.status_code == 422


# ── 7. Question too long → 422 ─────────────────────────────────


def test_ask_question_too_long(client, insights_user, db):
    _, _, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    long_q = "a" * 501
    resp = client.post(
        "/api/v1/ai-pages/ask",
        headers={"Authorization": f"Bearer {token}"},
        json={"question": long_q, "language": "en", "conversation_history": []},
    )
    assert resp.status_code == 422


# ── 8. Arabic language honored ─────────────────────────────────


def test_ask_arabic(client, db, insights_user):
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=3)
    seed_analysis_results(db, account.id)

    with mock_ask_provider(text_response="جمهورك يتفاعل أكثر مع الصور."):
        resp = client.post(
            "/api/v1/ai-pages/ask",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "question": "ما هو أفضل نوع محتوى لي؟",
                "language": "ar",
                "conversation_history": [],
            },
        )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["language"] == "ar"
    assert data["answer"] == "جمهورك يتفاعل أكثر مع الصور."
