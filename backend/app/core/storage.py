"""Media storage abstraction for the Post Creator.

Two backends:

  * Cloudflare R2 (S3-compatible) — production. Uses boto3 because the v4
    signing path is well-maintained and the API surface we need is small.
    Public reads go through whatever public-bucket URL is configured at
    `R2_PUBLIC_URL`; we never sign read URLs.

  * Local filesystem fallback — when R2_ACCOUNT_ID is empty (dev / CI).
    Files land in /tmp/basiret-media/ and are served by the
    `/api/v1/media/{filename}` static route in the posts_creator router.

Both backends expose the same three functions so the API endpoints don't
need to know which one is active:

    upload_media(file_bytes, filename, content_type) -> str
    delete_media(url) -> None
    is_r2_configured() -> bool
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)


# Where the local fallback writes files. /tmp survives container restarts
# inside the same Docker run; for genuinely persistent local dev, mount a
# host volume here in docker-compose.
LOCAL_MEDIA_DIR = Path("/tmp/basiret-media")
LOCAL_MEDIA_URL_PREFIX = "/api/v1/media/"

# Object-key prefix on R2 (lets us share a bucket across other Basiret
# media types in future without colliding).
R2_KEY_PREFIX = "posts/"

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def is_r2_configured() -> bool:
    """True when both account id and credentials are present.

    A missing public URL is allowed — we'll synthesize one from the bucket
    name + account id, which works for dev/staging buckets that haven't
    been given a custom domain.
    """
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )


def _safe_filename(filename: str) -> str:
    """Strip path separators and other unsafe characters from a filename
    so we can build deterministic object keys + local paths.

    Returns at minimum a UUID — even an empty input gets a usable name.
    """
    base = os.path.basename(filename or "").strip() or "file"
    cleaned = _SAFE_NAME_RE.sub("-", base).strip("-")
    if not cleaned:
        cleaned = "file"
    return cleaned[:120]


def _build_object_key(filename: str) -> str:
    """Produce a collision-free R2 object key for an upload."""
    return f"{R2_KEY_PREFIX}{uuid.uuid4().hex}-{_safe_filename(filename)}"


def _r2_client():
    """Lazy-build a boto3 S3 client pointed at the R2 endpoint."""
    import boto3
    from botocore.config import Config

    endpoint = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        # `auto` works for R2 even when the bucket isn't in us-east-1;
        # boto3 still complains if region_name is omitted entirely.
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def _r2_public_url(key: str) -> str:
    """Build the public URL for an R2 object key.

    Prefers the configured `R2_PUBLIC_URL` (so users can plug in a custom
    domain), but falls back to the cloudflarestorage.com hostname when
    that's not set — workable for dev buckets exposed via the default
    R2.dev subdomain.
    """
    if settings.R2_PUBLIC_URL:
        base = settings.R2_PUBLIC_URL.rstrip("/")
        return f"{base}/{key}"
    # Cloudflare's default public URL pattern.
    return (
        f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/"
        f"{settings.R2_BUCKET_NAME}/{key}"
    )


def upload_media(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload bytes to R2 (or the local fallback) and return a public URL.

    Caller is responsible for size + content-type validation — this helper
    will store anything it's handed.
    """
    if is_r2_configured():
        key = _build_object_key(filename)
        client = _r2_client()
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type or "application/octet-stream",
        )
        url = _r2_public_url(key)
        logger.info("uploaded media to R2: bucket=%s key=%s", settings.R2_BUCKET_NAME, key)
        return url

    # Local fallback. Generate the same UUID-prefixed filename so a
    # later move to R2 doesn't change the URL shape semantics.
    LOCAL_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}-{_safe_filename(filename)}"
    path = LOCAL_MEDIA_DIR / name
    path.write_bytes(file_bytes)
    logger.info("uploaded media to local fallback: %s", path)
    return f"{LOCAL_MEDIA_URL_PREFIX}{name}"


def delete_media(url: str) -> None:
    """Best-effort delete by URL. Swallows missing-object errors.

    Storage cleanup happens on Post-deletion AND on draft-expiry. Both
    paths can race with manual deletes (e.g. a sysadmin emptying the
    bucket), so a 404-style response is treated as success.
    """
    if not url:
        return

    # Local fallback path (relative URL like /api/v1/media/foo.png)
    if url.startswith(LOCAL_MEDIA_URL_PREFIX):
        name = url[len(LOCAL_MEDIA_URL_PREFIX):]
        # Reject any path-traversal attempt — _safe_filename strips slashes
        # but we want belt-and-braces on a delete that touches the FS.
        if "/" in name or ".." in name:
            logger.warning("rejecting delete of suspicious local path: %s", name)
            return
        path = LOCAL_MEDIA_DIR / name
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        except Exception:  # pragma: no cover
            logger.exception("local media delete failed: %s", path)
        return

    if not is_r2_configured():
        # We can't delete from a remote bucket without credentials; log and
        # carry on so the calling DB delete still proceeds.
        logger.warning("R2 not configured but asked to delete remote URL: %s", url)
        return

    # R2 path — derive the object key from the URL.
    parsed = urlparse(url)
    path = parsed.path.lstrip("/")
    # If R2_PUBLIC_URL is "https://cdn.example.com/<bucket>", then path is
    # "<bucket>/<key>"; strip the bucket prefix so the key is correct.
    bucket_prefix = f"{settings.R2_BUCKET_NAME}/"
    if path.startswith(bucket_prefix):
        key = path[len(bucket_prefix):]
    else:
        key = path

    if not key:
        logger.warning("could not extract R2 key from url: %s", url)
        return

    try:
        client = _r2_client()
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        logger.info("deleted R2 object: %s", key)
    except Exception:  # pragma: no cover - boto3 raises a wide variety
        logger.exception("R2 delete failed for key=%s", key)
