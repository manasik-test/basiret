"""
Auth endpoints.

POST   /register                  — create user + organization, return tokens
POST   /login                     — authenticate, return access token + cookie
POST   /refresh                   — rotate access token using refresh cookie
POST   /logout                    — blacklist refresh token in Redis
GET    /me                        — return current user profile
PATCH  /profile                   — update current user's full_name
POST   /change-password           — verify current pw, set new, rotate refresh
POST   /forgot-password           — issue Redis-stored reset token, email link
POST   /reset-password            — validate token, update password
DELETE /account                   — user-initiated account deletion
POST   /data-deletion-callback    — Meta-initiated deletion (signed request)
"""
import base64
import hashlib
import hmac
import json
import logging
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    blacklist_refresh_token,
    is_token_blacklisted,
    get_redis,
)
from app.core.deps import get_current_user
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.subscription import Subscription
from app.models.social_account import SocialAccount
from app.models.post import Post
from app.models.ai_page_cache import AiPageCache
from app.models.insight_result import InsightResult
from app.tasks.account_deletion import (
    delete_user_or_org,
    delete_data_for_meta_user_id,
)

logger = logging.getLogger(__name__)

router = APIRouter()

REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


# ── Schemas ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str


# Redis key prefix for password-reset tokens. Value = user_id (string UUID).
# TTL is enforced at SETEX time (15 minutes).
RESET_TOKEN_KEY_PREFIX = "pwreset:"
RESET_TOKEN_TTL_SECONDS = 15 * 60


# Allowed values are validated at schema level so future additions stay
# explicit. Frontend dropdowns are kept in sync with these literals.
BusinessCategory = Literal[
    "restaurant_cafe",
    "fashion_clothing",
    "beauty_salon",
    "fitness_gym",
    "real_estate",
    "retail_shop",
    "services",
    "other",
]

BusinessCountry = Literal[
    "AE",  # UAE
    "SA",  # Saudi Arabia
    "EG",  # Egypt
    "JO",  # Jordan
    "KW",  # Kuwait
    "QA",  # Qatar
    "BH",  # Bahrain
    "OM",  # Oman
    "TR",  # Turkey
    "SD",  # Sudan
    "OTHER",
]

AudienceLanguage = Literal["ar", "en", "both"]


class BusinessProfile(BaseModel):
    category: BusinessCategory
    city: str = Field(min_length=1, max_length=100)
    country: BusinessCountry
    audience_language: AudienceLanguage


# ── Brand identity ──────────────────────────────────────────

BrandTone = Literal["professional", "friendly", "luxurious", "playful", "inspiring"]
BrandLanguageStyle = Literal["formal_arabic", "casual_dialect", "bilingual"]
BrandEmojiUsage = Literal["never", "occasionally", "frequently"]
BrandCaptionLength = Literal["short", "medium", "long"]
BrandImageStyle = Literal["clean", "vibrant", "minimal", "luxurious", "playful"]

# Hex-color regex covers #RRGGBB only (no shorthand, no alpha) — keeps the
# stored format predictable for the PDF report and CSS variable injection.
_HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"

DEFAULT_BRAND_IDENTITY: dict = {
    "primary_color": "#664FA1",
    "secondary_color": "#BF499B",
    "tone": "friendly",
    "language_style": "bilingual",
    "emoji_usage": "occasionally",
    "caption_length": "medium",
    "content_pillars": [],
    "image_style": "clean",
    "detected_from_posts": False,
}


class BrandIdentity(BaseModel):
    primary_color: str = Field(default="#664FA1", pattern=_HEX_COLOR_PATTERN)
    secondary_color: str = Field(default="#BF499B", pattern=_HEX_COLOR_PATTERN)
    tone: BrandTone = "friendly"
    language_style: BrandLanguageStyle = "bilingual"
    emoji_usage: BrandEmojiUsage = "occasionally"
    caption_length: BrandCaptionLength = "medium"
    content_pillars: list[str] = Field(default_factory=list, max_length=5)
    image_style: BrandImageStyle = "clean"
    detected_from_posts: bool = False

    @field_validator("content_pillars")
    @classmethod
    def _trim_pillars(cls, v: list[str]) -> list[str]:
        # Strip whitespace, drop empty strings, cap each pillar at 60 chars and
        # the list at 5. Field(max_length=5) catches >5 at parse time, but we
        # also clamp post-trim in case stripping introduces empties.
        cleaned = [p.strip()[:60] for p in v if isinstance(p, str) and p.strip()]
        return cleaned[:5]


# Category-keyed defaults used when the user has fewer than 3 captioned posts
# and we can't ask Gemini to infer a brand voice. The mapping uses the
# canonical BusinessCategory enum values (NOT the shortened forms in the spec).
_CATEGORY_BRAND_DEFAULTS: dict[str, dict] = {
    "restaurant_cafe":  {"tone": "friendly",     "content_pillars": ["Food showcase", "Daily specials", "Behind the scenes"]},
    "fashion_clothing": {"tone": "inspiring",    "content_pillars": ["New arrivals", "Style tips", "Customer looks"]},
    "beauty_salon":     {"tone": "luxurious",    "content_pillars": ["Transformations", "Tips", "Before & after"]},
    "fitness_gym":      {"tone": "inspiring",    "content_pillars": ["Workouts", "Nutrition", "Client results"]},
    "retail_shop":      {"tone": "friendly",     "content_pillars": ["New products", "Offers", "Customer stories"]},
    "services":         {"tone": "professional", "content_pillars": ["Case studies", "Tips", "Testimonials"]},
    "real_estate":      {"tone": "professional", "content_pillars": ["Listings", "Market tips", "Client stories"]},
    "other":            {"tone": "friendly",     "content_pillars": ["Behind the scenes", "Tips", "Promotions"]},
}


# ── Helpers ─────────────────────────────────────────────────

def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT != "development",
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/v1/auth")


# ── Endpoints ───────────────────────────────────────────────

@router.post("/register")
def register(body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Create a new user and organization. Returns access token + sets refresh cookie."""

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create organization
    slug = _slugify(body.organization_name)
    existing_slug = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_slug:
        slug = f"{slug}-{str(id(body))[-6:]}"

    org = Organization(name=body.organization_name, slug=slug)
    db.add(org)
    db.flush()

    # Create user as admin of the new org
    user = User(
        organization_id=org.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.admin,
    )
    db.add(user)
    db.flush()

    # Create starter subscription
    sub = Subscription(organization_id=org.id)
    db.add(sub)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(str(user.id), str(org.id), user.role.value)
    refresh_token, _ = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "organization_id": str(org.id),
                "organization_name": org.name,
            },
        },
    }


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate user. Returns access token + sets httpOnly refresh cookie."""

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    access_token = create_access_token(str(user.id), str(user.organization_id), user.role.value)
    refresh_token, _ = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "organization_id": str(user.organization_id),
                "organization_name": user.organization.name,
            },
        },
    }


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Issue a new access token using the refresh cookie."""

    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    payload = decode_token(token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = payload.get("jti")
    if not jti or is_token_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate: blacklist old, issue new
    blacklist_refresh_token(jti)
    access_token = create_access_token(str(user.id), str(user.organization_id), user.role.value)
    new_refresh, _ = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
        },
    }


@router.post("/logout")
def logout(request: Request, response: Response):
    """Blacklist the refresh token and clear the cookie."""

    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        payload = decode_token(token)
        if payload and payload.get("jti"):
            blacklist_refresh_token(payload["jti"])

    _clear_refresh_cookie(response)
    return {"success": True, "data": None}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """Return current authenticated user profile."""
    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "organization_id": str(user.organization_id),
            "organization_name": user.organization.name,
            "business_profile": user.organization.business_profile,
            # "Generate all 7 posts" remember-my-choice preference. When both
            # are set, the frontend can skip the confirmation dialog and go
            # straight to a batch run with the saved action.
            "batch_generate_default_action": user.batch_generate_default_action,
            "batch_generate_remember": bool(user.batch_generate_remember),
        },
    }


@router.get("/business-profile")
def get_business_profile(user: User = Depends(get_current_user)):
    """Return the current organization's business profile (or null if not set)."""
    return {"success": True, "data": user.organization.business_profile}


@router.put("/business-profile")
def upsert_business_profile(
    body: BusinessProfile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or update the current organization's business profile.

    Anyone in the org with a valid session can call this — onboarding-step-2
    runs before any role assignment beyond the auto-admin from /register.
    """
    user.organization.business_profile = body.model_dump()
    # Bust AI caches — business_profile is injected into Gemini prompts.
    _bust_ai_caches_for_org(db, user.organization_id)
    db.commit()
    db.refresh(user.organization)
    return {"success": True, "data": user.organization.business_profile}


# ── Brand identity endpoints ────────────────────────────────


def _merge_default(payload: dict | None) -> dict:
    """Merge a stored brand_identity dict on top of the spec's defaults.

    Returning the merged value rather than the raw column means that adding a
    new field to DEFAULT_BRAND_IDENTITY (e.g. a future `voice_keywords` field)
    keeps the API response schema stable for orgs whose stored JSONB pre-dates
    the field.
    """
    merged = dict(DEFAULT_BRAND_IDENTITY)
    if payload:
        merged.update({k: v for k, v in payload.items() if v is not None})
    return merged


@router.get("/brand-identity")
def get_brand_identity(user: User = Depends(get_current_user)):
    """Return the current organization's brand identity, falling back to
    DEFAULT_BRAND_IDENTITY when nothing has been saved."""
    return {"success": True, "data": _merge_default(user.organization.brand_identity)}


def _bust_ai_caches_for_org(db: Session, organization_id) -> None:
    """Delete all cached Gemini output that depends on brand voice for the
    given org's social accounts.

    Brand identity feeds into every AI surface: caption generation, posts
    insights, audience insights, content plan, sentiment responses, the
    weekly insight_result that powers the Home dashboard, AND the persona
    prose embedded in audience_segment rows. Stale cache after a brand-voice
    change would mask the user's update for up to 24-72h on the page caches
    and indefinitely on segments (they only refresh on Regenerate Segments).
    """
    from app.models.audience_segment import AudienceSegment

    # Materialize the account IDs once and reuse — SQLAlchemy 2.x prefers a
    # plain list to .in_() over a Subquery (the latter triggers a coercion
    # warning and forces a DELETE…WHERE id IN (SELECT…) plan we don't need
    # for the small per-org account count).
    account_ids = [
        a.id
        for a in db.query(SocialAccount.id)
        .filter(SocialAccount.organization_id == organization_id)
        .all()
    ]
    if not account_ids:
        return
    db.query(AiPageCache).filter(
        AiPageCache.social_account_id.in_(account_ids)
    ).delete(synchronize_session=False)
    db.query(InsightResult).filter(
        InsightResult.social_account_id.in_(account_ids)
    ).delete(synchronize_session=False)
    # audience_segment was added to the bust set 2026-05-15 (Bug 2 fix gap
    # surfaced in the three-bug diagnostic). Persona prose lives on these
    # rows and is otherwise only refreshed via the Regenerate Segments
    # button — without this delete, a brand-voice change would leave stale
    # persona prose visible until the user explicitly regenerated.
    db.query(AudienceSegment).filter(
        AudienceSegment.social_account_id.in_(account_ids)
    ).delete(synchronize_session=False)


@router.put("/brand-identity")
def upsert_brand_identity(
    body: BrandIdentity,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save the organization's brand identity and bust dependent AI caches.

    Cache invalidation runs in the same transaction as the JSONB write so a
    failed flush rolls everything back — there's no half-state where the new
    brand identity is saved but the old cached insights are still being
    served.
    """
    user.organization.brand_identity = body.model_dump()
    _bust_ai_caches_for_org(db, user.organization_id)
    db.commit()
    db.refresh(user.organization)
    return {"success": True, "data": _merge_default(user.organization.brand_identity)}


def _detect_from_captions(captions: list[str]) -> dict | None:
    """Ask Gemini to infer brand voice from a sample of recent captions.

    Returns None if the AI provider call fails for any reason — the caller
    should fall back to category defaults so the user still sees a useful
    preview instead of a 500.
    """
    from app.core.ai_provider import AIProviderError, get_provider

    numbered = "\n".join(f"{i + 1}. {c.strip()}" for i, c in enumerate(captions))
    sys = (
        "You are a brand voice analyst. Given a sample of an Instagram "
        "creator's recent captions, infer their brand voice and return strict "
        "JSON. Be specific to what the captions actually show — do not guess. "
        "Return ONLY this JSON shape, no markdown: "
        '{"tone": "professional|friendly|luxurious|playful|inspiring", '
        '"language_style": "formal_arabic|casual_dialect|bilingual", '
        '"emoji_usage": "never|occasionally|frequently", '
        '"caption_length": "short|medium|long", '
        '"content_pillars": ["3 to 5 short pillar names"], '
        '"image_style": "clean|vibrant|minimal|luxurious|playful"}'
    )
    user_msg = f"Recent captions from this account:\n\n{numbered}"
    try:
        provider = get_provider("personas")
        return provider.generate_json(sys, user_msg, temperature=0.2, source="background")
    except AIProviderError as exc:
        logger.warning("brand-identity detect: provider error: %s", exc)
        return None
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning("brand-identity detect: unexpected error: %s", exc)
        return None


def _coerce_detected(raw: dict) -> dict:
    """Normalize a Gemini detect response onto the BrandIdentity schema.

    Gemini sometimes returns extra keys, snake_cased variants, or values
    outside our literal sets (e.g. "neutral" for tone). Anything we don't
    recognize falls back to the default for that field, so the preview the
    user sees is always valid Pydantic input.
    """
    base = dict(DEFAULT_BRAND_IDENTITY)
    valid_tones = {"professional", "friendly", "luxurious", "playful", "inspiring"}
    valid_styles = {"formal_arabic", "casual_dialect", "bilingual"}
    valid_emoji = {"never", "occasionally", "frequently"}
    valid_lengths = {"short", "medium", "long"}
    valid_image = {"clean", "vibrant", "minimal", "luxurious", "playful"}

    tone = (raw.get("tone") or "").strip().lower()
    if tone in valid_tones:
        base["tone"] = tone
    style = (raw.get("language_style") or "").strip().lower()
    if style in valid_styles:
        base["language_style"] = style
    emoji = (raw.get("emoji_usage") or "").strip().lower()
    if emoji in valid_emoji:
        base["emoji_usage"] = emoji
    length = (raw.get("caption_length") or "").strip().lower()
    if length in valid_lengths:
        base["caption_length"] = length
    image = (raw.get("image_style") or "").strip().lower()
    if image in valid_image:
        base["image_style"] = image

    pillars_raw = raw.get("content_pillars") or []
    if isinstance(pillars_raw, list):
        cleaned = [str(p).strip()[:60] for p in pillars_raw if isinstance(p, (str, int, float)) and str(p).strip()]
        base["content_pillars"] = cleaned[:5]

    return base


@router.post("/brand-identity/detect")
def detect_brand_identity(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build a non-persistent preview of the org's brand identity.

    Strategy:
      1. If the org has ≥ 3 captioned posts on its first active social
         account, ask Gemini to infer voice/style/emoji/pillars from them.
      2. Otherwise, fall back to category defaults from
         _CATEGORY_BRAND_DEFAULTS layered onto DEFAULT_BRAND_IDENTITY.
      3. If neither is available, return the bare defaults.

    The endpoint never writes to the database — the frontend shows the
    preview, and the user explicitly applies + saves via PUT.
    """
    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active.is_(True),
        )
        .order_by(SocialAccount.connected_at.asc())
        .first()
    )

    captions: list[str] = []
    if account:
        rows = (
            db.query(Post.caption)
            .filter(
                Post.social_account_id == account.id,
                Post.caption.isnot(None),
            )
            .order_by(Post.posted_at.desc().nullslast())
            .limit(10)
            .all()
        )
        captions = [c for (c,) in rows if c and c.strip()]

    if len(captions) >= 3:
        detected = _detect_from_captions(captions)
        if detected:
            preview = _coerce_detected(detected)
            preview["detected_from_posts"] = True
            return {
                "success": True,
                "data": {**preview, "source": "captions"},
            }
        # Provider failure → fall through to category defaults instead of 500

    bp = user.organization.business_profile or {}
    category = bp.get("category") if isinstance(bp, dict) else None
    if category in _CATEGORY_BRAND_DEFAULTS:
        defaults = _CATEGORY_BRAND_DEFAULTS[category]
        preview = {**DEFAULT_BRAND_IDENTITY, **defaults, "detected_from_posts": False}
        return {"success": True, "data": {**preview, "source": "category"}}

    return {
        "success": True,
        "data": {**DEFAULT_BRAND_IDENTITY, "source": "fallback"},
    }


@router.patch("/profile")
def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile (full_name only for now)."""
    user.full_name = body.full_name.strip()
    db.commit()
    db.refresh(user)
    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "organization_id": str(user.organization_id),
            "organization_name": user.organization.name,
        },
    }


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify current password, update to new one, and rotate refresh token."""
    if not user.hashed_password or not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(body.new_password)
    db.commit()

    # Rotate refresh token: blacklist the old one (if present), issue a new cookie
    old_token = request.cookies.get(REFRESH_COOKIE)
    if old_token:
        payload = decode_token(old_token)
        if payload and payload.get("jti"):
            blacklist_refresh_token(payload["jti"])

    new_refresh, _ = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)

    return {"success": True, "data": None}


# ── Forgot / Reset password ─────────────────────────────────

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Issue a single-use reset token for the given email.

    Always returns 200 with the same body so callers cannot enumerate which
    emails are registered. The token is a 32-byte URL-safe random string
    stored in Redis at ``pwreset:<token>`` with a 15-minute TTL; the value is
    the user's UUID. We do NOT key by user_id — a fresh token must invalidate
    the previous one only if used, so collisions across requests are fine.

    No SMTP wiring lives in this codebase yet; until it does, the reset URL
    is logged at INFO level. The frontend can consume this URL straight from
    the dev logs during local testing.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        redis = get_redis()
        redis.setex(
            f"{RESET_TOKEN_KEY_PREFIX}{token}",
            RESET_TOKEN_TTL_SECONDS,
            str(user.id),
        )
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        # Until SMTP is wired up, surface the URL only in server logs. Never
        # echo it back in the HTTP response — that would let any client
        # request password resets for arbitrary emails.
        logger.info(
            "password reset requested",
            extra={"user_id": str(user.id), "email": user.email, "reset_url": reset_url},
        )
    return {"success": True, "data": None}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validate the reset token and update the user's password.

    The token is consumed atomically (GETDEL) so a captured token cannot be
    replayed. All active refresh tokens for the user are NOT explicitly
    blacklisted — there's no index from user_id → jti — but any session that
    relied on the old password gets a 401 the next time the user actively
    uses the new password elsewhere. The 30-day rolling refresh cookie is
    acceptable risk for an MVP.
    """
    redis = get_redis()
    redis_key = f"{RESET_TOKEN_KEY_PREFIX}{body.token}"

    # GETDEL: atomic read-and-delete. If the token was already used or
    # expired, this returns None and we 400 with a generic message.
    user_id = redis.execute_command("GETDEL", redis_key)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if isinstance(user_id, bytes):
        user_id = user_id.decode("utf-8")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(body.new_password)
    db.commit()

    logger.info("password reset completed", extra={"user_id": str(user.id)})
    return {"success": True, "data": None}


# ── Account deletion (user-initiated) ────────────────────────

@router.delete("/account")
def delete_account(
    body: DeleteAccountRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the calling user's account.

    Requires the current password as a confirmation step. If the user is the
    last active admin of their organisation, the entire organisation is
    deleted (Postgres ON DELETE CASCADE chains this through every child
    table). Otherwise just the user row is deleted; the org and remaining
    members stay intact.

    The refresh token is blacklisted so any in-flight token can't continue
    the session, and the cookie is cleared.
    """
    if not user.hashed_password or not verify_password(body.password, user.hashed_password):
        # 403 (not 401) because the JWT was valid; what failed was the
        # explicit deletion confirmation. Meta's bar for destructive
        # actions is a step-up auth, which this is.
        raise HTTPException(status_code=403, detail="Password is incorrect")

    # Blacklist the refresh token BEFORE deletion so a slow Redis write
    # can't leave a usable token after the row is gone.
    old_token = request.cookies.get(REFRESH_COOKIE)
    if old_token:
        payload = decode_token(old_token)
        if payload and payload.get("jti"):
            blacklist_refresh_token(payload["jti"])

    outcome = delete_user_or_org(db, user)
    _clear_refresh_cookie(response)
    logger.info("user-initiated deletion: outcome=%s user_id=%s", outcome, user.id)
    return {"success": True, "data": {"outcome": outcome}}


# ── Meta Data Deletion Callback ──────────────────────────────

def _b64url_decode(segment: str) -> bytes:
    """Base64url-decode a segment, repadding as needed.

    Meta strips the `=` padding from each segment of a signed_request, so we
    re-add it before decoding. RFC 4648 §5 spec.
    """
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def _parse_meta_signed_request(signed_request: str, app_secret: str) -> dict | None:
    """Verify and parse Meta's `signed_request` payload.

    Format: ``<base64url(signature)>.<base64url(json_payload)>``
    Signature is HMAC-SHA256 of the raw payload string (the second segment,
    pre-decode) using the app secret. Returns the decoded JSON dict on
    success, or None on any verification failure.
    """
    try:
        sig_segment, payload_segment = signed_request.split(".", 1)
    except ValueError:
        return None

    try:
        signature = _b64url_decode(sig_segment)
    except (ValueError, base64.binascii.Error):  # type: ignore[attr-defined]
        return None

    expected = hmac.new(
        app_secret.encode("utf-8"),
        payload_segment.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        payload_bytes = _b64url_decode(payload_segment)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None

    if payload.get("algorithm", "").upper() != "HMAC-SHA256":
        return None
    return payload


@router.post("/data-deletion-callback")
async def data_deletion_callback(request: Request):
    """Meta-initiated account deletion callback.

    Meta posts ``application/x-www-form-urlencoded`` with a single field
    ``signed_request`` that contains a Meta-scoped ``user_id`` plus a
    timestamp, all HMAC-SHA256-signed with our App Secret. We must respond
    immediately with ``{url, confirmation_code}`` and perform the actual
    deletion asynchronously — the callback is rate-limited and Meta retries
    aggressively if we hold the connection.

    The returned ``url`` is shown to the user inside Meta's settings so they
    can verify the deletion request was received and track progress.
    """
    form = await request.form()
    signed_request = form.get("signed_request")
    if not isinstance(signed_request, str) or not signed_request:
        raise HTTPException(status_code=400, detail="Missing signed_request")

    payload = _parse_meta_signed_request(signed_request, settings.META_APP_SECRET)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid signed_request")

    meta_user_id = str(payload.get("user_id") or "").strip()
    if not meta_user_id:
        raise HTTPException(status_code=400, detail="Missing user_id in signed_request")

    # Hand off to Celery so we return inside Meta's response budget.
    delete_data_for_meta_user_id.delay(meta_user_id)

    confirmation_code = secrets.token_hex(16)
    logger.info(
        "meta deletion callback queued",
        extra={"meta_user_id": meta_user_id, "code": confirmation_code},
    )
    return {
        "url": f"{settings.FRONTEND_URL.rstrip('/')}/deletion-status?id={confirmation_code}",
        "confirmation_code": confirmation_code,
    }
