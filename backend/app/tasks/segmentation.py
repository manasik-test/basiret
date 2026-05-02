"""
Celery task: K-means audience segmentation.

Clusters posts by engagement patterns, content type, sentiment, and temporal
features to identify audience archetypes for a social account. Uses the
shared AI provider for rich persona descriptions; AI failures degrade to
empty descriptions without crashing the cluster job.
"""
import hashlib
import logging
import numpy as np
from celery.exceptions import Ignore
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from sqlalchemy import and_, func, text

from app.core.ai_provider import AIProviderError, get_provider
from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.engagement_metric import EngagementMetric
from app.models.analysis_result import AnalysisResult
from app.models.audience_segment import AudienceSegment

logger = logging.getLogger(__name__)

MIN_POSTS = 10


def _advisory_lock_key(social_account_id: str) -> int:
    """Hash a UUID string to a stable signed 64-bit int for pg_try_advisory_xact_lock."""
    digest = hashlib.blake2b(str(social_account_id).encode(), digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=True)

FEATURE_NAMES = [
    "likes", "comments", "engagement_rate",
    "sentiment_score",
    "is_positive", "is_negative",
    "is_image", "is_video", "is_carousel",
    "hour_of_day", "day_of_week",
]

# Indices of numeric features that need scaling (not binary)
NUMERIC_COLS = [0, 1, 2, 3, 9, 10]


def _build_feature_matrix(db, social_account_id: str):
    """
    Build an (n_posts, 11) feature matrix for all posts belonging to
    the given social account.

    Returns (feature_matrix, post_ids) or (None, None) if insufficient data.
    """
    # Subquery: latest engagement_metric per post
    latest_metric = (
        db.query(
            EngagementMetric.post_id,
            func.max(EngagementMetric.recorded_at).label("max_recorded"),
        )
        .group_by(EngagementMetric.post_id)
        .subquery()
    )

    rows = (
        db.query(Post, EngagementMetric, AnalysisResult)
        .join(latest_metric, Post.id == latest_metric.c.post_id)
        .join(
            EngagementMetric,
            and_(
                EngagementMetric.post_id == Post.id,
                EngagementMetric.recorded_at == latest_metric.c.max_recorded,
            ),
        )
        .outerjoin(AnalysisResult, AnalysisResult.post_id == Post.id)
        .filter(Post.social_account_id == social_account_id)
        .all()
    )

    if len(rows) < MIN_POSTS:
        return None, None

    features = []
    post_ids = []

    for post, metric, analysis in rows:
        # Engagement features
        likes = metric.likes or 0
        comments = metric.comments or 0
        engagement_rate = metric.engagement_rate or 0.0

        # Sentiment features
        sentiment_score = 0.0
        is_positive = 0
        is_negative = 0
        if analysis:
            sentiment_score = analysis.sentiment_score or 0.0
            is_positive = 1 if analysis.sentiment == "positive" else 0
            is_negative = 1 if analysis.sentiment == "negative" else 0

        # Content type features
        ct = post.content_type.value if post.content_type else ""
        is_image = 1 if ct == "image" else 0
        is_video = 1 if ct in ("video", "reel") else 0
        is_carousel = 1 if ct == "carousel" else 0

        # Temporal features
        if post.posted_at:
            hour_of_day = post.posted_at.hour
            day_of_week = post.posted_at.weekday()
        else:
            hour_of_day = 12
            day_of_week = 3

        features.append([
            likes, comments, engagement_rate,
            sentiment_score,
            is_positive, is_negative,
            is_image, is_video, is_carousel,
            hour_of_day, day_of_week,
        ])
        post_ids.append(str(post.id))

    return np.array(features, dtype=float), post_ids


def _run_kmeans(feature_matrix: np.ndarray):
    """
    Scale features and run K-means with automatic k selection.

    Returns (labels, centroids_unscaled, k, best_silhouette) or None.
    """
    n = feature_matrix.shape[0]
    if n < MIN_POSTS:
        return None

    # Scale only numeric columns; leave binary columns as-is
    scaler = StandardScaler()
    scaled = feature_matrix.copy()
    scaled[:, NUMERIC_COLS] = scaler.fit_transform(feature_matrix[:, NUMERIC_COLS])

    # Determine k
    if n < 20:
        best_k = 2
    else:
        max_k = min(6, n // 5 + 1)
        best_k = 3
        best_score = -1.0

        for k in range(2, max_k):
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            labels = km.fit_predict(scaled)
            score = silhouette_score(scaled, labels)
            if score > best_score:
                best_score = score
                best_k = k

        if best_score < 0.15:
            best_k = 3

    km = KMeans(n_clusters=best_k, n_init=10, random_state=42)
    labels = km.fit_predict(scaled)
    sil = float(silhouette_score(scaled, labels)) if best_k > 1 else 0.0

    # Inverse-transform centroids for numeric columns to get interpretable values
    centroids = km.cluster_centers_.copy()
    centroids[:, NUMERIC_COLS] = scaler.inverse_transform(
        centroids[:, NUMERIC_COLS].reshape(-1, len(NUMERIC_COLS))
    ).reshape(centroids.shape[0], len(NUMERIC_COLS))

    return labels, centroids, best_k, sil


def _generate_cluster_label(centroid: np.ndarray) -> str:
    """Generate a human-readable label from a centroid's feature values."""
    likes, comments, eng_rate = centroid[0], centroid[1], centroid[2]
    is_positive, is_negative = centroid[4], centroid[5]
    is_image, is_video, is_carousel = centroid[6], centroid[7], centroid[8]
    hour = centroid[9]

    # Engagement level
    eng_mean = (likes + comments) / 2 + eng_rate * 100
    if eng_mean > 50:
        eng_label = "High-Engagement"
    elif eng_mean < 10:
        eng_label = "Low-Engagement"
    else:
        eng_label = "Moderate-Engagement"

    # Content type
    content_scores = {"Visual": is_image, "Video": is_video, "Carousel": is_carousel}
    dominant = max(content_scores, key=content_scores.get)
    content_label = dominant if content_scores[dominant] > 0.4 else "Mixed"

    # Sentiment
    sentiment_part = ""
    if is_positive > 0.5:
        sentiment_part = " Positive"
    elif is_negative > 0.5:
        sentiment_part = " Critical"

    # Time of day
    if 6 <= hour < 12:
        time_label = "Morning"
    elif 12 <= hour < 18:
        time_label = "Afternoon"
    elif 18 <= hour < 24:
        time_label = "Evening"
    else:
        time_label = "Night"

    return f"{eng_label} {content_label}{sentiment_part} {time_label}"


def _generate_persona_descriptions(
    segments_data: list[dict],
    account_id: str | None = None,
    language: str = "en",
    brand_block: str = "",
) -> list[dict]:
    """Call the personas provider (Gemini) to generate persona objects per cluster.

    Returns a list of dicts: ``{"name": ..., "tagline": ..., "description": ...}``
    one per cluster, in cluster_id order. The "name" is a short culturally
    appropriate human handle + role (e.g. "سالم — هاوي الفيديو" /
    "Salim — Video Lover"); the "tagline" is one sentence; the "description"
    is 2-3 sentences explaining the content/timing pattern.

    AI failures (quota / unavailable / malformed) collapse to empty fields —
    the cluster job still produces all its DB rows, just without prose.
    """
    lang_label = "Arabic" if language == "ar" else "English"
    if language == "ar":
        name_rule = (
            "The 'name' MUST follow the format 'الاسم — الدور' — an Arabic given "
            "name (سالم/ليلى/خالد/نورة/مها/أحمد/فاطمة/يوسف…) followed by an em-dash and "
            "a 2-4 word role tagline. Do NOT use Latin names. "
        )
        desc_rule = (
            "The 'description' MUST start with: 'المحتوى المنشور في فترة <time> يحقق "
            "هذا الأداء:' where <time> is the Arabic translation of typical_posting_time "
            "(morning=الصباح, afternoon=الظهيرة, evening=المساء, night=الليل). "
        )
    else:
        name_rule = (
            "The 'name' MUST follow the format 'Given Name — Role Tagline' — pick a "
            "common given name (Sam/Layla/Khalid/Noura/Maha/Ahmad/Fatima/Yusuf…) "
            "followed by an em-dash and a 2-4 word role tagline. "
        )
        desc_rule = (
            "The 'description' MUST start with: "
            "'Content posted in the <time> performs like this:' where <time> is the "
            "lowercase typical_posting_time value (morning/afternoon/evening/night). "
        )

    sys_prompt = (
        "You are a content-performance analyst. Given K-means clusters of a creator's "
        "own posts (NOT audience segments), produce a persona object per cluster — "
        "give the cluster a memorable identity that helps the creator visualize the "
        "type of content+timing pattern it represents. "
        + name_rule
        + "The 'tagline' MUST be one short sentence (≤12 words) capturing the content "
        "vibe (e.g. 'Short videos that land in the afternoon'). "
        + desc_rule
        + "After the description's mandatory opener, give 1-2 more sentences about how "
        "the content engages and one concrete takeaway. Do NOT describe hypothetical "
        "audience members — describe the content pattern. "
        "Respond ONLY in valid JSON: an object with key 'personas' whose value is an "
        "array of objects, each with keys 'name', 'tagline', 'description', one per "
        "cluster in input order. No preamble, no markdown. "
        f"Respond ENTIRELY in {lang_label}. Every string value MUST be in {lang_label} "
        "— do not switch languages even if the input data is in another language."
    )

    prompt = ""
    if brand_block:
        prompt += f"{brand_block}\n"
    prompt += "Generate personas for these clusters:\n\n"
    for i, seg in enumerate(segments_data):
        prompt += (
            f"Cluster {i + 1}: \"{seg['label']}\" — {seg['size']} posts, "
            f"dominant content: {seg['dominant_content_type']}, "
            f"sentiment: {seg['dominant_sentiment']}, "
            f"typical_posting_time: {seg['typical_posting_time']}, "
            f"avg likes: {seg['avg_likes']}, avg comments: {seg['avg_comments']}\n"
        )

    empty = [{"name": "", "tagline": "", "description": ""} for _ in segments_data]

    try:
        parsed = get_provider("personas").generate_json(
            sys_prompt, prompt, temperature=0.5,
            account_id=account_id, task="personas", source="user",
        )
    except AIProviderError as exc:
        logger.warning(
            "Persona generation failed (%s) — personas will be empty",
            exc.__class__.__name__,
        )
        return empty

    raw = parsed.get("personas") or parsed.get("items") or parsed.get("descriptions") or []
    if not isinstance(raw, list):
        logger.warning("Persona response wasn't a list: %s", type(raw).__name__)
        return empty

    out: list[dict] = []
    for i in range(len(segments_data)):
        if i >= len(raw):
            out.append({"name": "", "tagline": "", "description": ""})
            continue
        item = raw[i]
        if isinstance(item, str):
            # Backwards compat: old shape returned bare descriptions.
            out.append({"name": "", "tagline": "", "description": item})
        elif isinstance(item, dict):
            out.append({
                "name": str(item.get("name", "") or ""),
                "tagline": str(item.get("tagline", "") or ""),
                "description": str(item.get("description", "") or ""),
            })
        else:
            out.append({"name": "", "tagline": "", "description": ""})
    return out


def _compute_segment_extras(db, cluster_post_ids: list):
    """Compute the new per-segment characteristics that aren't derivable from
    the centroid alone: actual content-type breakdown, top topics, and the
    best-performing day-of-week + hour combo for posts in this cluster.

    Returns a dict with keys: content_type_breakdown, top_topics, best_day_hour.
    Empty cluster → safe defaults.
    """
    if not cluster_post_ids:
        return {
            "content_type_breakdown": {"video": 0, "image": 0, "carousel": 0},
            "top_topics": [],
            "best_day_hour": None,
        }

    # 1. Content-type breakdown from the actual post rows.
    type_rows = (
        db.query(Post.content_type, func.count(Post.id).label("n"))
        .filter(Post.id.in_(cluster_post_ids))
        .group_by(Post.content_type)
        .all()
    )
    total = sum(r.n for r in type_rows) or 1
    by_type = {"video": 0, "image": 0, "carousel": 0}
    for r in type_rows:
        ct = (str(r.content_type).lower() if r.content_type else "")
        if "video" in ct or "reel" in ct:
            by_type["video"] += r.n
        elif "carousel" in ct or "album" in ct:
            by_type["carousel"] += r.n
        else:
            by_type["image"] += r.n
    breakdown = {k: round(100.0 * v / total) for k, v in by_type.items()}
    # Force the percentages to sum to exactly 100 by absorbing rounding into the largest bucket.
    diff = 100 - sum(breakdown.values())
    if diff != 0:
        winner = max(breakdown.keys(), key=lambda k: breakdown[k])
        breakdown[winner] += diff

    # 2. Top topics — flatten analysis_result.topics across cluster posts.
    topic_rows = (
        db.query(AnalysisResult.topics)
        .filter(AnalysisResult.post_id.in_(cluster_post_ids))
        .filter(AnalysisResult.topics.isnot(None))
        .all()
    )
    topic_counts: dict[str, int] = {}
    for (topics,) in topic_rows:
        if not isinstance(topics, list):
            continue
        for t in topics:
            if not t:
                continue
            key = str(t).strip()
            if not key:
                continue
            topic_counts[key] = topic_counts.get(key, 0) + 1
    top_topics = [
        t for t, _ in sorted(topic_counts.items(), key=lambda kv: kv[1], reverse=True)
    ][:3]

    # 3. Best day-of-week × hour bucket — pick the (DOW, hour) combo with the
    # highest avg engagement_rate among cluster posts. Day labels match the
    # frontend's localised set (Monday/.../Sunday).
    perf_rows = (
        db.query(
            Post.posted_at,
            EngagementMetric.likes,
            EngagementMetric.comments,
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.id.in_(cluster_post_ids))
        .filter(Post.posted_at.isnot(None))
        .all()
    )

    bucket_totals: dict[tuple[int, int], list[int]] = {}
    for posted_at, likes, comments in perf_rows:
        if posted_at is None:
            continue
        key = (posted_at.weekday(), posted_at.hour)  # weekday(): Mon=0..Sun=6
        bucket_totals.setdefault(key, []).append((likes or 0) + (comments or 0))

    best_day_hour = None
    if bucket_totals:
        best_key = max(
            bucket_totals.keys(),
            key=lambda k: sum(bucket_totals[k]) / max(1, len(bucket_totals[k])),
        )
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        best_day_hour = {"day": day_names[best_key[0]], "hour": int(best_key[1])}

    return {
        "content_type_breakdown": breakdown,
        "top_topics": top_topics,
        "best_day_hour": best_day_hour,
    }


def _save_segments(db, social_account_id: str, labels, centroids, post_ids, k, silhouette, language: str = "en"):
    """Delete old segments and insert new cluster rows with AI persona descriptions."""
    db.query(AudienceSegment).filter(
        AudienceSegment.social_account_id == social_account_id,
    ).delete()

    labels_arr = np.array(labels)

    # Pre-compute segment data for Gemini batch call
    segments_data = []
    for cluster_id in range(k):
        mask = labels_arr == cluster_id
        centroid = centroids[cluster_id]
        segments_data.append({
            "label": _generate_cluster_label(centroid),
            "size": int(mask.sum()),
            "dominant_content_type": max(
                ["image", "video", "carousel"],
                key=lambda ct: centroid[FEATURE_NAMES.index(f"is_{ct}")],
            ),
            "dominant_sentiment": (
                "positive" if centroid[4] > 0.5
                else "negative" if centroid[5] > 0.5
                else "neutral"
            ),
            "typical_posting_time": (
                "Morning" if 6 <= centroid[9] < 12
                else "Afternoon" if 12 <= centroid[9] < 18
                else "Evening" if 18 <= centroid[9] < 24
                else "Night"
            ),
            "avg_likes": round(float(centroid[0]), 2),
            "avg_comments": round(float(centroid[1]), 2),
        })

    # Get AI personas (best-effort — empty fields on AI failure). The brand
    # block, when non-empty, nudges Gemini to align persona name + description
    # tone with the creator's saved brand voice.
    from app.core.brand_context import format_brand_identity
    from app.models.social_account import SocialAccount as _SA
    org_row = (
        db.query(_SA.organization_id)
        .filter(_SA.id == social_account_id)
        .first()
    )
    brand_block = (
        format_brand_identity(org_row[0], db) if org_row and org_row[0] else ""
    )
    personas = _generate_persona_descriptions(
        segments_data,
        account_id=str(social_account_id),
        language=language,
        brand_block=brand_block,
    )

    for cluster_id in range(k):
        mask = labels_arr == cluster_id
        cluster_post_ids = [post_ids[i] for i in range(len(post_ids)) if mask[i]]
        centroid = centroids[cluster_id]
        extras = _compute_segment_extras(db, cluster_post_ids)
        persona = personas[cluster_id] if cluster_id < len(personas) else {
            "name": "", "tagline": "", "description": "",
        }

        segment = AudienceSegment(
            social_account_id=social_account_id,
            cluster_id=cluster_id,
            segment_label=_generate_cluster_label(centroid),
            size_estimate=int(mask.sum()),
            characteristics={
                "centroid": {
                    name: round(float(centroid[i]), 4)
                    for i, name in enumerate(FEATURE_NAMES)
                },
                "post_ids": cluster_post_ids,
                "silhouette_score": round(silhouette, 4),
                "k": k,
                "dominant_content_type": segments_data[cluster_id]["dominant_content_type"],
                "avg_engagement": {
                    "likes": round(float(centroid[0]), 2),
                    "comments": round(float(centroid[1]), 2),
                    "engagement_rate": round(float(centroid[2]), 4),
                },
                "dominant_sentiment": segments_data[cluster_id]["dominant_sentiment"],
                "typical_posting_time": segments_data[cluster_id]["typical_posting_time"],
                # Structured persona (preferred — name + tagline + description).
                "persona_name": persona["name"],
                "persona_tagline": persona["tagline"],
                "persona_description": persona["description"],
                # New computed fields surfacing on the redesigned audience cards.
                "content_type_breakdown": extras["content_type_breakdown"],
                "top_topics": extras["top_topics"],
                "best_day_hour": extras["best_day_hour"],
            },
        )
        db.add(segment)

    db.commit()
    logger.info(
        "Saved %d segments for social_account %s (silhouette=%.3f)",
        k, social_account_id, silhouette,
    )


@celery.task(name="segment_audience", bind=True, max_retries=2)
def segment_audience(self, social_account_id: str, language: str = "en"):
    """Run K-means segmentation on all posts for a social account.

    `language` is forwarded to the persona-description Gemini call so the
    written prose matches the user's UI language. Accepted values: "en", "ar".
    """
    db = SessionLocal()
    try:
        # Serialize concurrent regenerations for the same account. Without this,
        # two tasks racing on delete-then-insert would both delete, both insert,
        # and leave duplicate segment rows. Lock is transaction-scoped — released
        # automatically when this task's DB transaction ends.
        acquired = db.execute(
            text("SELECT pg_try_advisory_xact_lock(:k)"),
            {"k": _advisory_lock_key(social_account_id)},
        ).scalar()
        if not acquired:
            logger.info(
                "Skipping duplicate segment_audience for %s (another task holds the advisory lock)",
                social_account_id,
            )
            raise Ignore()

        logger.info("Starting segmentation for account %s", social_account_id)

        feature_matrix, post_ids = _build_feature_matrix(db, social_account_id)
        if feature_matrix is None:
            logger.warning(
                "Insufficient posts for account %s (need >= %d)",
                social_account_id, MIN_POSTS,
            )
            return {
                "status": "error",
                "detail": f"Need at least {MIN_POSTS} posts with engagement data",
            }

        result = _run_kmeans(feature_matrix)
        if result is None:
            return {"status": "error", "detail": "Clustering failed"}

        labels, centroids, k, sil = result

        _save_segments(db, social_account_id, labels, centroids, post_ids, k, sil, language=language)

        return {
            "status": "ok",
            "segments_created": k,
            "silhouette_score": round(sil, 4),
            "posts_clustered": len(post_ids),
            "social_account_id": social_account_id,
        }

    except Ignore:
        raise
    except Exception as exc:
        db.rollback()
        logger.error("segment_audience failed for %s: %s", social_account_id, exc)
        raise self.retry(exc=exc, countdown=120)
    finally:
        db.close()
