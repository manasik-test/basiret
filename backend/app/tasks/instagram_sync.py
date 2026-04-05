"""
Celery task: fetch posts from Instagram Graph API and store in DB.

Uses /me/media to get recent posts, then /media/{id} for engagement details.
Stores raw data in post table, metrics in engagement_metric table.
"""
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform
from app.core.encryption import decrypt_token

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.instagram.com"

MEDIA_FIELDS = (
    "id,caption,media_type,media_url,permalink,timestamp,"
    "like_count,comments_count"
)

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
            # Next page — paging cursor URL already has params
            url = data.get("paging", {}).get("next")
            params = None  # next URL has its own params

    return all_media


@celery.task(name="instagram_sync", bind=True, max_retries=3)
def sync_instagram_posts(self, social_account_id: str):
    """Fetch posts from Instagram and upsert into post + engagement_metric."""
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
        for item in media_items:
            # Upsert post
            posted_at = None
            if item.get("timestamp"):
                posted_at = datetime.fromisoformat(item["timestamp"].replace("+0000", "+00:00"))

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

            # Get the post id for engagement metric
            post = db.query(Post).filter_by(
                platform="instagram",
                platform_post_id=item["id"],
            ).first()

            if post:
                like_count = item.get("like_count", 0)
                comments_count = item.get("comments_count", 0)
                total_engagement = like_count + comments_count

                metric = EngagementMetric(
                    post_id=post.id,
                    likes=like_count,
                    comments=comments_count,
                    shares=0,
                    saves=0,
                    reach=0,
                    impressions=0,
                    engagement_rate=0.0,
                )
                db.add(metric)
                posts_synced += 1

        db.commit()
        logger.info("Synced %d posts for account %s", posts_synced, social_account_id)
        return {"status": "ok", "posts_synced": posts_synced}

    except httpx.HTTPStatusError as exc:
        logger.error("Instagram API error: %s", exc.response.text)
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
