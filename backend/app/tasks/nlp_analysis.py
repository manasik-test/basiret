"""
Celery task: run NLP analysis on posts.

For each post without an analysis_result:
1. Extract text via OCR (image/carousel posts)
2. Combine caption + OCR text into one analysis document
   (audio transcription is stubbed — see _extract_audio_transcript TODO)
3. Detect language (en/ar/unknown) on the combined document
4. Run sentiment analysis using cardiffnlp/twitter-xlm-roberta-base-sentiment
5. Extract 2-3 topics via Gemini
6. Store results in analysis_result table
"""
import logging
import re

import httpx
from langdetect import detect, LangDetectException
from sqlalchemy.orm import Session

from app.core.celery_app import celery
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.post import Post, LanguageCode
from app.models.comment import Comment
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


def _run_sentiment_batch(texts: list[str]) -> list[tuple[str, float]]:
    """Run sentiment on a list of texts in one pipeline call. Returns one
    (label, score) per input. Empty/whitespace items short-circuit to
    ('neutral', 0.0) without being sent to the model."""
    if not texts:
        return []
    non_empty_idx = [i for i, t in enumerate(texts) if t and t.strip()]
    payload = [texts[i][:512] for i in non_empty_idx]
    results: list[tuple[str, float]] = [("neutral", 0.0)] * len(texts)
    if payload:
        pipe = _get_sentiment_pipeline()
        raw = pipe(payload, batch_size=32)
        for idx, r in zip(non_empty_idx, raw):
            label = LABEL_MAP.get(r["label"], "neutral")
            results[idx] = (label, round(r["score"], 4))
    return results


def _run_sentiment(text: str) -> tuple[str, float]:
    """Single-item sentiment. Kept for non-batch callers; internally batches-of-1."""
    return _run_sentiment_batch([text])[0]


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


def _extract_audio_transcript(media_url: str) -> str | None:
    """Audio transcription for video/reel posts.

    TODO: re-enable Whisper-based transcription once a dependency path that
    doesn't conflict with transformers>=4.41 is available (openai-whisper
    needed pkg_resources + triton; faster-whisper pulled in `av`/PyAV which
    needs libav*-dev headers AND pins tokenizers<0.16 which collides with
    transformers' tokenizers>=0.19). Until then the caller receives None and
    _analyze_single_post stores audio_transcript=NULL — the rest of the
    pipeline (OCR + sentiment + topics) is unaffected.
    """
    del media_url  # parameter kept so the signature stays stable for callers
    return None


def _build_analysis_text(caption: str, ocr_text: str | None, audio_transcript: str | None) -> str:
    """Combine caption + OCR text + audio transcript into one document for
    sentiment analysis. Each segment is labeled so the tokenizer treats them
    as distinct — important when languages differ (e.g. Arabic caption with
    English text overlay or English video audio)."""
    parts = []
    if caption and caption.strip():
        parts.append(caption.strip())
    if ocr_text and ocr_text.strip():
        parts.append(f"[IMAGE TEXT]: {ocr_text.strip()}")
    if audio_transcript and audio_transcript.strip():
        parts.append(f"[AUDIO TRANSCRIPT]: {audio_transcript.strip()}")
    return "\n\n".join(parts).strip()


# Minimal multilingual stop-word lists used by the local extractor.
# Intentionally small — covers the most frequent particles so the frequency
# counter isn't dominated by them. Not a substitute for a real keyword model.
_STOPWORDS_EN = {
    "the", "and", "for", "that", "this", "with", "you", "your", "are", "was",
    "but", "not", "have", "has", "had", "from", "our", "they", "them", "what",
    "when", "where", "will", "just", "too", "all", "any", "can", "out", "get",
    "got", "one", "two", "about", "into", "there", "here", "more", "some",
    "than", "then", "now", "also", "been", "their", "these", "those", "like",
    "over", "very", "much", "such", "its", "who", "why", "how",
}
_STOPWORDS_AR = {
    "من", "في", "على", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
    "هو", "هي", "هم", "أن", "إن", "كان", "كانت", "يكون", "تكون", "لا",
    "ما", "لم", "لن", "قد", "كل", "بعض", "نحن", "أنت", "أنتم", "بعد",
    "قبل", "عند", "أو", "ثم", "إذا", "حتى", "لكن", "ولا", "ولكن", "أيضا",
}
_WORD_RE = re.compile(r"[\w\u0600-\u06FF]+", re.UNICODE)


def _extract_topics_local(text: str, language: str) -> list[str]:
    """Frequency-based topic extraction with stop-word removal. Zero external
    calls, zero heavy deps — good enough as a fallback when Gemini is off.
    Quality is modest: favors nouns that repeat, misses paraphrased ideas."""
    if not text or not text.strip():
        return []
    stop = _STOPWORDS_AR if language == "ar" else _STOPWORDS_EN
    tokens = [t.lower() for t in _WORD_RE.findall(text) if len(t) >= 3]
    tokens = [t for t in tokens if t not in stop and not t.isdigit()]
    if not tokens:
        return []
    from collections import Counter
    counts = Counter(tokens)
    return [w for w, _ in counts.most_common(3)]


def _extract_topics_gemini(text: str, language: str) -> list[str]:
    """Ask the topics provider (Gemini) for 2-3 topics the post is about.
    Returns [] on any AI failure — topics are best-effort metadata, never a
    blocker for the analysis pipeline."""
    if not text or not text.strip():
        return []
    from app.core.ai_provider import AIProviderError, get_provider

    lang_label = "Arabic" if language == "ar" else "English"
    sys_prompt = (
        "You extract topics from social media posts. "
        "Given a post's text (which may include caption, on-image text, "
        "and audio transcript), return exactly 2-3 short topic tags that "
        "describe what the post is ABOUT. "
        "Topics must be 1-3 words each, lowercased, concrete (e.g. "
        "'coffee brewing', 'ramadan recipes', 'gym form'), never generic "
        f"('post', 'content'). Return topics in {lang_label}. "
        'Respond ONLY as strict JSON: {"topics": ["...", "..."]}'
    )
    try:
        parsed = get_provider("pages").generate_json(
            sys_prompt, text[:2000], temperature=0.3,
            account_id=None, task="pages", source="background",
        )
    except AIProviderError as exc:
        logger.info(
            "Gemini topic extraction skipped (%s)", exc.__class__.__name__,
        )
        return []
    raw = parsed.get("topics") or parsed.get("items") or []
    topics = [str(t).strip().lower() for t in raw if str(t).strip()]
    return topics[:3]


def _extract_topics(text: str, language: str) -> list[str]:
    """Route topic extraction based on settings.POST_TOPIC_EXTRACTOR:
    'gemini' (default, remote), 'local' (frequency + stop words), or 'off'."""
    mode = (settings.POST_TOPIC_EXTRACTOR or "gemini").strip().lower()
    if mode == "off":
        return []
    if mode == "local":
        return _extract_topics_local(text, language)
    return _extract_topics_gemini(text, language)


def _analyze_single_comment(comment: Comment, db: Session) -> bool:
    """Analyze one comment and insert an analysis_result row (single-item path).
    The batch path `_analyze_comments_batch` is preferred for bulk work."""
    text = (comment.text or "").strip()
    lang = _detect_language(text)
    sentiment, score = _run_sentiment(text)
    topics = (
        _extract_topics(text, lang)
        if text and settings.EXTRACT_COMMENT_TOPICS
        else []
    )
    result = AnalysisResult(
        comment_id=comment.id,
        sentiment=sentiment,
        sentiment_score=score,
        topics=topics,
        ocr_text=None,
        audio_transcript=None,
        language_detected=lang,
        model_used=MODEL_NAME,
    )
    db.add(result)
    return True


def _analyze_comments_batch(comments: list[Comment], db: Session) -> tuple[int, int]:
    """Analyze a list of comments using batched sentiment inference.
    One pipeline call per chunk instead of one per comment. Returns
    (analyzed, skipped). Safe to call with [] — returns (0, 0)."""
    if not comments:
        return 0, 0

    texts = [(c.text or "").strip() for c in comments]
    langs = [_detect_language(t) for t in texts]
    try:
        sentiments = _run_sentiment_batch(texts)
    except Exception as exc:
        logger.error("Batch sentiment failed for %d comments: %s", len(comments), exc)
        return 0, len(comments)

    analyzed = skipped = 0
    for comment, text, lang, (sentiment, score) in zip(comments, texts, langs, sentiments):
        try:
            topics = (
                _extract_topics(text, lang)
                if text and settings.EXTRACT_COMMENT_TOPICS
                else []
            )
            db.add(AnalysisResult(
                comment_id=comment.id,
                sentiment=sentiment,
                sentiment_score=score,
                topics=topics,
                ocr_text=None,
                audio_transcript=None,
                language_detected=lang,
                model_used=MODEL_NAME,
            ))
            analyzed += 1
            if analyzed % 50 == 0:
                db.commit()
                logger.info("Comments progress: %d/%d", analyzed, len(comments))
        except Exception as exc:
            logger.error("Failed to store analysis for comment %s: %s", comment.id, exc)
            db.rollback()
            skipped += 1

    if analyzed > 0:
        db.commit()
    return analyzed, skipped


def _analyze_single_post(post: Post, db: Session) -> bool:
    """Analyze one post and insert an analysis_result row. Returns True on success."""
    caption = post.caption or ""
    ocr_text = None
    audio_transcript = None

    # OCR for image and carousel posts
    content_type = str(post.content_type.value) if post.content_type else ""
    if content_type in ("image", "carousel") and post.media_url:
        ocr_text = _extract_ocr_text(post.media_url)

    # Whisper transcription for video and reel posts
    if content_type in ("video", "reel") and post.media_url:
        audio_transcript = _extract_audio_transcript(post.media_url)

    # Build combined analysis document (caption + OCR + audio transcript).
    # Each source is labeled with a tag so the tokenizer treats them as
    # distinct segments — important when a caption is in one language and
    # the image text or audio is in another (e.g. Arabic caption with
    # English text overlay, or Arabic reel with English audio).
    analysis_text = _build_analysis_text(caption, ocr_text, audio_transcript)

    # Detect language on the combined document
    lang = _detect_language(analysis_text)

    # Run sentiment on the combined document — the signal from OCR slogans and
    # spoken audio often changes sentiment from "neutral" (empty caption) to
    # the actual tone of the content.
    sentiment, score = _run_sentiment(analysis_text)

    # Extract 2-3 topics — routed via settings.POST_TOPIC_EXTRACTOR
    # (gemini / local / off). Per-post only — comment topics gated by
    # EXTRACT_COMMENT_TOPICS.
    topics = _extract_topics(analysis_text, lang) if analysis_text else []

    # Update post language if currently unknown
    if post.language == LanguageCode.unknown and lang != "unknown":
        post.language = lang

    result = AnalysisResult(
        post_id=post.id,
        sentiment=sentiment,
        sentiment_score=score,
        topics=topics,
        ocr_text=ocr_text,
        audio_transcript=audio_transcript,
        language_detected=lang,
        model_used=MODEL_NAME,
    )
    db.add(result)
    return True


# ── Celery tasks ─────────────────────────────────────────────────────────

@celery.task(name="analyze_posts", bind=True, max_retries=2)
def analyze_posts(self):
    """Analyze all posts AND comments that don't have an analysis_result yet."""
    db = SessionLocal()
    try:
        posts = (
            db.query(Post)
            .outerjoin(AnalysisResult, Post.id == AnalysisResult.post_id)
            .filter(AnalysisResult.id.is_(None))
            .all()
        )

        comments = (
            db.query(Comment)
            .outerjoin(AnalysisResult, Comment.id == AnalysisResult.comment_id)
            .filter(AnalysisResult.id.is_(None))
            .filter(Comment.text.isnot(None))
            .all()
        )

        if not posts and not comments:
            logger.info("No unanalyzed posts or comments found")
            return {
                "status": "ok",
                "posts_analyzed": 0, "posts_skipped": 0,
                "comments_analyzed": 0, "comments_skipped": 0,
            }

        logger.info("Found %d posts and %d comments to analyze", len(posts), len(comments))

        posts_analyzed = posts_skipped = 0
        for post in posts:
            try:
                _analyze_single_post(post, db)
                posts_analyzed += 1
                if posts_analyzed % 10 == 0:
                    db.commit()
                    logger.info("Posts progress: %d/%d", posts_analyzed, len(posts))
            except Exception as exc:
                logger.error("Failed to analyze post %s: %s", post.id, exc)
                db.rollback()
                posts_skipped += 1

        db.commit()

        comments_analyzed, comments_skipped = _analyze_comments_batch(comments, db)

        logger.info(
            "Analysis complete: posts %d/%d, comments %d/%d",
            posts_analyzed, posts_skipped, comments_analyzed, comments_skipped,
        )
        return {
            "status": "ok",
            "posts_analyzed": posts_analyzed, "posts_skipped": posts_skipped,
            "comments_analyzed": comments_analyzed, "comments_skipped": comments_skipped,
        }

    except Exception as exc:
        db.rollback()
        logger.error("analyze_posts failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)
    finally:
        db.close()


@celery.task(name="analyze_comments", bind=True, max_retries=2)
def analyze_comments(self):
    """Analyze only unanalyzed comments. Useful right after a sync."""
    db = SessionLocal()
    try:
        comments = (
            db.query(Comment)
            .outerjoin(AnalysisResult, Comment.id == AnalysisResult.comment_id)
            .filter(AnalysisResult.id.is_(None))
            .filter(Comment.text.isnot(None))
            .all()
        )

        if not comments:
            return {"status": "ok", "analyzed": 0, "skipped": 0}

        analyzed, skipped = _analyze_comments_batch(comments, db)
        return {"status": "ok", "analyzed": analyzed, "skipped": skipped}

    except Exception as exc:
        db.rollback()
        logger.error("analyze_comments failed: %s", exc)
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
