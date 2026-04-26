"""
Auth endpoints.

POST   /register                  — create user + organization, return tokens
POST   /login                     — authenticate, return access token + cookie
POST   /refresh                   — rotate access token using refresh cookie
POST   /logout                    — blacklist refresh token in Redis
GET    /me                        — return current user profile
PATCH  /profile                   — update current user's full_name
POST   /change-password           — verify current pw, set new, rotate refresh
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
)
from app.core.deps import get_current_user
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.subscription import Subscription
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


class DeleteAccountRequest(BaseModel):
    password: str


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
    db.commit()
    db.refresh(user.organization)
    return {"success": True, "data": user.organization.business_profile}


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
