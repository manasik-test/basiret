"""Tests for the Brand Identity feature.

Covers the three /auth/brand-identity endpoints (GET, PUT, POST detect),
the cache-busting behavior on PUT, and the fallback paths in the detect
endpoint when posts/categories are unavailable.
"""
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from app.models.organization import Organization
from app.models.ai_page_cache import AiPageCache
from app.models.insight_result import InsightResult
from app.models.post import Post, ContentType, LanguageCode
from app.models.social_account import SocialAccount, Platform


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_get_brand_identity_default(client, starter_user):
    """An org that has never saved brand identity returns the defaults."""
    _user, _org, token = starter_user
    res = client.get("/api/v1/auth/brand-identity", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()["data"]
    # Spec defaults: bilingual / friendly / occasionally / medium etc.
    assert data["primary_color"] == "#664FA1"
    assert data["secondary_color"] == "#BF499B"
    assert data["tone"] == "friendly"
    assert data["language_style"] == "bilingual"
    assert data["emoji_usage"] == "occasionally"
    assert data["caption_length"] == "medium"
    assert data["content_pillars"] == []
    assert data["image_style"] == "clean"
    assert data["detected_from_posts"] is False


def test_put_brand_identity_persists(client, starter_user, db):
    """PUT then GET roundtrip returns the saved values."""
    _user, org, token = starter_user
    payload = {
        "primary_color": "#112233",
        "secondary_color": "#445566",
        "tone": "luxurious",
        "language_style": "formal_arabic",
        "emoji_usage": "never",
        "caption_length": "long",
        "content_pillars": ["Behind the scenes", "Customer stories"],
        "image_style": "minimal",
        "detected_from_posts": False,
    }
    put_res = client.put(
        "/api/v1/auth/brand-identity",
        json=payload,
        headers=_auth(token),
    )
    assert put_res.status_code == 200
    saved = put_res.json()["data"]
    assert saved["tone"] == "luxurious"
    assert saved["content_pillars"] == ["Behind the scenes", "Customer stories"]

    # Roundtrip
    get_res = client.get("/api/v1/auth/brand-identity", headers=_auth(token))
    assert get_res.status_code == 200
    assert get_res.json()["data"]["tone"] == "luxurious"
    assert get_res.json()["data"]["primary_color"] == "#112233"

    # DB state confirms the JSONB write
    db.expire_all()
    fresh = db.query(Organization).filter(Organization.id == org.id).first()
    assert fresh.brand_identity["tone"] == "luxurious"


def test_put_validates_color_hex(client, starter_user):
    """Non-hex `primary_color` should fail validation with 422."""
    _user, _org, token = starter_user
    payload = {
        "primary_color": "red",  # invalid
        "secondary_color": "#445566",
        "tone": "friendly",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "medium",
        "content_pillars": [],
        "image_style": "clean",
    }
    res = client.put(
        "/api/v1/auth/brand-identity",
        json=payload,
        headers=_auth(token),
    )
    assert res.status_code == 422


def test_put_clamps_pillars_to_5(client, starter_user):
    """Sending more than 5 content_pillars trips Pydantic max_length=5."""
    _user, _org, token = starter_user
    payload = {
        "primary_color": "#664FA1",
        "secondary_color": "#BF499B",
        "tone": "friendly",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "medium",
        "content_pillars": [f"Pillar {i}" for i in range(7)],
        "image_style": "clean",
    }
    res = client.put(
        "/api/v1/auth/brand-identity",
        json=payload,
        headers=_auth(token),
    )
    # max_length is enforced at parse time → 422; the spec allowed either
    # clamping or rejecting. We reject — frontend already prevents this.
    assert res.status_code == 422


def test_detect_with_no_posts_returns_category_defaults(client, starter_user, db):
    """An org with a saved business category but no posts gets category-keyed
    defaults (source=category) rather than calling Gemini."""
    _user, org, token = starter_user
    # Save a business profile so the detect endpoint can read .category
    org_obj = db.query(Organization).filter(Organization.id == org.id).first()
    org_obj.business_profile = {
        "category": "restaurant_cafe",
        "city": "Dubai",
        "country": "AE",
        "audience_language": "both",
    }
    db.commit()

    res = client.post("/api/v1/auth/brand-identity/detect", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["source"] == "category"
    assert data["tone"] == "friendly"
    assert "Food showcase" in data["content_pillars"]


def test_detect_with_no_category_no_posts_returns_fallback(client, starter_user):
    """No business profile and no posts → bare DEFAULT_BRAND_IDENTITY."""
    _user, _org, token = starter_user
    res = client.post("/api/v1/auth/brand-identity/detect", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["source"] == "fallback"
    assert data["tone"] == "friendly"  # default
    assert data["content_pillars"] == []


def test_detect_does_not_persist(client, starter_user, db):
    """POST detect must not write to the DB — the user explicitly applies +
    saves via PUT."""
    _user, org, token = starter_user
    client.post("/api/v1/auth/brand-identity/detect", headers=_auth(token))
    db.expire_all()
    fresh = db.query(Organization).filter(Organization.id == org.id).first()
    assert fresh.brand_identity is None  # nothing saved


def test_detect_with_posts_calls_provider(client, starter_user, db):
    """When ≥3 captioned posts exist, the detect endpoint calls the provider
    and merges its response onto the defaults."""
    _user, org, token = starter_user
    uid = uuid.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"testuser_{uid}",
        access_token_encrypted="enc",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
    )
    db.add(account)
    db.flush()
    for i in range(5):
        db.add(Post(
            social_account_id=account.id,
            platform_post_id=f"p_{uid}_{i}",
            platform="instagram",
            content_type=ContentType.image,
            language=LanguageCode.en,
            caption=f"Post {i}: morning coffee and croissants ☕",
            posted_at=datetime.now(timezone.utc) - timedelta(days=i),
        ))
    db.commit()

    fake_resp = {
        "tone": "luxurious",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "short",
        "content_pillars": ["Morning rituals", "Coffee", "Pastries"],
        "image_style": "clean",
    }

    class _FakeProvider:
        def generate_json(self, *_args, **_kwargs):
            return fake_resp

    try:
        with patch("app.core.ai_provider.get_provider", return_value=_FakeProvider()):
            res = client.post(
                "/api/v1/auth/brand-identity/detect", headers=_auth(token)
            )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["source"] == "captions"
        assert data["tone"] == "luxurious"
        assert data["detected_from_posts"] is True
        assert "Morning rituals" in data["content_pillars"]
    finally:
        db.query(Post).filter(Post.social_account_id == account.id).delete()
        db.query(SocialAccount).filter(SocialAccount.id == account.id).delete()
        db.commit()


def test_brand_identity_requires_auth(client):
    """No bearer token → 401/403 (auth dependency rejects unauthenticated)."""
    res = client.get("/api/v1/auth/brand-identity")
    assert res.status_code in (401, 403)


def test_put_busts_ai_page_cache(client, starter_user, db):
    """Saving brand identity must purge cached Gemini output for the org."""
    _user, org, token = starter_user
    uid = uuid.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"u_{uid}",
        access_token_encrypted="enc",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
    )
    db.add(account)
    db.flush()
    cache_row = AiPageCache(
        social_account_id=account.id,
        page_name="posts-insights",
        language="en",
        content={"why_it_worked": "old"},
        generated_at=datetime.now(timezone.utc),
    )
    db.add(cache_row)
    db.commit()
    cache_id = cache_row.id

    payload = {
        "primary_color": "#664FA1",
        "secondary_color": "#BF499B",
        "tone": "friendly",
        "language_style": "bilingual",
        "emoji_usage": "occasionally",
        "caption_length": "medium",
        "content_pillars": ["Tips"],
        "image_style": "clean",
    }
    res = client.put(
        "/api/v1/auth/brand-identity", json=payload, headers=_auth(token)
    )
    assert res.status_code == 200

    db.expire_all()
    survivor = db.query(AiPageCache).filter(AiPageCache.id == cache_id).first()
    assert survivor is None

    # Clean up
    db.query(SocialAccount).filter(SocialAccount.id == account.id).delete()
    db.commit()


def test_put_busts_insight_result(client, starter_user, db):
    """Saving brand identity must purge weekly insights so 'Do This Today'
    refreshes against the new brand voice."""
    _user, org, token = starter_user
    uid = uuid.uuid4().hex[:8]
    account = SocialAccount(
        organization_id=org.id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"u_{uid}",
        access_token_encrypted="enc",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        is_active=True,
    )
    db.add(account)
    db.flush()
    insight = InsightResult(
        social_account_id=account.id,
        week_start=datetime.now(timezone.utc) - timedelta(days=7),
        summary="old summary",
        score=70,
        score_change=0,
        insights=[],
    )
    db.add(insight)
    db.commit()
    insight_id = insight.id

    payload = {
        "primary_color": "#664FA1",
        "secondary_color": "#BF499B",
        "tone": "playful",
        "language_style": "bilingual",
        "emoji_usage": "frequently",
        "caption_length": "short",
        "content_pillars": ["Memes"],
        "image_style": "vibrant",
    }
    res = client.put(
        "/api/v1/auth/brand-identity", json=payload, headers=_auth(token)
    )
    assert res.status_code == 200

    db.expire_all()
    survivor = db.query(InsightResult).filter(InsightResult.id == insight_id).first()
    assert survivor is None

    db.query(SocialAccount).filter(SocialAccount.id == account.id).delete()
    db.commit()
