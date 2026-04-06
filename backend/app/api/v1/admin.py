"""
Admin endpoints — system_admin only.

GET   /users        — list all users
PATCH /users/:id    — update user (role, is_active)
GET   /orgs         — list all organizations
GET   /flags        — list all feature flags
PATCH /flags/:id    — toggle a feature flag
GET   /health       — system health check
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_system_admin
from app.models.user import User, UserRole
from app.models.organization import Organization
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
