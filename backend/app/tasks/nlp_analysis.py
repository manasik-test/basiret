"""
Celery task: run NLP analysis on posts.

For each post without an analysis_result:
1. Extract text via OCR (image/carousel posts)
2. Detect language (en/ar/unknown)
3. Run sentiment analysis using cardiffnlp/twitter-xlm-roberta-base-sentiment
4. Store results in analysis_result table
"""
import io
import logging
from datetime import datetime, timezone

import httpx
from langdetect import detect, LangDetectException
from sqlalchemy.orm import Session

from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.post import Post, LanguageCode
from app.models.analysis_result import AnalysisResult

logger = logging.getLogger(__name__)

MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"

# Labels output by the model (id2label mapping)
LABEL_MAP = {
    "LABEL_0": "negative",
    "LABEL_1": "neutral",
    "LABEL_2": "positive",
    # Some versions use text labels directly
    "negative": "negative",
    "neutral": "neutral",
    "positive": "positive",
}

# ── Lazy-loaded singletons (heavy imports only when needed) ──────────────

_sentiment_pipeline = None
_ocr_reader = None


def _get_sentiment_pipeline():
    """Load the sentiment model once per worker process."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        from transformers import pipeline
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model=MODEL_NAME,
            tokenizer=MODEL_NAME,
            max_length=512,
            truncation=True,
        )
        logger.info("Sentiment pipeline loaded: %s", MODEL_NAME)
    return _sentiment_pipeline


def _get_ocr_reader():
    """Load EasyOCR reader once per worker process (English + Arabic)."""
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(["en", "ar"], gpu=False)
        logger.info("EasyOCR reader loaded (en + ar)")
    return _ocr_reader


# ── Helper functions ─────────────────────────────────────────────────────

def _detect_language(text: str) -> str:
    """Detect language, returning 'en', 'ar', or 'unknown'."""
    if not text or not text.strip():
        return "unknown"
    try:
        lang = detect(text)
        if lang == "ar":
            return "ar"
        if lang in ("en", "en-us", "en-gb"):
            return "en"
        # Model handles many languages; map non-en/ar to 'unknown'
        return "unknown"
    except LangDetectException:
        return "unknown"


def _run_sentiment(text: str) -> tuple[str, float]:
    """Run sentiment analysis, return (label, score)."""
    if not text or not text.strip():
        return "neutral", 0.0

    pipe = _get_sentiment_pipeline()
    # Truncate to avoid tokenizer issues
    result = pipe(text[:512])[0]
    raw_label = result["label"]
    label = LABEL_MAP.get(raw_label, "neutral")
    score = round(result["score"], 4)
    return label, score


def _extract_ocr_text(media_url: str) -> str | None:
    """Download image from URL and run OCR to extract text."""
    if not media_url:
        return None
    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            resp = client.get(media_url)
            resp.raise_for_status()
            image_bytes = resp.content

        reader = _get_ocr_reader()
        results = reader.readtext(image_bytes, detail=0)
        text = " ".join(results).strip()
        return text if text else None
    except Exception as exc:
        logger.warning("OCR failed for %s: %s", media_url, exc)
        return None


def _analyze_single_post(post: Post, db: Session) -> bool:
    """Analyze one post and insert an analysis_result row. Returns True on success."""
    caption = post.caption or ""
    ocr_text = None

    # OCR for image and carousel posts
    content_type = str(post.content_type.value) if post.content_type else ""
    if content_type in ("image", "carousel") and post.media_url:
        ocr_text = _extract_ocr_text(post.media_url)

    # Combine caption + OCR text for analysis
    analysis_text = caption
    if ocr_text:
        analysis_text = f"{caption} {ocr_text}".strip()

    # Detect language
    lang = _detect_language(analysis_text)

    # Run sentiment
    sentiment, score = _run_sentiment(analysis_text)

    # Update post language if currently unknown
    if post.language == LanguageCode.unknown and lang != "unknown":
        post.language = lang

    # Create analysis result
    result = AnalysisResult(
        post_id=post.id,
        sentiment=sentiment,
        sentiment_score=score,
        topics=[],
        ocr_text=ocr_text,
        audio_transcript=None,
        language_detected=lang,
        model_used=MODEL_NAME,
    )
    db.add(result)
    return True


# ── Celery tasks ─────────────────────────────────────────────────────────

@celery.task(name="analyze_posts", bind=True, max_retries=2)
def analyze_posts(self):
    """Analyze all posts that don't have an analysis_result yet."""
    db = SessionLocal()
    try:
        # Find posts without analysis results
        posts = (
            db.query(Post)
            .outerjoin(AnalysisResult, Post.id == AnalysisResult.post_id)
            .filter(AnalysisResult.id.is_(None))
            .all()
        )

        if not posts:
            logger.info("No unanalyzed posts found")
            return {"status": "ok", "analyzed": 0, "skipped": 0}

        logger.info("Found %d posts to analyze", len(posts))

        analyzed = 0
        skipped = 0

        for post in posts:
            try:
                _analyze_single_post(post, db)
                analyzed += 1
                # Commit in batches of 10 to avoid long transactions
                if analyzed % 10 == 0:
                    db.commit()
                    logger.info("Progress: %d/%d analyzed", analyzed, len(posts))
            except Exception as exc:
                logger.error("Failed to analyze post %s: %s", post.id, exc)
                db.rollback()
                skipped += 1

        db.commit()
        logger.info("Analysis complete: %d analyzed, %d skipped", analyzed, skipped)
        return {"status": "ok", "analyzed": analyzed, "skipped": skipped}

    except Exception as exc:
        db.rollback()
        logger.error("analyze_posts failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)
    finally:
        db.close()


@celery.task(name="analyze_single_post_task", bind=True, max_retries=3)
def analyze_single_post_task(self, post_id: str):
    """Analyze a single post by ID. Useful for on-demand analysis after sync."""
    db = SessionLocal()
    try:
        post = db.query(Post).filter_by(id=post_id).first()
        if not post:
            return {"status": "error", "detail": "post not found"}

        # Skip if already analyzed
        existing = db.query(AnalysisResult).filter_by(post_id=post_id).first()
        if existing:
            return {"status": "skipped", "detail": "already analyzed"}

        _analyze_single_post(post, db)
        db.commit()
        logger.info("Analyzed post %s", post_id)
        return {"status": "ok", "post_id": post_id}

    except Exception as exc:
        db.rollback()
        logger.error("analyze_single_post_task failed for %s: %s", post_id, exc)
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()
