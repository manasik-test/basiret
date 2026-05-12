"""
AI page-level endpoint tests.

Covers /api/v1/ai-pages/* — the Gemini-powered hero sections of the inner
pages. Each endpoint is tested for:
  - 401 without auth
  - 403 when blocked by the relevant feature flag (where applicable)
  - 200 happy path with Gemini mocked (so tests don't hit the network)

Gemini is mocked at the helper-function level (`_gemini_available`,
`_gemini_json`, `_gemini_text`) rather than monkey-patching `google.generativeai`,
so the test target stays close to what the endpoint code actually calls.
"""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.analysis_result import AnalysisResult
from app.models.comment import Comment
from app.models.post import Post

from tests.conftest import (
    ensure_feature_flag,
    seed_social_account_with_posts,
)


# ── Mock helpers ───────────────────────────────────────────────


@contextmanager
def mock_gemini(json_response=None, text_response=""):
    """Force the AI code paths to run, returning canned responses.

    Patches `_gemini_available` (bypass API-key short-circuit), the legacy
    `_gemini_json` / `_gemini_text` helpers AND the provider factory so the
    caption endpoint (now routed through `get_provider('captions')`) returns
    the same canned text regardless of which concrete provider is selected.
    """
    class _FakeProvider:
        name = "fake"
        def generate_text(self, system, user, temperature=0.5, **_kwargs):
            return text_response
        def generate_json(self, system, user, temperature=0.5, **_kwargs):
            return json_response or {}

    with patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         patch("app.api.v1.ai_pages._gemini_json", return_value=json_response or {}), \
         patch("app.api.v1.ai_pages._gemini_text", return_value=text_response), \
         patch("app.api.v1.ai_pages.get_provider", return_value=_FakeProvider()):
        yield


def seed_comments_with_sentiment(db, account_id, *, negative_per_post: int = 3, num_posts: int = 2):
    """Seed extra posts each with N negative comments (analyzed) — for sentiment_responses tests."""
    posts = db.query(Post).filter(Post.social_account_id == account_id).all()[:num_posts]
    for i, post in enumerate(posts):
        for j in range(negative_per_post):
            c = Comment(
                post_id=post.id,
                platform_comment_id=f"cmt_{post.id}_{j}_{i}",
                text=f"This is bad, fix it #{j}",
                author_username=f"user{j}",
                created_at=datetime.now(timezone.utc) - timedelta(hours=j + 1),
            )
            db.add(c)
            db.flush()
            ar = AnalysisResult(
                comment_id=c.id,
                sentiment="negative",
                sentiment_score=-0.7,
                language_detected="en",
                model_used="test",
            )
            db.add(ar)
    db.commit()


def seed_positive_comments(db, account_id, *, n: int = 5):
    """Seed positive comments on the account's first post — for audience-insights tests."""
    post = db.query(Post).filter(Post.social_account_id == account_id).first()
    if not post:
        return
    for j in range(n):
        c = Comment(
            post_id=post.id,
            platform_comment_id=f"poscmt_{post.id}_{j}",
            text=f"Love this product, please more like #{j}",
            author_username=f"fan{j}",
            created_at=datetime.now(timezone.utc) - timedelta(hours=j + 1),
        )
        db.add(c)
        db.flush()
        ar = AnalysisResult(
            comment_id=c.id,
            sentiment="positive",
            sentiment_score=0.85,
            language_detected="en",
            model_used="test",
        )
        db.add(ar)
    db.commit()


# ── /posts-insights ────────────────────────────────────────────


def test_posts_insights_no_auth(client):
    resp = client.get("/api/v1/ai-pages/posts-insights")
    # HTTPBearer returns 403 when Authorization header is missing
    assert resp.status_code == 403


def test_posts_insights_empty(client, starter_user):
    """No posts → empty payload, no Gemini call attempted."""
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/ai-pages/posts-insights",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["best_post"] is None
    assert data["why_it_worked"] == ""
    assert data["what_to_change"] == ""


def test_posts_insights_with_data_and_gemini(client, db, starter_user):
    """Top post returned + Gemini fields populated from mocked response."""
    _, org, token = starter_user
    seed_social_account_with_posts(db, org.id, num_posts=4)

    fake = {
        "why_it_worked": "Strong opening hook and a question CTA.",
        "low_performers_pattern": "Generic captions with no question.",
        "what_to_change": "End every caption with a question your audience can answer in one word.",
    }
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/posts-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["best_post"] is not None
    assert data["best_post"]["likes"] > 0
    # Top post is the highest-engagement one (4 posts seeded → likes=10,20,30,40 → best=40)
    assert data["best_post"]["likes"] == 40
    assert data["why_it_worked"] == fake["why_it_worked"]
    assert data["low_performers_pattern"] == fake["low_performers_pattern"]
    assert data["what_to_change"] == fake["what_to_change"]


# ── /generate-caption ──────────────────────────────────────────


def test_generate_caption_no_auth(client):
    resp = client.post(
        "/api/v1/ai-pages/generate-caption",
        json={"content_type": "image", "language": "en"},
    )
    assert resp.status_code == 403


def test_generate_caption_with_gemini(client, starter_user):
    """Mocked Gemini returns a caption string verbatim."""
    _, _, token = starter_user
    fake_caption = "Quick tip: try this trick today. Will it work for you?\n#tip #grow"
    with mock_gemini(text_response=fake_caption):
        resp = client.post(
            "/api/v1/ai-pages/generate-caption",
            json={"content_type": "video", "language": "en", "topic": "Growth tip"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.json()["data"]["caption"] == fake_caption


def test_caption_image_ratio_in_prompt(client, starter_user):
    """When image_ratio is sent, the system prompt mentions the ratio's
    word ('square'/'portrait'/'landscape') so Gemini formats accordingly."""
    _, _, token = starter_user
    captured: dict = {}

    class _SpyProvider:
        name = "spy"

        def generate_text(self, system, user, temperature=0.5, **_kwargs):
            captured["system"] = system
            captured["user"] = user
            return "fake caption"

        def generate_json(self, *_args, **_kwargs):
            return {}

    with patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         patch("app.api.v1.ai_pages.get_provider", return_value=_SpyProvider()):
        resp = client.post(
            "/api/v1/ai-pages/generate-caption",
            json={"content_type": "image", "language": "en", "image_ratio": "4:5"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert "portrait" in captured.get("system", "").lower()


def test_generate_caption_arabic(client, starter_user):
    """Arabic-language request goes through; backend just plumbs the language flag."""
    _, _, token = starter_user
    fake_caption = "جرّب هذه النصيحة اليوم. هل ستنجح معك؟"
    with mock_gemini(text_response=fake_caption):
        resp = client.post(
            "/api/v1/ai-pages/generate-caption",
            json={"content_type": "image", "language": "ar"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["caption"] == fake_caption


# ── /audience-insights ─────────────────────────────────────────


def test_audience_insights_no_auth(client):
    resp = client.get("/api/v1/ai-pages/audience-insights")
    assert resp.status_code == 403


def test_audience_insights_blocked_starter(client, starter_user):
    """Starter tier blocked by audience_segmentation feature flag."""
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/ai-pages/audience-insights",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail["locked"] is True
    assert detail["feature"] == "audience_segmentation"


def test_audience_insights_with_data_and_gemini(client, db, insights_user):
    """Insights tier with seeded data + comments → AI fields populated."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "audience_segmentation", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=3)
    seed_positive_comments(db, account.id, n=4)

    fake = {
        "behavior_summary": "Audience is highly engaged with positive replies skewing toward product praise.",
        "what_they_want": [
            {"topic": "Product tutorials", "reason": "Comments ask how to use features."},
            {"topic": "Behind the scenes", "reason": "Audience curiosity around the team."},
            {"topic": "Customer stories", "reason": "Praise indicates trust."},
        ],
        "best_time_reason": "Engagement peaks when followers are commuting.",
    }
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/audience-insights",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["behavior_summary"] == fake["behavior_summary"]
    assert len(data["what_they_want"]) == 3
    assert data["what_they_want"][0]["topic"] == "Product tutorials"
    assert data["best_time"]["reason"] == fake["best_time_reason"]
    # Best time is data-driven, not from Gemini — should be a real day/hour string
    assert data["best_time"]["day"] != ""
    assert ":" in data["best_time"]["time"]


# ── /content-plan ──────────────────────────────────────────────


def test_content_plan_no_auth(client):
    resp = client.get("/api/v1/ai-pages/content-plan")
    assert resp.status_code == 403


def test_content_plan_blocked_starter(client, starter_user):
    """Starter tier blocked by content_recommendations feature flag."""
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/ai-pages/content-plan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["locked"] is True
    assert resp.json()["detail"]["feature"] == "content_recommendations"


def test_content_plan_with_data_and_gemini(client, db, insights_user):
    """7-day plan returned with Gemini topics merged into matching day_index."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=4)

    fake = {
        "topics": [
            {"day_index": i, "topic": f"Topic for day {i}"}
            for i in range(7)
        ]
    }
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    days = resp.json()["data"]["days"]
    assert len(days) == 7
    # Topics merged from Gemini response by day_index
    assert days[0]["topic"] == "Topic for day 0"
    assert days[6]["topic"] == "Topic for day 6"
    # Data-driven slot fields are present regardless of Gemini
    assert all("content_type" in d and "best_time" in d and "date" in d for d in days)


# ── /content-plan: inferred-context helper (unit) ──────────────


def test_infer_context_arabic_dominant():
    from app.api.v1.ai_pages import _infer_context_from_captions
    captions = [
        "تحلم يكون عندك مسبح خاص في بيتك بعمان؟ #مسقط #عمان",
        "نحن في Smart Pools نساعدك نصمم المسبح",
        "تواصل معنا واحصل على عرض السعر المناسب",
    ]
    block = _infer_context_from_captions(captions)
    assert block.startswith("INFERRED CONTEXT")
    assert "Arabic" in block
    # Either the English-transliterated or Arabic location term should resolve
    assert "Oman" in block or "Muscat" in block


def test_infer_context_english_dominant():
    from app.api.v1.ai_pages import _infer_context_from_captions
    captions = [
        "Pool maintenance tips for Riyadh homes — keep your water clear all summer",
        "Cleaning pools every week the right way using professional equipment",
        "Customer testimonial about our Saudi Arabia pool design services",
    ]
    block = _infer_context_from_captions(captions)
    assert "English" in block
    assert "Riyadh" in block or "Saudi" in block


def test_infer_context_mixed_bilingual():
    from app.api.v1.ai_pages import _infer_context_from_captions
    # Roughly balanced Arabic + English (neither dominates by 2x) — should
    # fall through to the bilingual bucket rather than picking one language.
    captions = [
        "Pool tip اليوم مسبح نظيف design idea",
        "اهلا في صفحتنا hello welcome مرحبا بكم في المتجر",
        "تواصل معنا للحصول على عرض السعر today",
    ]
    block = _infer_context_from_captions(captions)
    assert "mix" in block.lower()


def test_infer_context_empty_input():
    from app.api.v1.ai_pages import _infer_context_from_captions
    assert _infer_context_from_captions([]) == ""
    assert _infer_context_from_captions(["", None, ""]) == ""  # type: ignore[list-item]


# ── /content-plan: real brand identity > inferred context ──────


def test_content_plan_real_brand_identity_skips_inferred(client, db, insights_user):
    """When brand_identity is populated, the INFERRED CONTEXT block must NOT
    appear in the prompt sent to Gemini."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=3)

    org.brand_identity = {
        "tone": "friendly",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "medium",
        "content_pillars": ["Pool tips", "Before and after", "Customer stories"],
        "primary_color": "#1E88E5",
    }
    db.commit()

    captured: dict = {}
    fake = {"topics": [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(7)]}

    def fake_gemini(system, user_msg, **kwargs):
        captured["system"] = system
        captured["user_msg"] = user_msg
        return fake

    from unittest.mock import patch as _patch
    with _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=fake_gemini), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    # Real brand identity present → inferred block must not be injected.
    assert "INFERRED CONTEXT" not in captured["user_msg"]
    assert "BRAND IDENTITY" in captured["user_msg"]
    # day_label removed from skeleton — keep only date + content type.
    assert "Monday" not in captured["user_msg"]
    assert "Tuesday" not in captured["user_msg"]


def test_content_plan_empty_brand_uses_inferred_context(client, db, insights_user):
    """When both business_profile and brand_identity are NULL, the inferred
    context block is built from the top captions and injected."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=3)

    # Overwrite captions with Arabic pool-themed text so inferred context has signal
    for i, post in enumerate(db.query(Post).filter(Post.social_account_id == account.id).all()):
        post.caption = "تحلم يكون عندك مسبح خاص في بيتك #مسقط #عمان"
    org.business_profile = None
    org.brand_identity = None
    db.commit()

    captured: dict = {}
    fake = {"topics": [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(7)]}

    def fake_gemini(system, user_msg, **kwargs):
        captured["user_msg"] = user_msg
        return fake

    from unittest.mock import patch as _patch
    with _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=fake_gemini), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert "INFERRED CONTEXT" in captured["user_msg"]
    assert "Arabic" in captured["user_msg"]


# ── /content-plan: forbidden-pattern retry + fallback ──────────


def test_content_plan_clean_topics_no_retry(client, db, insights_user, caplog):
    """Clean topics → no retry fires, INFO 'topics_clean' log line emitted."""
    import logging
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=3)

    fake = {"topics": [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(7)]}
    call_count = {"n": 0}

    def fake_gemini(*_args, **_kwargs):
        call_count["n"] += 1
        return fake

    from unittest.mock import patch as _patch
    with caplog.at_level(logging.INFO, logger="app.api.v1.ai_pages"), \
         _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=fake_gemini), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert call_count["n"] == 1  # No retry
    assert any("content_plan_topics_clean" in r.message for r in caplog.records)
    assert not any("forbidden_pattern_retries" in r.message for r in caplog.records)


def test_content_plan_forbidden_then_clean_retries_once(client, db, insights_user, caplog):
    """First Gemini call returns 'Monday Motivation' → retry fires → clean output."""
    import logging
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=3)

    bad = {
        "topics": [
            {"day_index": 0, "topic": "Monday Motivation: Start your week with a smile"},
        ] + [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(1, 7)]
    }
    good = {"topics": [{"day_index": i, "topic": f"Specific pool topic {i}"} for i in range(7)]}

    from unittest.mock import patch as _patch
    with caplog.at_level(logging.WARNING, logger="app.api.v1.ai_pages"), \
         _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=[bad, good]), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    days = resp.json()["data"]["days"]
    assert days[0]["topic"] == "Specific pool topic 0"
    assert any("forbidden_pattern_retries" in r.message for r in caplog.records)
    assert not any("forbidden_pattern_fallbacks" in r.message for r in caplog.records)


def test_content_plan_forbidden_twice_uses_pillar_fallback(client, db, insights_user, caplog):
    """Retry also returns 'Monday Motivation' → fallback to content_pillars."""
    import logging
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=3)

    org.brand_identity = {
        "tone": "friendly",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "medium",
        "content_pillars": [
            "Pool maintenance tips",
            "Before and after pool restoration",
            "Pool design ideas",
            "Customer testimonials",
            "Behind the scenes",
        ],
        "primary_color": "#1E88E5",
    }
    db.commit()

    bad = {
        "topics": [
            {"day_index": 0, "topic": "Monday Motivation: Start your week with a smile"},
        ] + [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(1, 7)]
    }

    from unittest.mock import patch as _patch
    with caplog.at_level(logging.WARNING, logger="app.api.v1.ai_pages"), \
         _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=[bad, bad]), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    days = resp.json()["data"]["days"]
    # day_index=0 → pillars[0] = "Pool maintenance tips"
    assert days[0]["topic"] == "Pool maintenance tips"
    assert any("forbidden_pattern_retries" in r.message for r in caplog.records)
    assert any("forbidden_pattern_fallbacks" in r.message for r in caplog.records)


def test_content_plan_forbidden_twice_no_pillars_uses_generic_fallback(client, db, insights_user, caplog):
    """Retry also forbidden + no content_pillars → generic placeholder topic."""
    import logging
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    seed_social_account_with_posts(db, org.id, num_posts=3)
    # Leave brand_identity NULL so the fallback path has no pillars.
    org.brand_identity = None
    db.commit()

    bad = {
        "topics": [
            {"day_index": 0, "topic": "Monday Motivation"},
        ] + [{"day_index": i, "topic": f"Pool topic {i}"} for i in range(1, 7)]
    }

    from unittest.mock import patch as _patch
    with caplog.at_level(logging.WARNING, logger="app.api.v1.ai_pages"), \
         _patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         _patch("app.api.v1.ai_pages._gemini_json", side_effect=[bad, bad]), \
         _patch("app.api.v1.ai_pages._gemini_text", return_value=""):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    days = resp.json()["data"]["days"]
    assert days[0]["topic"] == "Share an update from your business"
    assert any("forbidden_pattern_fallbacks" in r.message for r in caplog.records)


# ── /sentiment-responses ───────────────────────────────────────


def test_sentiment_responses_no_auth(client):
    resp = client.get("/api/v1/ai-pages/sentiment-responses")
    assert resp.status_code == 403


def test_sentiment_responses_blocked_starter(client, starter_user):
    """Starter tier blocked by sentiment_analysis feature flag."""
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/ai-pages/sentiment-responses",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["locked"] is True
    assert resp.json()["detail"]["feature"] == "sentiment_analysis"


def test_sentiment_responses_empty(client, db, insights_user):
    """Insights user with no needs-attention posts → empty templates list, no Gemini call."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "sentiment_analysis", True)
    seed_social_account_with_posts(db, org.id, num_posts=2)
    # No comments seeded → no posts qualify for needs-attention

    resp = client.get(
        "/api/v1/ai-pages/sentiment-responses",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["templates"] == []


def test_sentiment_responses_with_data_and_gemini(client, db, insights_user):
    """Posts with >2 negative comments → Gemini-mocked reply templates returned per post."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "sentiment_analysis", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    seed_comments_with_sentiment(db, account.id, negative_per_post=3, num_posts=2)

    # Resolve the post IDs we just seeded so the fake Gemini response uses real IDs
    post_ids = [
        str(p.id)
        for p in db.query(Post).filter(Post.social_account_id == account.id).all()
    ]

    fake = {
        "templates": [
            {"post_id": pid, "response_template": f"We hear you and we're sorry — DM us. ({pid[:6]})"}
            for pid in post_ids
        ]
    }
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/sentiment-responses",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    templates = resp.json()["data"]["templates"]
    assert len(templates) == 2
    # Every returned template carries a real post_id and the mocked text
    template_by_id = {t["post_id"]: t["response_template"] for t in templates}
    for pid in post_ids:
        assert pid in template_by_id
        assert "DM us" in template_by_id[pid]


# ── PATCH /content-plan/topic + GET extension ──────────────────


def _seed_content_plan_cache(db, account_id, language="en", topics=None):
    """Insert an ai_page_cache row mimicking a prior GET /content-plan call.

    Returns the AiPageCache row so tests can inspect it after PATCH.
    """
    from app.models.ai_page_cache import AiPageCache
    default_topics = {str(i): f"AI topic {i}" for i in range(7)}
    row = AiPageCache(
        social_account_id=account_id,
        page_name="content-plan",
        language=language,
        content={"topics_by_idx": topics if topics is not None else default_topics},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _insights_user_with_role(db, role):
    """Helper: create an insights-plan user with a specific role so we can
    exercise the role gate WITHOUT being short-circuited by the feature flag."""
    from tests.conftest import create_test_user
    from app.models.subscription import PlanTier
    user, org, token = create_test_user(db, role=role, plan_tier=PlanTier.insights)
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    return user, org, token


def test_update_content_plan_topic_happy_path(client, db, insights_user):
    """Admin user with cache row → PATCH succeeds, content updated in DB."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)
    _seed_content_plan_cache(db, account.id)

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "en",
            "day_index": 3,
            "new_topic": "Cleaning a pool in 40°C Oman heat",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["day_index"] == 3
    assert data["topic"] == "Cleaning a pool in 40°C Oman heat"
    assert data["last_user_edit_at"] is not None

    # Verify the DB row was actually updated and last_user_edit_at stamped
    from app.models.ai_page_cache import AiPageCache
    db.expire_all()
    row = (
        db.query(AiPageCache)
        .filter(
            AiPageCache.social_account_id == account.id,
            AiPageCache.page_name == "content-plan",
            AiPageCache.language == "en",
        )
        .first()
    )
    assert row.content["topics_by_idx"]["3"] == "Cleaning a pool in 40°C Oman heat"
    assert row.last_user_edit_at is not None


def test_update_content_plan_topic_viewer_forbidden(client, db):
    """Viewer role → 403 even on insights plan (role gate, not feature gate)."""
    from app.models.user import UserRole
    user, org, token = _insights_user_with_role(db, UserRole.viewer)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _seed_content_plan_cache(db, account.id)

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "en",
            "day_index": 0,
            "new_topic": "Topic from a viewer",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_update_content_plan_topic_system_admin_forbidden(client, db):
    """system_admin → 403 (excluded from this gate; they're cross-org operators)."""
    from app.models.user import UserRole
    user, org, token = _insights_user_with_role(db, UserRole.system_admin)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _seed_content_plan_cache(db, account.id)

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "en",
            "day_index": 0,
            "new_topic": "Edited by system admin",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


def test_update_content_plan_topic_other_org_account_404(client, db, insights_user):
    """Account belongs to a different organization → 404."""
    _, _, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)

    # Create a separate org with an account; this org's user is NOT the
    # caller — caller's JWT references insights_user's org.
    from tests.conftest import create_test_user
    from app.models.subscription import PlanTier
    _, other_org, _ = create_test_user(db, plan_tier=PlanTier.insights)
    other_account = seed_social_account_with_posts(db, other_org.id, num_posts=1)
    _seed_content_plan_cache(db, other_account.id)

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(other_account.id),
            "language": "en",
            "day_index": 0,
            "new_topic": "Cross-org write attempt",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_update_content_plan_topic_invalid_day_index(client, db, insights_user):
    """day_index outside 0-6 → 422 via Pydantic ge/le."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _seed_content_plan_cache(db, account.id)

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "en",
            "day_index": 7,
            "new_topic": "out of range",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_update_content_plan_topic_no_cache_row(client, db, insights_user):
    """No cache row exists for (account, lang) → 422 forcing GET first."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    # No _seed_content_plan_cache call — row absent.

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "en",
            "day_index": 2,
            "new_topic": "Edit before GET",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
    assert "content plan" in resp.json()["detail"].lower()


def test_update_content_plan_topic_arabic_pathway(client, db, insights_user):
    """AR language is keyed separately from EN — editing one must not touch the other."""
    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)
    _seed_content_plan_cache(db, account.id, language="en")
    _seed_content_plan_cache(db, account.id, language="ar")

    resp = client.patch(
        "/api/v1/ai-pages/content-plan/topic",
        json={
            "social_account_id": str(account.id),
            "language": "ar",
            "day_index": 4,
            "new_topic": "تنظيف المسبح في حر عمان",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    from app.models.ai_page_cache import AiPageCache
    db.expire_all()
    ar = db.query(AiPageCache).filter(
        AiPageCache.social_account_id == account.id,
        AiPageCache.language == "ar",
    ).first()
    en = db.query(AiPageCache).filter(
        AiPageCache.social_account_id == account.id,
        AiPageCache.language == "en",
    ).first()
    assert ar.content["topics_by_idx"]["4"] == "تنظيف المسبح في حر عمان"
    # EN row untouched
    assert en.content["topics_by_idx"]["4"] == "AI topic 4"


def test_content_plan_response_includes_scheduled_post_for_matching_day(
    client, db, insights_user,
):
    """GET /content-plan annotates each day with scheduled_post when one exists
    on that day's content_plan_day."""
    from datetime import date, datetime, timedelta, timezone
    from app.models.scheduled_post import ScheduledPost

    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=2)

    # Seed a scheduled post on day_index=2 (today + 2)
    target_date = date.today() + timedelta(days=2)
    sp = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_urls=["https://example.com/img.png"],
        media_type="image",
        caption_en="From the plan",
        status="scheduled",
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=2),
        content_plan_day=target_date,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)

    fake = {"topics": [{"day_index": i, "topic": f"T{i}"} for i in range(7)]}
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    days = resp.json()["data"]["days"]

    by_idx = {d["day_index"]: d for d in days}
    # Day 2 is annotated
    assert by_idx[2]["scheduled_post"] is not None
    assert by_idx[2]["scheduled_post"]["id"] == str(sp.id)
    assert by_idx[2]["scheduled_post"]["status"] == "scheduled"
    # Days without scheduled posts are explicitly null
    assert by_idx[0]["scheduled_post"] is None
    assert by_idx[6]["scheduled_post"] is None


def test_content_plan_response_omits_cancelled_scheduled_post(
    client, db, insights_user,
):
    """A cancelled scheduled_post should NOT light up the 'Scheduled ✓' badge."""
    from datetime import date, timedelta
    from app.models.scheduled_post import ScheduledPost

    _, org, token = insights_user
    ensure_feature_flag(db, "insights", "content_recommendations", True)
    account = seed_social_account_with_posts(db, org.id, num_posts=1)

    target_date = date.today() + timedelta(days=1)
    sp = ScheduledPost(
        organization_id=org.id,
        social_account_id=account.id,
        media_urls=[],
        status="cancelled",
        content_plan_day=target_date,
    )
    db.add(sp)
    db.commit()

    fake = {"topics": [{"day_index": i, "topic": f"T{i}"} for i in range(7)]}
    with mock_gemini(json_response=fake):
        resp = client.get(
            "/api/v1/ai-pages/content-plan",
            headers={"Authorization": f"Bearer {token}"},
        )
    days = resp.json()["data"]["days"]
    # Day 1 should still be null — cancelled doesn't count
    by_idx = {d["day_index"]: d for d in days}
    assert by_idx[1]["scheduled_post"] is None
