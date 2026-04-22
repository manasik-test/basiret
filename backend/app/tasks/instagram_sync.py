"""
Celery task: fetch posts + comments from Instagram Graph API and store in DB.

Uses /me/media to get recent posts, then /{media-id}/comments per post.
Stores raw post data in post table, metrics in engagement_metric, individual
comments (including author + timestamp) in comment.

Comment fetching requires the `instagram_business_manage_comments` scope on the
access token. If the token only has `instagram_business_basic`, the comments
endpoint returns 400/403 — this task logs and skips, so post sync still
succeeds. See CLAUDE.md (Sprint 9 / OAuth scope notes) for scope upgrade plan.
"""
import logging
from datetime import datetime

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.comment import Comment
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform
from app.core.encryption import decrypt_token

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.instagram.com"

MEDIA_FIELDS = (
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,"
    "like_count,comments_count"
)
COMMENT_FIELDS = "id,text,timestamp,username"
COMMENTS_PAGE_LIMIT = 50

# Map Instagram media_type to our content_type enum
MEDIA_TYPE_MAP = {
    "IMAGE": "image",
    "VIDEO": "video",
    "CAROUSEL_ALBUM": "carousel",
}


def _fetch_media(access_token: str) -> list[dict]:
    """Fetch all pages of /me/media from Instagram Graph API."""
    all_media = []
    url = f"{GRAPH_BASE}/me/media"
    params = {"fields": MEDIA_FIELDS, "access_token": access_token, "limit": 100}

    with httpx.Client(timeout=30) as client:
        while url:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            all_media.extend(data.get("data", []))
            url = data.get("paging", {}).get("next")
            params = None

    return all_media


def _fetch_comments_for_media(client: httpx.Client, media_id: str, access_token: str) -> list[dict]:
    """Fetch comments for a single media item.

    Returns [] on 400/403 (typically scope missing — `instagram_business_manage_comments`
    not granted) so a single permission gap does not abort the whole sync.
    """
    url = f"{GRAPH_BASE}/{media_id}/comments"
    params = {"fields": COMMENT_FIELDS, "access_token": access_token, "limit": COMMENTS_PAGE_LIMIT}
    out: list[dict] = []
    while url:
        try:
            resp = client.get(url, params=params)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (400, 403):
                logger.warning(
                    "Comments fetch denied for media %s (status=%s): %s — likely missing "
                    "`instagram_business_manage_comments` scope",
                    media_id, status, exc.response.text[:200],
                )
                return []
            raise
        data = resp.json()
        out.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
        params = None
    return out


def _parse_ig_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("+0000", "+00:00"))


def _upsert_comments(db, post_id, raw_comments: list[dict]) -> int:
    """Upsert comments for a post. Returns number of new comments inserted."""
    if not raw_comments:
        return 0

    rows = []
    for c in raw_comments:
        if not c.get("id"):
            continue
        rows.append({
            "post_id": post_id,
            "platform_comment_id": c["id"],
            "text": c.get("text"),
            "author_username": c.get("username"),
            "created_at": _parse_ig_timestamp(c.get("timestamp")),
        })
    if not rows:
        return 0

    stmt = pg_insert(Comment).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["platform_comment_id"],
        set_={
            "text": stmt.excluded.text,
            "author_username": stmt.excluded.author_username,
            "created_at": stmt.excluded.created_at,
        },
    )
    db.execute(stmt)
    return len(rows)


@celery.task(name="instagram_sync", bind=True, max_retries=3)
def sync_instagram_posts(self, social_account_id: str):
    """Fetch posts (and comments) from Instagram and upsert them."""
    db = SessionLocal()
    try:
        account = db.query(SocialAccount).filter_by(
            id=social_account_id,
            platform=Platform.instagram,
            is_active=True,
        ).first()

        if not account:
            logger.error("Social account %s not found or inactive", social_account_id)
            return {"status": "error", "detail": "account not found"}

        access_token = decrypt_token(account.access_token_encrypted)
        media_items = _fetch_media(access_token)
        logger.info("Fetched %d posts for account %s", len(media_items), social_account_id)

        posts_synced = 0
        comments_synced = 0
        with httpx.Client(timeout=30) as comments_client:
            for item in media_items:
                posted_at = _parse_ig_timestamp(item.get("timestamp"))

                post_values = {
                    "social_account_id": social_account_id,
                    "platform_post_id": item["id"],
                    "platform": "instagram",
                    "content_type": MEDIA_TYPE_MAP.get(item.get("media_type"), "image"),
                    "caption": item.get("caption"),
                    "media_url": item.get("media_url"),
                    "posted_at": posted_at,
                    "raw_data": item,
                }

                stmt = pg_insert(Post).values(**post_values)
                stmt = stmt.on_conflict_do_update(
                    constraint="post_platform_platform_post_id_key",
                    set_={
                        "caption": stmt.excluded.caption,
                        "media_url": stmt.excluded.media_url,
                        "raw_data": stmt.excluded.raw_data,
                    },
                )
                db.execute(stmt)
                db.flush()

                post = db.query(Post).filter_by(
                    platform="instagram",
                    platform_post_id=item["id"],
                ).first()

                if not post:
                    continue

                like_count = item.get("like_count", 0)
                comments_count = item.get("comments_count", 0)
                metric = EngagementMetric(
                    post_id=post.id,
                    likes=like_count,
                    comments=comments_count,
                    shares=0, saves=0, reach=0, impressions=0,
                    engagement_rate=0.0,
                )
                db.add(metric)
                posts_synced += 1

                # Fetch + upsert comments (best-effort; missing scope returns [])
                if comments_count and comments_count > 0:
                    raw_comments = _fetch_comments_for_media(
                        comments_client, item["id"], access_token,
                    )
                    if raw_comments:
                        comments_synced += _upsert_comments(db, post.id, raw_comments)

        db.commit()
        logger.info(
            "Synced %d posts and %d comments for account %s",
            posts_synced, comments_synced, social_account_id,
        )
        return {
            "status": "ok",
            "posts_synced": posts_synced,
            "comments_synced": comments_synced,
        }

    except httpx.HTTPStatusError as exc:
        logger.error("Instagram API error: %s", exc.response.text)
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
