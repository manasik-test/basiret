"""
Celery task: fetch posts + comments + post-level insights from Instagram Graph API.

Uses /me/media to get recent posts, then /{media-id}/comments and
/{media-id}/insights per post. Stores raw post data in post, metrics
(likes/comments/shares/saves/reach/impressions) in engagement_metric, and
individual comments in comment.

Optional scopes (graceful degradation if missing — feature is logged + skipped,
post sync still succeeds):
  - `instagram_business_manage_comments` — needed for /{media-id}/comments
  - `instagram_business_manage_insights`  — needed for /{media-id}/insights
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func
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

# Media-insights metrics. `impressions` was deprecated in April 2025 — `views` is its
# replacement and we map it into the `impressions` DB column for schema continuity.
INSIGHTS_METRICS = "reach,saved,shares,views"

# IG insights metric name → EngagementMetric column name.
_INSIGHTS_FIELD_MAP = {
    "reach": "reach",
    "saved": "saves",
    "shares": "shares",
    "views": "impressions",
}

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


def _parse_insights_response(payload: dict) -> dict[str, int]:
    """Parse an /insights response body into our EngagementMetric column dict."""
    out = {"reach": 0, "impressions": 0, "shares": 0, "saves": 0}
    for entry in payload.get("data", []):
        column = _INSIGHTS_FIELD_MAP.get(entry.get("name"))
        if not column:
            continue
        values = entry.get("values") or []
        if not values:
            continue
        try:
            out[column] = int(values[0].get("value", 0) or 0)
        except (TypeError, ValueError):
            pass
    return out


def _fetch_insights_for_media(
    client: httpx.Client,
    media_id: str,
    media_type: str | None,
    access_token: str,
) -> dict[str, int]:
    """Fetch lifetime insights for a single media item.

    Works for IMAGE, VIDEO, and CAROUSEL_ALBUM — Instagram exposes
    reach/views/saved/shares at the **album** level on carousels (the
    `/{child-id}/insights` endpoint returns "Field is not available for
    Carousel children media" and is therefore not used).

    Per-media errors (400 unsupported metric/media, 403 missing scope, etc.)
    are logged and degrade to zeros so post sync still succeeds when the token
    lacks `instagram_business_manage_insights`.
    """
    blank = {"reach": 0, "impressions": 0, "shares": 0, "saves": 0}

    url = f"{GRAPH_BASE}/{media_id}/insights"
    params = {"metric": INSIGHTS_METRICS, "period": "lifetime", "access_token": access_token}
    try:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (400, 403):
            logger.warning(
                "Insights fetch denied for media %s (status=%s, type=%s): %s — likely "
                "missing `instagram_business_manage_insights` scope or unsupported metrics",
                media_id, status, media_type, exc.response.text[:200],
            )
            return blank
        raise

    return _parse_insights_response(resp.json())


def _fetch_carousel_children(
    client: httpx.Client, media_id: str, access_token: str,
) -> list[dict]:
    """Fetch per-slide structure (id + media_type) for a CAROUSEL_ALBUM.

    Per-child *insights* are NOT exposed by Instagram (any
    `/{child-id}/insights` call 400s with "Field is not available for
    Carousel children media"), so we only use this for structural metadata —
    slide count + per-slide media type — which the upcoming "optimal
    carousel length" feature consumes.

    Returns [] on 400/403 so a single permission/availability gap doesn't
    abort the parent post sync.
    """
    url = f"{GRAPH_BASE}/{media_id}/children"
    params = {"fields": "id,media_type", "access_token": access_token}
    try:
        resp = client.get(url, params=params)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (400, 403):
            logger.warning(
                "Carousel children fetch denied for %s (status=%s): %s",
                media_id, status, exc.response.text[:200],
            )
            return []
        raise
    return resp.json().get("data", []) or []


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
                media_type = item.get("media_type")

                # Album-level insights work for every media type (the prior
                # carousel-skip in this branch was wrong — `/{album-id}/insights`
                # returns reach/views/saves/shares cleanly on CAROUSEL_ALBUM).
                insights = _fetch_insights_for_media(
                    comments_client, item["id"], media_type, access_token,
                )

                # Carousels: also fetch per-slide structure (id + media_type)
                # for the future "optimal carousel length" feature. Stash on
                # raw_data BEFORE upsert so it persists in the JSONB column.
                # `slide_count` is duplicated as a top-level int so SQL queries
                # can filter/group by carousel length without unnesting the array.
                if media_type == "CAROUSEL_ALBUM":
                    children = _fetch_carousel_children(
                        comments_client, item["id"], access_token,
                    )
                    if children:
                        item["children"] = children
                        item["slide_count"] = len(children)

                post_values = {
                    "social_account_id": social_account_id,
                    "platform_post_id": item["id"],
                    "platform": "instagram",
                    "content_type": MEDIA_TYPE_MAP.get(media_type, "image"),
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
                    shares=insights["shares"],
                    saves=insights["saves"],
                    reach=insights["reach"],
                    impressions=insights["impressions"],
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


@celery.task(name="sync_all_active_accounts")
def sync_all_active_accounts():
    """Queue instagram sync for every active account with a token.

    Skips accounts whose last post was synced less than 20 hours ago to avoid
    hammering the Instagram Graph API (200 calls/hour/user rate limit).
    Scheduled via Celery Beat (daily 02:00 UTC).
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        twenty_hours_ago = now - timedelta(hours=20)

        accounts = db.query(SocialAccount).filter(
            SocialAccount.is_active == True,  # noqa: E712
            SocialAccount.access_token_encrypted.isnot(None),
        ).all()

        queued = 0
        skipped_recent = 0
        skipped_no_token = 0
        for account in accounts:
            if not account.access_token_encrypted:
                skipped_no_token += 1
                continue

            # Last sync proxy: newest EngagementMetric.recorded_at across this
            # account's posts. `sync_instagram_posts` appends a metric row on
            # every run, so this is a reliable "last synced" marker.
            last_metric = (
                db.query(func.max(EngagementMetric.recorded_at))
                .join(Post, EngagementMetric.post_id == Post.id)
                .filter(Post.social_account_id == account.id)
                .scalar()
            )
            if last_metric and last_metric >= twenty_hours_ago:
                skipped_recent += 1
                continue

            sync_instagram_posts.delay(str(account.id))
            queued += 1

        logger.info(
            "Scheduled sync: queued=%d skipped_recent=%d skipped_no_token=%d total=%d",
            queued, skipped_recent, skipped_no_token, len(accounts),
        )
        return {
            "status": "ok",
            "accounts": len(accounts),
            "queued": queued,
            "skipped_recent": skipped_recent,
            "skipped_no_token": skipped_no_token,
        }
    finally:
        db.close()
