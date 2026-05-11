"""Instagram Content Publishing API client.

Sprint 5 — turns a `scheduled_post` row into an actual post on the user's
Instagram account using the v21.0 Graph API publishing endpoints. Supports
images, carousels (2-10 items), and Reels.

Two-step container/publish dance is the same shape for every media type:

    1. POST /{ig_user_id}/media          → returns a container id
    2. POST /{ig_user_id}/media_publish  → returns the platform_post_id

Reels need a third step in the middle: poll /{container_id}?fields=status_code
every 5s until status_code='FINISHED' (Instagram needs time to ingest the
video before it can be published). Carousels need N+1 container creates
before the publish.

All Graph errors are surfaced as `PublishError` with `code` + `subcode` so
the Celery task wrapper can branch on retry vs. terminal vs. token-expired
behaviour without re-parsing JSON.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_token, encrypt_token
from app.models.scheduled_post import ScheduledPost
from app.models.social_account import SocialAccount

logger = logging.getLogger(__name__)


GRAPH_BASE = "https://graph.instagram.com/v21.0"
REFRESH_URL = "https://graph.instagram.com/refresh_access_token"

# Container readiness polling. Meta needs time to ingest the media before
# `/media_publish` will accept the container — for video this is obvious (the
# upload has to complete server-side), but Meta requires it for image and
# carousel containers too. Without polling, `/media_publish` fires too soon
# and Meta returns code=9007 "Media ID is not available". We poll for ALL
# media types, not just video.
CONTAINER_POLL_INTERVAL_SECONDS = 2
CONTAINER_POLL_TIMEOUT_SECONDS = 60

# Refresh long-lived tokens this many days before they expire.
TOKEN_REFRESH_THRESHOLD_DAYS = 7

# Instagram error codes we branch on. See:
# https://developers.facebook.com/docs/graph-api/guides/error-handling
TOKEN_EXPIRED_CODE = 190

# Real Meta rate-limit codes (App / User / Page / "calls per hour" caps).
# Each one means "back off and retry in ~1h". Do NOT add 9007 here — that's
# a container-not-ready error which our polling layer already handles, and
# treating it as rate-limit triggers a 1h backoff that turns a 2s wait into
# a useless hour of nothing.
RATE_LIMIT_CODES = {4, 17, 32, 613}

# Codes that mean "the request itself is fine, but the resource isn't yet
# ready" — short retry, NOT the 1h rate-limit backoff. Currently just 9007
# ("Media ID is not available"), which Meta returns when /media_publish is
# called before the container's `status_code` has flipped to FINISHED. With
# the polling layer in place this should be unreachable; if it does surface
# in the wild (a race between FINISHED and publish), treat as transient.
TRANSIENT_READINESS_CODES = {9007}


class PublishError(Exception):
    """Wraps a Graph API error with structured fields the caller can branch on."""

    def __init__(
        self,
        message: str,
        *,
        code: int | None = None,
        subcode: int | None = None,
        is_token_expired: bool = False,
        is_rate_limited: bool = False,
        is_retryable: bool = False,
        is_transient_readiness: bool = False,
    ):
        super().__init__(message)
        self.code = code
        self.subcode = subcode
        self.is_token_expired = is_token_expired
        self.is_rate_limited = is_rate_limited
        self.is_retryable = is_retryable
        self.is_transient_readiness = is_transient_readiness


def _parse_graph_error(resp: httpx.Response) -> PublishError:
    """Turn a non-2xx Graph API response into a typed PublishError."""
    try:
        body = resp.json()
        err = body.get("error") or {}
    except Exception:  # noqa: BLE001
        err = {}

    code = err.get("code")
    subcode = err.get("error_subcode")
    msg = err.get("message") or f"Instagram API returned HTTP {resp.status_code}"

    is_token_expired = code == TOKEN_EXPIRED_CODE
    is_rate_limited = code in RATE_LIMIT_CODES or resp.status_code == 429
    is_transient_readiness = code in TRANSIENT_READINESS_CODES
    # 5xx, real rate limits, and transient-readiness are retryable; everything
    # else is terminal so we don't burn quota repeatedly publishing a
    # malformed post. Transient-readiness uses a SHORT backoff (handled by
    # the task wrapper) — not the 1-hour rate-limit countdown.
    is_retryable = is_rate_limited or is_transient_readiness or 500 <= resp.status_code < 600

    return PublishError(
        msg,
        code=code,
        subcode=subcode,
        is_token_expired=is_token_expired,
        is_rate_limited=is_rate_limited,
        is_retryable=is_retryable,
        is_transient_readiness=is_transient_readiness,
    )


def _compose_caption(post: ScheduledPost) -> str:
    """Combine caption text + hashtags into the single string Instagram accepts.

    Prefers Arabic when set (since the user typed it most recently); falls
    back to English, then empty. Hashtags are appended on a fresh line so
    the visual layout in the feed matches what users authored in the wizard.
    """
    caption = (post.caption_ar or post.caption_en or "").strip()
    tags = [t.strip().lstrip("#") for t in (post.hashtags or []) if t and t.strip()]
    if tags:
        tag_line = " ".join(f"#{t}" for t in tags)
        return f"{caption}\n\n{tag_line}".strip() if caption else tag_line
    return caption


async def _post(client: httpx.AsyncClient, url: str, data: dict[str, Any]) -> dict[str, Any]:
    resp = await client.post(url, data=data, timeout=30)
    if resp.status_code >= 400:
        raise _parse_graph_error(resp)
    return resp.json()


async def _get(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> dict[str, Any]:
    resp = await client.get(url, params=params, timeout=30)
    if resp.status_code >= 400:
        raise _parse_graph_error(resp)
    return resp.json()


async def _wait_for_container_ready(
    client: httpx.AsyncClient,
    container_id: str,
    access_token: str,
) -> None:
    """Poll a media container until status_code='FINISHED' or timeout.

    Required for ALL media types (image, carousel, reel) before calling
    /media_publish — without it, Meta returns code=9007 "Media ID is not
    available". Images usually finish in <1s; reels can take 10-30s.

    Raises `PublishError` if status_code is ERROR / EXPIRED (terminal),
    or if we exceed the timeout (retryable — Instagram occasionally takes
    >60s on long videos).
    """
    deadline = datetime.now(timezone.utc) + timedelta(seconds=CONTAINER_POLL_TIMEOUT_SECONDS)
    while datetime.now(timezone.utc) < deadline:
        result = await _get(
            client,
            f"{GRAPH_BASE}/{container_id}",
            {"fields": "status_code", "access_token": access_token},
        )
        status_code = (result.get("status_code") or "").upper()
        if status_code == "FINISHED":
            return
        if status_code in {"ERROR", "EXPIRED"}:
            raise PublishError(
                f"Instagram rejected media container ({status_code})",
                is_retryable=False,
            )
        await asyncio.sleep(CONTAINER_POLL_INTERVAL_SECONDS)
    raise PublishError(
        "Timed out waiting for Instagram to process the media container",
        is_retryable=True,
    )


async def _publish_image(
    client: httpx.AsyncClient,
    ig_user_id: str,
    access_token: str,
    image_url: str,
    caption: str,
) -> str:
    container = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media",
        {"image_url": image_url, "caption": caption, "access_token": access_token},
    )
    container_id = container["id"]
    # Even image containers need a beat to ingest before /media_publish will
    # accept them. Skipping this poll is what produces the 9007 retry storm.
    await _wait_for_container_ready(client, container_id, access_token)
    published = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media_publish",
        {"creation_id": container_id, "access_token": access_token},
    )
    return published["id"]


async def _publish_carousel(
    client: httpx.AsyncClient,
    ig_user_id: str,
    access_token: str,
    image_urls: list[str],
    caption: str,
) -> str:
    if len(image_urls) < 2:
        raise PublishError("Carousel requires at least 2 media items", is_retryable=False)
    if len(image_urls) > 10:
        raise PublishError("Carousel exceeds 10 media items", is_retryable=False)

    item_ids: list[str] = []
    for url in image_urls:
        item = await _post(
            client,
            f"{GRAPH_BASE}/{ig_user_id}/media",
            {
                "image_url": url,
                "is_carousel_item": "true",
                "access_token": access_token,
            },
        )
        item_id = item["id"]
        # Wait for each child item to finish ingesting before we reference
        # it from the carousel container — Meta won't accept a CAROUSEL
        # whose children aren't all FINISHED.
        await _wait_for_container_ready(client, item_id, access_token)
        item_ids.append(item_id)

    carousel = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media",
        {
            "media_type": "CAROUSEL",
            "children": ",".join(item_ids),
            "caption": caption,
            "access_token": access_token,
        },
    )
    # Same readiness gate as image + reel: the carousel parent has to be
    # FINISHED before /media_publish will accept it.
    await _wait_for_container_ready(client, carousel["id"], access_token)
    published = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media_publish",
        {"creation_id": carousel["id"], "access_token": access_token},
    )
    return published["id"]


async def _publish_reel(
    client: httpx.AsyncClient,
    ig_user_id: str,
    access_token: str,
    video_url: str,
    caption: str,
) -> str:
    container = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media",
        {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "share_to_feed": "true",
            "access_token": access_token,
        },
    )
    container_id = container["id"]
    await _wait_for_container_ready(client, container_id, access_token)
    published = await _post(
        client,
        f"{GRAPH_BASE}/{ig_user_id}/media_publish",
        {"creation_id": container_id, "access_token": access_token},
    )
    return published["id"]


def _resolve_media_type(post: ScheduledPost) -> str:
    """Decide which publish path applies based on post fields.

    Carousels override single-image media_type; videos/reels are detected by
    the explicit media_type column the upload endpoint sets.
    """
    urls = post.media_urls or []
    if len(urls) > 1:
        return "carousel"
    mt = (post.media_type or "").lower()
    if mt in {"video", "reel"}:
        return "reel"
    return "image"


async def publish_post(
    social_account: SocialAccount,
    post: ScheduledPost,
    db: Session,
) -> str:
    """Publish a scheduled_post to Instagram and update its status in-place.

    Returns the platform_post_id on success. Raises PublishError otherwise
    (after marking the post `failed` and persisting `error_message`). Token
    expiry also flips `social_account.needs_reauth` so the UI can prompt
    the user to reconnect.
    """
    if not social_account.access_token_encrypted:
        post.status = "failed"
        post.error_message = "Instagram account has no access token"
        db.commit()
        raise PublishError("Account has no access token", is_retryable=False)

    if social_account.needs_reauth:
        post.status = "failed"
        post.error_message = "Instagram account needs to be reconnected"
        db.commit()
        raise PublishError("Account needs reauth", is_token_expired=True)

    access_token = decrypt_token(social_account.access_token_encrypted)
    ig_user_id = social_account.platform_account_id
    caption = _compose_caption(post)
    media_type = _resolve_media_type(post)

    try:
        async with httpx.AsyncClient() as client:
            if media_type == "carousel":
                platform_post_id = await _publish_carousel(
                    client, ig_user_id, access_token, list(post.media_urls or []), caption,
                )
            elif media_type == "reel":
                video_url = (post.media_urls or [None])[0]
                if not video_url:
                    raise PublishError("Reel post missing video URL", is_retryable=False)
                platform_post_id = await _publish_reel(
                    client, ig_user_id, access_token, video_url, caption,
                )
            else:  # image
                image_url = (post.media_urls or [None])[0]
                if not image_url:
                    raise PublishError("Image post missing image URL", is_retryable=False)
                platform_post_id = await _publish_image(
                    client, ig_user_id, access_token, image_url, caption,
                )
    except PublishError as exc:
        # Token expired → mark account so the dispatcher stops queuing it
        # and the UI can show a "reconnect" banner.
        if exc.is_token_expired:
            social_account.needs_reauth = True
            social_account.is_active = False
        post.status = "failed"
        post.error_message = str(exc)[:500]
        db.commit()
        logger.warning(
            "publish failed post=%s account=%s code=%s rate_limited=%s token_expired=%s msg=%s",
            post.id, social_account.id, exc.code, exc.is_rate_limited, exc.is_token_expired, exc,
        )
        raise
    except httpx.HTTPError as exc:
        # Network blip — retryable. Don't mark failed; the task wrapper will
        # retry, and a sustained outage will eventually exhaust max_retries.
        logger.warning("publish network error post=%s: %s", post.id, exc)
        raise PublishError(f"Network error: {exc}", is_retryable=True) from exc

    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_id = platform_post_id
    post.error_message = None
    db.commit()
    logger.info(
        "published post=%s account=%s platform_post_id=%s media_type=%s",
        post.id, social_account.id, platform_post_id, media_type,
    )
    return platform_post_id


async def refresh_token_if_needed(
    social_account: SocialAccount,
    db: Session,
) -> bool:
    """Refresh a long-lived Instagram token if it's within 7 days of expiry.

    Returns True if a refresh happened. False if the token isn't close to
    expiring or no expiry is recorded. Failures flip `needs_reauth` so the
    publishing dispatcher stops trying.
    """
    if not social_account.access_token_encrypted or not social_account.token_expires_at:
        return False

    expires_at = social_account.token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at - datetime.now(timezone.utc) > timedelta(days=TOKEN_REFRESH_THRESHOLD_DAYS):
        return False

    access_token = decrypt_token(social_account.access_token_encrypted)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                REFRESH_URL,
                params={
                    "grant_type": "ig_refresh_token",
                    "access_token": access_token,
                },
                timeout=30,
            )
        if resp.status_code >= 400:
            err = _parse_graph_error(resp)
            if err.is_token_expired:
                social_account.needs_reauth = True
                social_account.is_active = False
                db.commit()
            logger.warning(
                "token refresh failed account=%s code=%s msg=%s",
                social_account.id, err.code, err,
            )
            return False
        body = resp.json()
        new_token = body["access_token"]
        new_expires_in = body.get("expires_in", 5_184_000)
    except httpx.HTTPError as exc:
        logger.warning("token refresh network error account=%s: %s", social_account.id, exc)
        return False
    except KeyError:
        logger.warning("token refresh missing access_token in response account=%s", social_account.id)
        return False

    social_account.access_token_encrypted = encrypt_token(new_token)
    social_account.token_expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=new_expires_in)
    )
    db.commit()
    logger.info("refreshed token account=%s new_expiry=%s", social_account.id, social_account.token_expires_at)
    return True
