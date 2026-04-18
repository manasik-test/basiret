"""
Instagram endpoints — OAuth flow + data sync.

GET  /auth-url   → returns the Meta OAuth authorization URL
GET  /callback   → exchanges code for long-lived token, stores in social_account
POST /sync       → triggers Celery task to fetch posts from Instagram
GET  /accounts   → list connected Instagram accounts
DELETE /accounts/:id → disconnect an Instagram account
"""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import encrypt_token
from app.models.user import User
from app.models.social_account import SocialAccount, Platform
from app.tasks.instagram_sync import sync_instagram_posts

router = APIRouter()

# ── Meta OAuth URLs ──────────────────────────────────────────
AUTH_BASE = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
LONG_LIVED_URL = "https://graph.instagram.com/access_token"
ME_URL = "https://graph.instagram.com/me"


@router.get("/auth-url")
def get_auth_url(user: User = Depends(get_current_user)):
    """Return the Instagram OAuth authorization URL."""
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        # `instagram_business_manage_comments` is required to read /{media-id}/comments.
        # Without it, comment fetching gracefully degrades (logged + skipped) so existing
        # tokens that only have `instagram_business_basic` keep working for post sync.
        "scope": "instagram_business_basic,instagram_business_manage_comments",
        "response_type": "code",
    }
    return {"url": f"{AUTH_BASE}?{urlencode(params)}"}


@router.get("/callback")
async def oauth_callback(
    code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exchange authorization code for a long-lived token and store it."""

    # 1. Exchange code → short-lived token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(TOKEN_URL, data={
            "client_id": settings.META_APP_ID,
            "client_secret": settings.META_APP_SECRET,
            "grant_type": "authorization_code",
            "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
            "code": code,
        })

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

    token_data = token_resp.json()
    short_token = token_data["access_token"]
    ig_user_id = str(token_data["user_id"])

    # 2. Exchange short-lived → long-lived token (60 days)
    async with httpx.AsyncClient() as client:
        ll_resp = await client.get(LONG_LIVED_URL, params={
            "grant_type": "ig_exchange_token",
            "client_secret": settings.META_APP_SECRET,
            "access_token": short_token,
        })

    if ll_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to obtain long-lived token")

    ll_data = ll_resp.json()
    long_token = ll_data["access_token"]
    expires_in = ll_data.get("expires_in", 5_184_000)  # default 60 days

    # 3. Fetch Instagram user profile
    async with httpx.AsyncClient() as client:
        me_resp = await client.get(ME_URL, params={
            "fields": "id,username",
            "access_token": long_token,
        })

    username = None
    if me_resp.status_code == 200:
        username = me_resp.json().get("username")

    # 4. Upsert social_account — scoped to the authenticated user's organization
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

    return {
        "success": True,
        "data": {
            "account_id": str(account.id),
            "platform": account.platform.value,
            "username": account.username,
            "token_expires_at": account.token_expires_at.isoformat(),
        },
    }


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
        test_account = SocialAccount(
            platform=Platform.instagram,
            platform_account_id="test_user",
            username="test_user",
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
