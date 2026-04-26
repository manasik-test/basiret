"""
Instagram endpoints — OAuth flow + data sync.

GET  /auth-url   → returns the Meta OAuth authorization URL
GET  /callback   → exchanges code for long-lived token, stores in social_account
POST /sync       → triggers Celery task to fetch posts from Instagram
GET  /accounts   → list connected Instagram accounts
DELETE /accounts/:id → disconnect an Instagram account
"""
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import encrypt_token
from app.core.security import create_oauth_state_token, decode_token
from app.models.user import User
from app.models.social_account import SocialAccount, Platform
from app.tasks.instagram_sync import sync_instagram_posts

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Meta OAuth URLs ──────────────────────────────────────────
AUTH_BASE = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
LONG_LIVED_URL = "https://graph.instagram.com/access_token"
ME_URL = "https://graph.instagram.com/me"


def _settings_redirect(status: str) -> RedirectResponse:
    """Send the browser back to the Settings page with a status flag.

    Used by the public OAuth callback to surface success/failure to the SPA
    without exposing JSON to the user's address bar.
    """
    return RedirectResponse(
        f"{settings.FRONTEND_URL}/settings?ig={status}",
        status_code=302,
    )


@router.get("/auth-url")
def get_auth_url(user: User = Depends(get_current_user)):
    """Return the Instagram OAuth authorization URL.

    The `state` param is a single-purpose, short-lived JWT that lets the public
    /callback identify the user without requiring a session token (Meta strips
    custom headers on its redirect). The token is `type=oauth_state` so even
    if leaked it can't be used against authenticated endpoints.
    """
    state = create_oauth_state_token(str(user.id))
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        # `instagram_business_manage_comments` is required to read /{media-id}/comments.
        # `instagram_business_manage_insights` is required to read /{media-id}/insights
        # (reach, views, shares, saved). Both gracefully degrade in instagram_sync.py
        # (logged + skipped) so existing tokens missing either scope keep working for
        # the parts they still cover.
        "scope": "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_insights",
        "response_type": "code",
        "state": state,
    }
    return {"url": f"{AUTH_BASE}?{urlencode(params)}"}


@router.get("/callback")
async def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Public OAuth callback. Identifies the user via the signed `state` JWT,
    exchanges the code for a long-lived token, then redirects to the SPA.

    No session auth — Meta calls this URL directly from the user's browser
    after consent and cannot attach our Bearer header.
    """
    # 0. User denied consent on Meta's screen
    if error or not code:
        logger.info("Instagram OAuth denied or missing code: error=%s", error)
        return _settings_redirect("denied")

    # 1. Verify state JWT → resolve user
    if not state:
        logger.warning("Instagram OAuth callback missing state param")
        return _settings_redirect("invalid_state")

    payload = decode_token(state)
    if payload is None or payload.get("type") != "oauth_state":
        logger.warning("Instagram OAuth state token invalid or expired")
        return _settings_redirect("invalid_state")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None or not user.is_active:
        logger.warning("Instagram OAuth state references unknown/inactive user: %s", payload.get("sub"))
        return _settings_redirect("user_not_found")

    # 2. Exchange code → short-lived token
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(TOKEN_URL, data={
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                "code": code,
            })

        if token_resp.status_code != 200:
            logger.error("Instagram code exchange failed: %s %s", token_resp.status_code, token_resp.text)
            return _settings_redirect("exchange_failed")

        token_data = token_resp.json()
        short_token = token_data["access_token"]
        ig_user_id = str(token_data["user_id"])

        # 3. Exchange short-lived → long-lived token (60 days)
        async with httpx.AsyncClient() as client:
            ll_resp = await client.get(LONG_LIVED_URL, params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.META_APP_SECRET,
                "access_token": short_token,
            })

        if ll_resp.status_code != 200:
            logger.error("Instagram long-lived exchange failed: %s %s", ll_resp.status_code, ll_resp.text)
            return _settings_redirect("exchange_failed")

        ll_data = ll_resp.json()
        long_token = ll_data["access_token"]
        expires_in = ll_data.get("expires_in", 5_184_000)  # default 60 days

        # 4. Fetch Instagram user profile
        async with httpx.AsyncClient() as client:
            me_resp = await client.get(ME_URL, params={
                "fields": "id,username",
                "access_token": long_token,
            })

        username = None
        if me_resp.status_code == 200:
            username = me_resp.json().get("username")
    except httpx.HTTPError as e:
        logger.exception("Instagram OAuth network failure: %s", e)
        return _settings_redirect("exchange_failed")

    # 5. Upsert social_account — scoped to the resolved user's organization
    account = db.query(SocialAccount).filter_by(
        platform=Platform.instagram,
        platform_account_id=ig_user_id,
        organization_id=user.organization_id,
    ).first()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    encrypted = encrypt_token(long_token)

    if account:
        account.access_token_encrypted = encrypted
        account.token_expires_at = token_expires_at
        account.username = username or account.username
        account.is_active = True
    else:
        account = SocialAccount(
            platform=Platform.instagram,
            platform_account_id=ig_user_id,
            username=username,
            access_token_encrypted=encrypted,
            token_expires_at=token_expires_at,
            organization_id=user.organization_id,
        )
        db.add(account)

    db.commit()
    db.refresh(account)
    logger.info("Instagram account connected: org=%s account_id=%s username=%s", user.organization_id, account.id, username)

    return _settings_redirect("connected")


@router.post("/sync")
def trigger_sync(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger Instagram post sync for the user's organization accounts.

    For dev/testing: if no accounts exist yet, creates one using
    INSTAGRAM_TEST_TOKEN from .env so the pipeline can be tested.
    """
    accounts = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
        SocialAccount.platform == Platform.instagram,
        SocialAccount.is_active == True,
    ).all()

    # Dev convenience: bootstrap a test account if none exist
    if not accounts and settings.INSTAGRAM_TEST_TOKEN:
        # Pull the real username + IG user id from /me so the seeded row matches
        # the account the token actually points at. Fall back to placeholders if
        # the API is unreachable (dev offline) — the row is still usable for tests.
        ig_user_id = "test_user"
        ig_username = "test_user"
        try:
            with httpx.Client(timeout=10) as client:
                me_resp = client.get(ME_URL, params={
                    "fields": "id,username",
                    "access_token": settings.INSTAGRAM_TEST_TOKEN,
                })
            if me_resp.status_code == 200:
                me = me_resp.json()
                ig_user_id = str(me.get("id") or ig_user_id)
                ig_username = me.get("username") or ig_username
            else:
                logger.warning(
                    "Bootstrap /me failed (%s): %s — falling back to placeholders",
                    me_resp.status_code, me_resp.text[:200],
                )
        except httpx.HTTPError as exc:
            logger.warning("Bootstrap /me network error: %s — falling back to placeholders", exc)

        test_account = SocialAccount(
            platform=Platform.instagram,
            platform_account_id=ig_user_id,
            username=ig_username,
            access_token_encrypted=encrypt_token(settings.INSTAGRAM_TEST_TOKEN),
            token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
            organization_id=user.organization_id,
        )
        db.add(test_account)
        db.commit()
        db.refresh(test_account)
        accounts = [test_account]

    if not accounts:
        raise HTTPException(status_code=404, detail="No active Instagram accounts found")

    task_ids = []
    for account in accounts:
        task = sync_instagram_posts.delay(str(account.id))
        task_ids.append({"account_id": str(account.id), "task_id": task.id})

    return {"success": True, "data": {"tasks": task_ids}}


@router.delete("/accounts/{account_id}")
def disconnect_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect (deactivate) an Instagram account."""
    account = db.query(SocialAccount).filter(
        SocialAccount.id == account_id,
        SocialAccount.organization_id == user.organization_id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account.is_active = False
    db.commit()
    return {"success": True, "data": None}
