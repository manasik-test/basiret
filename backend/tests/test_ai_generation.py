"""
Sprint 4 — AI image generation + vision analysis tests.

Covers:
  * POST /creator/analyze-image — GPT-4o Vision, mocked at the
    `app.core.ai_image.openai_analyze_image_url`-equivalent boundary so we
    don't hit the network.
  * POST /creator/generate-image — DALL-E 3 prompt assembly + R2 upload +
    ai_usage_log row + billing-limit error mapping.
  * POST /ai-pages/generate-caption — IMAGE ANALYSIS block injected into
    the Gemini system prompt when `image_analysis` is supplied.
"""
from unittest.mock import MagicMock, patch

from app.core.ai_image import _map_openai_exception
from app.core.ai_provider import (
    AIBillingLimitError,
    AIProviderUnavailableError,
    AIQuotaExceededError,
)
from app.core.config import settings
from app.models.ai_usage_log import AiUsageLog
from app.models.organization import Organization

from tests.conftest import seed_social_account_with_posts


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Vision analysis ───────────────────────────────────────────────────────


def test_analyze_image_returns_structure(client, insights_user, db):
    """Mock GPT-4o Vision, assert the returned dict has every documented key."""
    _, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    fake_result = {
        "product_description": "A glass bottle of rose perfume with gold cap",
        "detected_style": "luxury",
        "dominant_colors": ["#F5E6D3", "#C9A96E"],
        "suggested_tone": "luxurious",
        "content_suggestions": ["Product showcase", "Gift idea", "Behind the scenes"],
    }
    with patch(
        "app.api.v1.posts_creator.openai_analyze_image_url",
        return_value=fake_result,
    ) as mock_vision:
        res = client.post(
            "/api/v1/creator/analyze-image",
            json={"image_url": "https://cdn.example/img.jpg"},
            headers=_auth(token),
        )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["meta"]["status"] == "fresh"
    data = body["data"]
    assert data["product_description"].startswith("A glass bottle")
    assert data["detected_style"] == "luxury"
    assert data["dominant_colors"] == ["#F5E6D3", "#C9A96E"]
    assert data["suggested_tone"] == "luxurious"
    assert data["content_suggestions"] == [
        "Product showcase", "Gift idea", "Behind the scenes",
    ]
    # Helper invoked exactly once with the URL we sent.
    assert mock_vision.call_count == 1
    args, kwargs = mock_vision.call_args
    assert args and args[0] == "https://cdn.example/img.jpg"


# ── DALL-E 3 image generation ─────────────────────────────────────────────


def test_generate_image_builds_correct_prompt(client, insights_user, db):
    """Brand identity (image_style, primary_color) + business profile + ratio
    framing must all land in the DALL-E prompt."""
    _, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    # Seed brand identity + business profile so the prompt has signals to
    # pull in.
    db_org = db.query(Organization).filter(Organization.id == org.id).first()
    assert db_org is not None
    db_org.brand_identity = {
        "primary_color": "#5433c2",
        "image_style": "luxurious",
        "tone": "luxurious",
    }
    db_org.business_profile = {"industry": "perfume", "city": "Riyadh"}
    db.commit()

    captured: dict = {}

    def _fake_generate(prompt, *, ratio, account_id, source):
        captured["prompt"] = prompt
        captured["ratio"] = ratio
        return {"url": "https://openai.example/dall-e-out.png", "revised_prompt": prompt, "size": "1024x1280"}

    fake_http_resp = MagicMock()
    fake_http_resp.content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    fake_http_resp.raise_for_status = MagicMock()
    fake_http_client = MagicMock()
    fake_http_client.__enter__ = MagicMock(return_value=fake_http_client)
    fake_http_client.__exit__ = MagicMock(return_value=False)
    fake_http_client.get = MagicMock(return_value=fake_http_resp)

    with patch("app.api.v1.posts_creator.generate_dalle_image", side_effect=_fake_generate), \
         patch("app.api.v1.posts_creator.upload_media", return_value="https://cdn.example/r2/x.png"), \
         patch("httpx.Client", return_value=fake_http_client):
        res = client.post(
            "/api/v1/creator/generate-image",
            json={
                "description": "Rose perfume on marble",
                "ratio": "4:5",
            },
            headers=_auth(token),
        )

    assert res.status_code == 200, res.text
    prompt = captured["prompt"]
    # Description leads.
    assert prompt.startswith("Rose perfume on marble")
    # Brand image_style descriptor present.
    assert "luxurious" in prompt.lower()
    # Primary color woven in.
    assert "#5433c2" in prompt
    # Business profile signals.
    assert "perfume" in prompt.lower()
    assert "Riyadh" in prompt
    # Ratio framing.
    assert "portrait" in prompt.lower() or "4:5" in prompt
    assert captured["ratio"] == "4:5"


def test_generate_image_uploads_to_r2(client, insights_user, db):
    """After DALL-E returns a URL, we download + re-upload via storage.upload_media."""
    _, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    fake_http_resp = MagicMock()
    fake_http_resp.content = b"binary-image-bytes"
    fake_http_resp.raise_for_status = MagicMock()
    fake_http_client = MagicMock()
    fake_http_client.__enter__ = MagicMock(return_value=fake_http_client)
    fake_http_client.__exit__ = MagicMock(return_value=False)
    fake_http_client.get = MagicMock(return_value=fake_http_resp)

    upload_calls: list = []

    def _spy_upload(payload, filename, content_type):
        upload_calls.append({
            "payload": payload, "filename": filename, "content_type": content_type,
        })
        return "https://cdn.example/r2/ai-generated.png"

    with patch(
        "app.api.v1.posts_creator.generate_dalle_image",
        return_value={
            "url": "https://openai.example/dalle.png",
            "revised_prompt": "...",
            "size": "1024x1024",
        },
    ), patch("app.api.v1.posts_creator.upload_media", side_effect=_spy_upload), \
         patch("httpx.Client", return_value=fake_http_client):
        res = client.post(
            "/api/v1/creator/generate-image",
            json={"description": "A cat in a hat", "ratio": "1:1"},
            headers=_auth(token),
        )
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["url"] == "https://cdn.example/r2/ai-generated.png"
    assert len(upload_calls) == 1
    assert upload_calls[0]["payload"] == b"binary-image-bytes"
    assert upload_calls[0]["content_type"] == "image/png"


def test_generate_image_logs_usage(client, insights_user, db):
    """A successful DALL-E call writes one ai_usage_log row with task='image_generation'."""
    _, org, token = insights_user
    account = seed_social_account_with_posts(db, org.id)

    # Reset the usage log for this account so the assertion is precise.
    db.query(AiUsageLog).filter(AiUsageLog.social_account_id == account.id).delete()
    db.commit()

    # The real ai_image.generate_dalle_image writes the usage log itself, so
    # patching it would skip the log row. Instead, drive the OpenAI client
    # one level down so the production code path runs end-to-end.
    fake_resp = MagicMock()
    fake_resp.data = [MagicMock(url="https://openai.example/dalle.png", revised_prompt="x")]
    fake_openai = MagicMock()
    fake_openai.images.generate = MagicMock(return_value=fake_resp)

    fake_http_resp = MagicMock()
    fake_http_resp.content = b"png-bytes"
    fake_http_resp.raise_for_status = MagicMock()
    fake_http_client = MagicMock()
    fake_http_client.__enter__ = MagicMock(return_value=fake_http_client)
    fake_http_client.__exit__ = MagicMock(return_value=False)
    fake_http_client.get = MagicMock(return_value=fake_http_resp)

    prior_key = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = "test-key"
    try:
        with patch("app.core.ai_image._openai_client", return_value=fake_openai), \
             patch("app.api.v1.posts_creator.upload_media", return_value="https://cdn.example/x.png"), \
             patch("httpx.Client", return_value=fake_http_client):
            res = client.post(
                "/api/v1/creator/generate-image",
                json={"description": "A landscape", "ratio": "16:9"},
                headers=_auth(token),
            )
    finally:
        settings.OPENAI_API_KEY = prior_key

    assert res.status_code == 200, res.text
    rows = (
        db.query(AiUsageLog)
        .filter(AiUsageLog.social_account_id == account.id)
        .all()
    )
    assert any(
        r.task == "image_generation" and r.provider == "openai" and r.tokens_used == 0
        for r in rows
    ), f"expected an image_generation usage row, got {[(r.task, r.provider, r.tokens_used) for r in rows]}"


# ── Caption with image analysis ───────────────────────────────────────────


def test_caption_with_image_analysis(client, starter_user):
    """When image_analysis is supplied, the IMAGE ANALYSIS block is injected
    into the Gemini system prompt so the caption can reference the picture."""
    _, _, token = starter_user
    captured: dict = {}

    class _SpyProvider:
        name = "spy"

        def generate_text(self, system, user, temperature=0.5, **_kwargs):
            captured["system"] = system
            captured["user"] = user
            return "Rose-gold dawn — the bottle catches the morning light. Ready? #perfume"

        def generate_json(self, *_args, **_kwargs):
            return {}

    image_analysis = {
        "product_description": "A glass bottle of rose perfume with gold cap",
        "detected_style": "luxury",
        "suggested_tone": "luxurious",
        "content_suggestions": ["Product showcase", "Gift idea", "Behind the scenes"],
        "dominant_colors": ["#F5E6D3"],
    }

    with patch("app.api.v1.ai_pages._gemini_available", return_value=True), \
         patch("app.api.v1.ai_pages.get_provider", return_value=_SpyProvider()):
        res = client.post(
            "/api/v1/ai-pages/generate-caption",
            json={
                "content_type": "image",
                "language": "en",
                "image_ratio": "1:1",
                "image_analysis": image_analysis,
            },
            headers=_auth(token),
        )

    assert res.status_code == 200, res.text
    system = captured.get("system", "")
    assert "IMAGE ANALYSIS:" in system
    assert "rose perfume" in system.lower()
    assert "Luxury" in system
    assert "Luxurious" in system
    # Content angle drawn from content_suggestions[0].
    assert "Product showcase" in system


# ── Error mapping ─────────────────────────────────────────────────────────


class _FakeBadRequestError(Exception):
    """Stand-in for openai.BadRequestError — we don't import the SDK class
    in tests because the mapper goes by class name, not by isinstance."""


_FakeBadRequestError.__name__ = "BadRequestError"


class _FakeRateLimit(Exception):
    pass


_FakeRateLimit.__name__ = "RateLimitError"


def test_billing_hard_limit_maps_to_billing_limit_error():
    """The exact OpenAI message we saw in prod logs must map to
    AIBillingLimitError, not the generic AIProviderUnavailableError."""
    exc = _FakeBadRequestError(
        "Error code: 400 - {'error': {'message': 'Billing hard limit has been "
        "reached', 'type': 'image_generation_user_error', 'param': None, "
        "'code': 'billing_hard_limit_reached'}}"
    )
    mapped = _map_openai_exception(exc)
    assert isinstance(mapped, AIBillingLimitError)
    assert "billing limit" in mapped.user_message.lower()


def test_rate_limit_still_maps_correctly():
    """Sanity check: rate-limit errors continue to map to AIQuotaExceededError
    (not the new billing bucket)."""
    exc = _FakeRateLimit("Rate limit reached")
    mapped = _map_openai_exception(exc)
    assert isinstance(mapped, AIQuotaExceededError)


def test_generate_image_billing_limit_returns_specific_message(client, insights_user, db):
    """End-to-end: when DALL-E returns a billing_hard_limit_reached error, the
    endpoint surfaces a 503 with the tailored billing-limit message — NOT the
    generic 'service temporarily unreachable' that confused users."""
    _, org, token = insights_user
    seed_social_account_with_posts(db, org.id)

    fake_openai = MagicMock()
    fake_openai.images.generate = MagicMock(
        side_effect=_FakeBadRequestError(
            "Error code: 400 - {'error': {'message': 'Billing hard limit has "
            "been reached', 'code': 'billing_hard_limit_reached'}}"
        ),
    )

    prior_key = settings.OPENAI_API_KEY
    settings.OPENAI_API_KEY = "test-key"
    try:
        with patch("app.core.ai_image._openai_client", return_value=fake_openai):
            res = client.post(
                "/api/v1/creator/generate-image",
                json={"description": "Anything", "ratio": "1:1"},
                headers=_auth(token),
            )
    finally:
        settings.OPENAI_API_KEY = prior_key

    assert res.status_code == 503
    body = res.json()
    assert body["success"] is False
    assert body["meta"]["status"] == "degraded"
    msg = body["meta"]["message"].lower()
    assert "billing limit" in msg, f"expected billing-specific message, got: {msg}"
    # Must NOT be the generic unavailability message — that's what users saw
    # before this fix and is what we're regression-testing against.
    assert "temporarily unreachable" not in msg
    # Sanity: ensure AIProviderUnavailableError is not what got returned.
    assert AIProviderUnavailableError.user_message.lower() not in msg
