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
