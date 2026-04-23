"""
Admin endpoints — system_admin only.

GET   /users        — list all users
PATCH /users/:id    — update user (role, is_active)
GET   /orgs         — list all organizations
GET   /flags        — list all feature flags
PATCH /flags/:id    — toggle a feature flag
GET   /ai-usage     — per-account AI call counts (last 7 days)
GET   /health       — system health check
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_system_admin
from app.models.ai_usage_log import AiUsageLog
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.social_account import SocialAccount
from app.models.subscription import Subscription
from app.models.feature_flag import FeatureFlag

router = APIRouter()


class UpdateUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class UpdateFlagRequest(BaseModel):
    is_enabled: bool


@router.get("/users")
def list_users(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """List all users with organization info."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "success": True,
        "data": {
            "users": [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "full_name": u.full_name,
                    "role": u.role.value,
                    "is_active": u.is_active,
                    "organization_id": str(u.organization_id),
                    "organization_name": u.organization.name if u.organization else None,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in users
            ],
        },
    }


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserRequest,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Update a user's role or active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        try:
            user.role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    if body.is_active is not None:
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
        },
    }


@router.get("/orgs")
def list_orgs(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """List all organizations with subscription info."""
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    result = []
    for org in orgs:
        sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
        user_count = db.query(User).filter(User.organization_id == org.id).count()
        result.append({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "plan_tier": sub.plan_tier.value if sub else "starter",
            "user_count": user_count,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        })

    return {"success": True, "data": {"organizations": result}}


@router.get("/flags")
def list_flags(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """List all feature flags."""
    flags = db.query(FeatureFlag).order_by(FeatureFlag.plan_tier, FeatureFlag.feature_name).all()
    return {
        "success": True,
        "data": {
            "flags": [
                {
                    "id": str(f.id),
                    "plan_tier": f.plan_tier,
                    "feature_name": f.feature_name,
                    "is_enabled": f.is_enabled,
                }
                for f in flags
            ],
        },
    }


@router.patch("/flags/{flag_id}")
def update_flag(
    flag_id: str,
    body: UpdateFlagRequest,
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Toggle a feature flag."""
    flag = db.query(FeatureFlag).filter(FeatureFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    flag.is_enabled = body.is_enabled
    db.commit()
    db.refresh(flag)

    return {
        "success": True,
        "data": {
            "id": str(flag.id),
            "plan_tier": flag.plan_tier,
            "feature_name": flag.feature_name,
            "is_enabled": flag.is_enabled,
        },
    }


@router.get("/ai-usage")
def list_ai_usage(
    admin: User = Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    """Per-account AI provider usage for the past 7 days.

    Aggregates `ai_usage_log` rows by `social_account_id` and `provider`.
    Counts include both user and background source rows so the total reflects
    real cost incurred — admins can compare against the per-day rate limits
    in `settings.AI_*_DAILY_LIMIT_PER_ACCOUNT` to spot heavy users.

    Accounts that exist but have no AI calls in the window are omitted.
    """
    since = datetime.now(timezone.utc) - timedelta(days=7)

    rows = (
        db.query(
            AiUsageLog.social_account_id,
            AiUsageLog.provider,
            func.count(AiUsageLog.id).label("calls"),
        )
        .filter(AiUsageLog.called_at >= since)
        .group_by(AiUsageLog.social_account_id, AiUsageLog.provider)
        .all()
    )

    by_account: dict[str | None, dict] = {}
    for account_id, provider, calls in rows:
        key = str(account_id) if account_id else None
        bucket = by_account.setdefault(
            key, {"gemini_calls_7d": 0, "openai_calls_7d": 0},
        )
        if provider == "gemini":
            bucket["gemini_calls_7d"] = int(calls)
        elif provider == "openai":
            bucket["openai_calls_7d"] = int(calls)

    # Hydrate account_id → username + org name in one query.
    account_ids = [aid for aid in by_account if aid]
    account_meta: dict[str, dict] = {}
    if account_ids:
        joined = (
            db.query(SocialAccount.id, SocialAccount.username, Organization.name)
            .join(Organization, Organization.id == SocialAccount.organization_id)
            .filter(SocialAccount.id.in_(account_ids))
            .all()
        )
        for sid, username, org_name in joined:
            account_meta[str(sid)] = {
                "username": username,
                "org_name": org_name,
            }

    accounts = []
    for key, totals in by_account.items():
        meta = account_meta.get(key, {}) if key else {}
        accounts.append({
            "account_id": key,
            "username": meta.get("username"),
            "org_name": meta.get("org_name"),
            **totals,
        })

    accounts.sort(
        key=lambda a: a["gemini_calls_7d"] + a["openai_calls_7d"],
        reverse=True,
    )

    return {"success": True, "data": {"accounts": accounts}}
