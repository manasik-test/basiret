"""
FastAPI dependencies for authentication, authorization, and feature flags.
"""
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole
from app.models.subscription import Subscription
from app.models.feature_flag import FeatureFlag

bearer_scheme = HTTPBearer()


# ── Current user from JWT ───────────────────────────────────

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(creds.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


# ── Role guards ─────────────────────────────────────────────

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.admin, UserRole.system_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_system_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.system_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System admin access required")
    return user


def require_admin_or_manager(user: User = Depends(get_current_user)) -> User:
    """Gate for content-mutation actions on an organization's own assets.

    Excludes both `viewer` (read-only) and `system_admin` (cross-org operator,
    not a content owner). First introduced for PATCH /ai-pages/content-plan/topic.
    """
    if user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager role required",
        )
    return user


# ── Feature flag guard ──────────────────────────────────────

class RequireFeature:
    """Dependency that checks if a feature is enabled for the user's plan tier."""

    def __init__(self, feature_name: str):
        self.feature_name = feature_name

    def __call__(
        self,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        sub = db.query(Subscription).filter(
            Subscription.organization_id == user.organization_id,
        ).first()

        plan_tier = sub.plan_tier.value if sub else "starter"

        flag = db.query(FeatureFlag).filter(
            FeatureFlag.plan_tier == plan_tier,
            FeatureFlag.feature_name == self.feature_name,
        ).first()

        if not flag or not flag.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "Feature not available on your plan", "locked": True, "feature": self.feature_name},
            )
        return user
