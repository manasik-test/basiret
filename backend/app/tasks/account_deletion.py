"""
Account / data deletion Celery tasks.

Two surfaces feed in here:

1. The user-initiated `DELETE /api/v1/auth/account` endpoint, which deletes
   the calling user (or their entire organisation if they're the last admin)
   *synchronously* in the request handler — fast enough that no task is
   needed.

2. Meta's Data Deletion Callback (`POST /api/v1/auth/data-deletion-callback`)
   sends a signed request with a Meta-scoped `user_id`. We must respond
   immediately with `{url, confirmation_code}` and perform the actual delete
   asynchronously. That's what `delete_data_for_meta_user_id` is for.

The "delete the org" path is the same in both cases — see `_delete_org_cascade`.
The Postgres ON DELETE CASCADE chain on `organization` → `social_account` →
`post` → (`analysis_result`, `engagement_metric`, `comment` → `analysis_result`)
plus `audience_segment`, `insight_result`, `ai_page_cache`, `ai_usage_log`,
`goal`, `recommendation_feedback`, `subscription`, `user` — all wired to
ondelete=CASCADE — does the heavy lifting; we just `db.delete(org); db.commit()`.

Idempotent: re-running the task with a user_id that's already been deleted is
a no-op.
"""
import logging

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.organization import Organization
from app.models.social_account import SocialAccount
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


def _delete_org_cascade(db, org: Organization) -> None:
    """Delete the organization. ON DELETE CASCADE handles every child table."""
    db.delete(org)
    db.commit()


def delete_user_or_org(db, user: User) -> str:
    """Synchronous deletion path used by the user-initiated endpoint.

    Returns one of: "org_deleted" | "user_only".
    Caller is responsible for committing/closing the session it provided
    UNLESS we delete the org (we commit there because cascade requires it).
    """
    org_id = user.organization_id
    other_admins = (
        db.query(User)
        .filter(
            User.organization_id == org_id,
            User.role == UserRole.admin,
            User.id != user.id,
            User.is_active.is_(True),
        )
        .count()
    )
    if other_admins == 0:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if org is not None:
            _delete_org_cascade(db, org)
            return "org_deleted"
    db.delete(user)
    db.commit()
    return "user_only"


@celery.task(name="delete_data_for_meta_user_id")
def delete_data_for_meta_user_id(meta_user_id: str) -> dict:
    """Background task fired by Meta's Data Deletion Callback.

    `meta_user_id` is the platform-scoped Instagram/Facebook user id that we
    stored as `social_account.platform_account_id` at OAuth time.

    Multiple BASIRET orgs may have the same Meta user_id connected (the
    SocialAccount unique constraint is per-(org, platform, platform_account_id),
    not global) — delete every org that connected this Meta user.
    """
    db = SessionLocal()
    deleted_orgs: list[str] = []
    try:
        accounts = (
            db.query(SocialAccount)
            .filter(SocialAccount.platform_account_id == meta_user_id)
            .all()
        )
        seen_org_ids = set()
        for acc in accounts:
            if acc.organization_id in seen_org_ids:
                continue
            seen_org_ids.add(acc.organization_id)
            org = (
                db.query(Organization)
                .filter(Organization.id == acc.organization_id)
                .first()
            )
            if org is not None:
                _delete_org_cascade(db, org)
                deleted_orgs.append(str(org.id))
        logger.info(
            "meta deletion callback complete",
            extra={"meta_user_id": meta_user_id, "orgs_deleted": deleted_orgs},
        )
        return {"status": "ok", "orgs_deleted": deleted_orgs}
    except Exception as exc:
        db.rollback()
        logger.exception("meta deletion failed: %s", exc)
        raise
    finally:
        db.close()
