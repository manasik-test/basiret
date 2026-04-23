"""
Resilience tests for the AI provider layer.

Covers Task 1 (graceful error handling) and Task 2 (per-account rate limit
+ /admin/ai-usage). These tests do NOT call any real AI provider — Gemini
and OpenAI calls are routed through `get_provider(...)` which we monkey-patch
to return fixed responses or raise typed exceptions.
"""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.core.ai_provider import (
    AIInvalidResponseError,
    AIProviderUnavailableError,
    AIQuotaExceededError,
)
from app.models.ai_page_cache import AiPageCache
from app.models.ai_usage_log import AiUsageLog

from tests.conftest import ensure_feature_flag, seed_social_account_with_posts


# ── Helpers ──────────────────────────────────────────────────


@contextmanager
def patch_provider(*, raise_exc=None, json_response=None, text_response=""):
    """Replace `get_provider` for both ai_pages and analytics so every AI
    call goes through the fake. If `raise_exc` is set, the fake raises;
    otherwise returns the canned response."""

    class _Fake:
        name = "fake"

        def generate_text(self, *_args, **_kwargs):
            if raise_exc is not None:
                raise raise_exc
            return text_response

        def generate_json(self, *_args, **_kwargs):
            if raise_exc is not None:
                raise raise_exc
            return json_response or {}

    with patch("app.api.v1.ai_pages.get_provider", return_value=_Fake()), \
         patch("app.api.v1.ai_pages._gemini_available", return_value=True):
        yield


def _clear_usage(db):
    db.query(AiUsageLog).delete()
    db.commit()


def _clear_page_cache(db, account_id):
    db.query(AiPageCache).filter(AiPageCache.social_account_id == account_id).delete()
    db.commit()


# ── Task 1: graceful error handling ─────────────────────────


def test_posts_insights_quota_with_no_cache_returns_503(client, db, starter_user):
    """First call after quota outage with no cache row → 503 + structured body."""
    _, org, token = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=4)
    _clear_page_cache(db, account.id)

    with patch_provider(raise_exc=AIQuotaExceededError("rate limit", provider="gemini")):
        resp = client.get(
            "/api/v1/ai-pages/posts-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert body["meta"]["status"] == "degraded"
    assert body["meta"]["cached"] is False
    assert body["meta"]["retry_after_hours"] == 24
    assert "unavailable" in body["meta"]["message"].lower()


def test_posts_insights_quota_with_stale_cache_returns_200_degraded(
    client, db, starter_user,
):
    """When a cache row exists (any age), AI failure serves it with degraded meta."""
    _, org, token = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=4)

    # Pre-seed a cache row that's 100h old (well past the 72h hard TTL)
    _clear_page_cache(db, account.id)
    db.add(
        AiPageCache(
            social_account_id=account.id,
            page_name="posts-insights",
            language="en",
            content={
                "why_it_worked": "Cached: hooked with a question.",
                "low_performers_pattern": "Cached: long captions without CTAs.",
                "what_to_change": "Cached: shorten captions and end with a question.",
            },
            generated_at=datetime.now(timezone.utc) - timedelta(hours=100),
        )
    )
    db.commit()

    with patch_provider(
        raise_exc=AIProviderUnavailableError("upstream 503", provider="gemini"),
    ):
        resp = client.get(
            "/api/v1/ai-pages/posts-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["why_it_worked"] == "Cached: hooked with a question."
    assert body["meta"]["status"] == "degraded"
    assert body["meta"]["cached"] is True
    assert body["meta"]["cached_age_hours"] >= 99


def test_caption_quota_returns_503_no_cache(client, starter_user):
    """Captions have no useful data-only fallback — quota → 503."""
    _, _, token = starter_user

    with patch_provider(raise_exc=AIQuotaExceededError("daily limit", provider="openai")):
        resp = client.post(
            "/api/v1/ai-pages/generate-caption",
            json={"content_type": "image", "language": "en", "topic": "Quick tip"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 503
    body = resp.json()
    assert body["meta"]["status"] == "degraded"
    assert body["meta"]["cached"] is False


def test_invalid_response_treated_as_degraded(client, db, starter_user):
    """AIInvalidResponseError (malformed) propagates as a degraded response."""
    _, org, token = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=4)
    _clear_page_cache(db, account.id)

    with patch_provider(raise_exc=AIInvalidResponseError("bad json", provider="gemini")):
        resp = client.get(
            "/api/v1/ai-pages/posts-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    # No cache → 503 with degraded body
    assert resp.status_code == 503
    assert resp.json()["meta"]["status"] == "degraded"


def test_fresh_response_marks_meta_status_fresh(client, db, starter_user):
    """Successful AI call returns meta.status='fresh' alongside data."""
    _, org, token = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=4)
    _clear_page_cache(db, account.id)

    fake = {
        "why_it_worked": "Strong hook + question CTA.",
        "low_performers_pattern": "Long, generic captions.",
        "what_to_change": "Cut captions to 2 lines, end with a question.",
    }
    with patch_provider(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/posts-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["why_it_worked"] == fake["why_it_worked"]
    assert body["meta"]["status"] == "fresh"


# ── Task 2: rate limiting + admin visibility ─────────────────


def test_admin_ai_usage_endpoint(client, db, system_admin_user, starter_user):
    """`/admin/ai-usage` aggregates per-account 7d counts and joins org meta."""
    _, _, admin_token = system_admin_user
    _, org, _ = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _clear_usage(db)

    # Seed a few usage rows directly
    now = datetime.now(timezone.utc)
    for _ in range(3):
        db.add(AiUsageLog(
            social_account_id=account.id, provider="gemini",
            task="pages", source="user", called_at=now,
        ))
    for _ in range(7):
        db.add(AiUsageLog(
            social_account_id=account.id, provider="openai",
            task="captions", source="user", called_at=now,
        ))
    # Old row outside the 7d window — should be ignored
    db.add(AiUsageLog(
        social_account_id=account.id, provider="gemini",
        task="pages", source="user",
        called_at=now - timedelta(days=10),
    ))
    db.commit()

    resp = client.get(
        "/api/v1/admin/ai-usage",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    accounts = resp.json()["data"]["accounts"]

    by_id = {a["account_id"]: a for a in accounts}
    assert str(account.id) in by_id
    row = by_id[str(account.id)]
    assert row["gemini_calls_7d"] == 3
    assert row["openai_calls_7d"] == 7
    assert row["org_name"] == org.name


def test_admin_ai_usage_requires_system_admin(client, starter_user):
    """Non-admin users get 403."""
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/admin/ai-usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_rate_limit_gate_raises_quota_when_exceeded(db, starter_user):
    """Direct provider call must short-circuit when 24h count >= per-day limit.

    We don't hit a real provider — we exercise the gate by seeding exactly
    LIMIT rows in ai_usage_log and asserting the next call raises
    `AIQuotaExceededError` BEFORE any upstream HTTP request.
    """
    from app.core.ai_provider import GeminiProvider
    from app.core.config import settings

    _, org, _ = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _clear_usage(db)

    limit = settings.AI_GEMINI_DAILY_LIMIT_PER_ACCOUNT
    now = datetime.now(timezone.utc)
    for _ in range(limit):
        db.add(AiUsageLog(
            social_account_id=account.id, provider="gemini",
            task="pages", source="user", called_at=now,
        ))
    db.commit()

    provider = GeminiProvider()
    try:
        provider.generate_text(
            "system", "user", account_id=str(account.id),
            task="pages", source="user",
        )
        raised = None
    except AIQuotaExceededError as exc:
        raised = exc

    assert raised is not None, "expected AIQuotaExceededError, got nothing"
    assert "daily limit" in str(raised).lower()


def test_background_source_bypasses_rate_limit(db, starter_user):
    """Background SWR refreshes must NOT be gated by the per-account limit.

    Asserts that even with the limit fully consumed, a `source='background'`
    call gets past the gate (it would then hit the network, which we patch
    out by intercepting `_invoke`)."""
    from app.core.ai_provider import GeminiProvider
    from app.core.config import settings

    _, org, _ = starter_user
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _clear_usage(db)

    limit = settings.AI_GEMINI_DAILY_LIMIT_PER_ACCOUNT
    now = datetime.now(timezone.utc)
    for _ in range(limit):
        db.add(AiUsageLog(
            social_account_id=account.id, provider="gemini",
            task="pages", source="user", called_at=now,
        ))
    db.commit()

    provider = GeminiProvider()

    class _FakeResp:
        text = "fresh"
        usage_metadata = None

    with patch.object(provider, "_invoke", return_value=_FakeResp()):
        # Should NOT raise — background source bypasses the gate.
        out = provider.generate_text(
            "system", "user", account_id=str(account.id),
            task="pages", source="background",
        )

    assert out == "fresh"
