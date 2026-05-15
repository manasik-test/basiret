"""
Swappable AI provider layer.

Each concrete provider implements two methods:
    generate_text(system, user, *, account_id, task, source, language) -> str
    generate_json(system, user, *, account_id, task, source, language) -> dict

`get_provider(task)` returns the right provider for a given task based on
runtime config:
    captions  → OpenAI (if OPENAI_API_KEY is set, else Gemini)
    insights  → Gemini
    personas  → Gemini
    pages     → Gemini

Provider failures raise typed exceptions (`AIProviderError` and subclasses) so
callers can distinguish quota / unavailability / malformed-response cases and
serve a graceful degradation. Raw `google.api_core` / `openai` exceptions are
caught here and never leak outside this module.

Every successful call is logged in `ai_usage_log` for per-account rate limiting
and admin visibility. Before each call we check the past 24 hours of usage for
the account+provider; if the limit is exceeded we raise
`AIQuotaExceededError` without contacting the upstream API.

When the caller passes a `language` ("en" or "ar"), the response is checked
post-hoc with langdetect; on a violation we retry once with a stronger
directive. The retry call counts against rate-limit and is logged in
ai_usage_log. If the retry also fails the language check, we serve the
original response (degraded) and log a warning so we can grep for repeat
offenders later. Callers can opt out via `skip_language_check=True` for
endpoints where mixed-language output is legitimate (Ask BASIRET).
"""
from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from app.core.config import settings

logger = logging.getLogger(__name__)

AITask = Literal[
    "captions",
    "insights",
    "personas",
    "pages",
    "ask",
    "vision",
    "image_generation",
]
AISource = Literal["user", "background"]

# One turn in a multi-turn conversation. `assistant` is normalized to the
# right role name per provider (Gemini wants "model", OpenAI wants "assistant").
ChatRole = Literal["user", "assistant"]


# ── Exception hierarchy ──────────────────────────────────────────────────


class AIProviderError(Exception):
    """Base class for any AI-provider failure surfaced to callers."""

    user_message: str = "AI service is temporarily unreachable."
    retry_after_hours: int | None = None

    def __init__(self, message: str = "", *, provider: str = "", task: str = ""):
        super().__init__(message or self.user_message)
        self.provider = provider
        self.task = task


class AIQuotaExceededError(AIProviderError):
    """Provider returned a 429 / quota-exhausted response, OR the per-account
    rate limit was hit before the call was made."""

    user_message = "AI insights are temporarily unavailable. Cached results are shown."
    retry_after_hours = 24


class AIProviderUnavailableError(AIProviderError):
    """5xx, network timeout, connection error — transient upstream issue."""

    user_message = "AI service is temporarily unreachable. Please try again in a few minutes."
    retry_after_hours = None


class AIInvalidResponseError(AIProviderError):
    """Response was received but couldn't be parsed (bad JSON, empty body)."""

    user_message = "AI service returned an unexpected response."
    retry_after_hours = None


class AIBillingLimitError(AIProviderError):
    """The provider account has hit its billing/spend cap. Distinct from
    `AIQuotaExceededError` (rate-limit) because retrying tomorrow doesn't
    help — only raising the limit on the provider dashboard does. Surfaced
    with a specific message so users understand it's a server-side cap, not
    a problem with their input."""

    user_message = (
        "AI image generation has reached its monthly billing limit. "
        "Please try again later or contact support."
    )
    retry_after_hours = None


# ── Language compliance ──────────────────────────────────────────────────


# Languages we currently render in. Adding a third (e.g. French) requires
# both UI translation and a langdetect mapping entry below.
_SUPPORTED_LANGS = {"en", "ar"}

# langdetect needs ~10+ words to be reliable. Short responses (single labels,
# numeric snippets) are skipped to avoid false-positives on phrases like
# "Reach +22%" or "Today" that langdetect can't pin down.
_LANG_CHECK_MIN_WORDS = 10

_ARABIC_CHAR_RE = re.compile(r"[؀-ۿ]")
_LATIN_CHAR_RE = re.compile(r"[A-Za-z]")


def _extract_prose(value: Any) -> str:
    """Flatten all string values in a JSON-like tree into one space-joined
    string. Used to feed langdetect on JSON responses without polluting the
    detection with structural keys."""
    parts: list[str] = []

    def _walk(v: Any) -> None:
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, dict):
            for x in v.values():
                _walk(x)
        elif isinstance(v, list):
            for x in v:
                _walk(x)

    _walk(value)
    return " ".join(parts)


def _detect_language(text: str) -> str | None:
    """Return "en", "ar", or None when the dominant language can't be pinned
    down. Combines a fast character-class check (Arabic vs Latin script) with
    langdetect for everything else. Skips short samples — langdetect is noisy
    on <10 words."""
    if not text:
        return None
    stripped = text.strip()
    if len(stripped.split()) < _LANG_CHECK_MIN_WORDS:
        return None
    arabic = len(_ARABIC_CHAR_RE.findall(stripped))
    latin = len(_LATIN_CHAR_RE.findall(stripped))
    total = arabic + latin
    if total >= 20:
        # Char-class is fast and unambiguous for EN vs AR: any text with >60%
        # of its letter-class in one script is overwhelmingly that language.
        if arabic / total > 0.6:
            return "ar"
        if latin / total > 0.6:
            return "en"
    # Fall back to langdetect for mixed-script or ambiguous text.
    try:
        from langdetect import detect, LangDetectException
    except ImportError:  # langdetect is in requirements.txt but be safe
        return None
    try:
        detected = detect(stripped)
    except LangDetectException:
        return None
    return detected if detected in _SUPPORTED_LANGS else None


def _check_language_compliance(
    text: str, requested_language: str | None
) -> str | None:
    """Return None if `text` is in the requested language (or can't be
    detected reliably). Return a short violation string otherwise.

    Conservative defaults: when in doubt, return None and let the response
    through — we'd rather pass a borderline mismatch than fire a retry on
    every short label.
    """
    if not requested_language or requested_language not in _SUPPORTED_LANGS:
        return None
    detected = _detect_language(text)
    if detected is None or detected == requested_language:
        return None
    return f"detected={detected} expected={requested_language}"


def _retry_language_directive(language: str, violation: str) -> str:
    """Strong directive appended to the system prompt on retry. Concrete
    enough that Gemini can't soft-interpret 'mostly in {language}'."""
    label = "Arabic" if language == "ar" else "English"
    return (
        f"\n\nCRITICAL: Your previous response was not in {label} ({violation}). "
        f"Re-translate ALL prose fields to {label}. If the source data is in a "
        f"different language, you MUST still respond in {label}. Translating "
        f"cross-language content is correct; preserving source language is "
        f"forbidden."
    )


# ── Usage logging + rate limiting ────────────────────────────────────────


def _log_usage(
    *,
    provider: str,
    task: str,
    account_id: str | None,
    source: str,
    tokens_used: int | None,
) -> None:
    """Insert one row into ai_usage_log. Best-effort — a logging failure
    must NEVER break the AI call result that's about to be returned."""
    from app.core.database import SessionLocal
    from app.models.ai_usage_log import AiUsageLog

    db = SessionLocal()
    try:
        db.add(
            AiUsageLog(
                social_account_id=account_id,
                provider=provider,
                task=task,
                source=source,
                tokens_used=tokens_used,
            )
        )
        db.commit()
    except Exception as exc:  # noqa: BLE001 — usage logging is best-effort
        logger.warning("ai_usage_log write failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _check_rate_limit(*, provider: str, account_id: str | None, task: str) -> None:
    """Raise `AIQuotaExceededError` when the account has hit its 24h limit
    for the given provider. Background calls (SWR refresh) and unscoped calls
    (account_id is None — tests, system tasks) bypass the gate but are still
    logged on success."""
    if not account_id:
        return

    if provider == "gemini":
        limit = settings.AI_GEMINI_DAILY_LIMIT_PER_ACCOUNT
    elif provider == "openai":
        limit = settings.AI_OPENAI_DAILY_LIMIT_PER_ACCOUNT
    else:
        return

    if limit <= 0:
        return

    from app.core.database import SessionLocal
    from app.models.ai_usage_log import AiUsageLog
    from sqlalchemy import func

    db = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        count = (
            db.query(func.count(AiUsageLog.id))
            .filter(
                AiUsageLog.social_account_id == account_id,
                AiUsageLog.provider == provider,
                AiUsageLog.called_at >= since,
            )
            .scalar()
        ) or 0
        if count >= limit:
            logger.warning(
                "AI rate limit hit: account=%s provider=%s task=%s count=%d limit=%d",
                account_id, provider, task, count, limit,
            )
            raise AIQuotaExceededError(
                f"{provider} daily limit ({limit}) reached for account",
                provider=provider, task=task,
            )
    finally:
        db.close()


# ── Provider abstraction ─────────────────────────────────────────────────


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    def generate_text(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "pages",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str: ...

    @abstractmethod
    def generate_json(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "pages",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> dict: ...

    def generate_chat(
        self,
        system: str,
        history: list[dict[str, str]],
        new_user_message: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "ask",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str:
        """Multi-turn chat. `history` is a list of {role: 'user'|'assistant', content: str}
        in chronological order; `new_user_message` is the latest turn (kept
        separate so the caller can validate it). Default fallback flattens the
        history into a single user prompt — concrete providers should override
        for native chat semantics."""
        flat = [
            f"[{turn.get('role', 'user').upper()}]: {turn.get('content', '')}"
            for turn in history
            if turn.get("content")
        ]
        flat.append(f"[USER]: {new_user_message}")
        return self.generate_text(
            system, "\n\n".join(flat), temperature,
            account_id=account_id, task=task, source=source,
            language=language, skip_language_check=skip_language_check,
        )


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, model: str = "gemini-2.5-flash-lite") -> None:
        self.model = model

    def _configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    def _client(self, system: str, temperature: float, json_mode: bool):
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gen_cfg_kwargs: dict[str, Any] = {"temperature": temperature}
        if json_mode:
            gen_cfg_kwargs["response_mime_type"] = "application/json"
        return genai.GenerativeModel(
            self.model,
            system_instruction=system,
            generation_config=genai.GenerationConfig(**gen_cfg_kwargs),
        )

    def _invoke(self, system: str, user: str, temperature: float, json_mode: bool):
        if not self._configured():
            raise AIProviderUnavailableError(
                "GEMINI_API_KEY not configured", provider=self.name,
            )
        try:
            model = self._client(system, temperature, json_mode=json_mode)
            return model.generate_content(user)
        except Exception as exc:
            raise self._map_exception(exc) from exc

    def _map_exception(self, exc: Exception) -> AIProviderError:
        """Convert a Gemini SDK exception into the provider-agnostic taxonomy."""
        # Match by class name to avoid hard-importing google.api_core (it's a
        # transitive dep of google-generativeai but shouldn't be relied on
        # as a stable surface).
        cls_name = exc.__class__.__name__
        msg = str(exc)
        if cls_name == "ResourceExhausted" or "429" in msg or "quota" in msg.lower():
            return AIQuotaExceededError(msg, provider=self.name)
        if cls_name in ("DeadlineExceeded", "ServiceUnavailable", "InternalServerError"):
            return AIProviderUnavailableError(msg, provider=self.name)
        if cls_name in ("RetryError", "GoogleAPIError", "GoogleAPICallError"):
            return AIProviderUnavailableError(msg, provider=self.name)
        # httpx / network
        if "timeout" in msg.lower() or "connection" in msg.lower():
            return AIProviderUnavailableError(msg, provider=self.name)
        # Fallback — treat as unavailable rather than crashing the request
        logger.warning("Gemini call failed (unmapped: %s): %s", cls_name, exc)
        return AIProviderUnavailableError(msg, provider=self.name)

    @staticmethod
    def _tokens_used(resp) -> int | None:
        meta = getattr(resp, "usage_metadata", None)
        if not meta:
            return None
        return getattr(meta, "total_token_count", None)

    def generate_text(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "pages",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str:
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        resp = self._invoke(system, user, temperature, json_mode=False)
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            raise AIInvalidResponseError("Gemini returned empty text", provider=self.name)
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        if language and not skip_language_check:
            violation = _check_language_compliance(text, language)
            if violation:
                logger.warning(
                    "language_compliance_violation provider=%s task=%s account=%s %s",
                    self.name, task, account_id, violation,
                )
                retry_text = self._retry_text_for_language(
                    system, user, temperature, language, violation,
                    account_id=account_id, task=task, source=source,
                )
                if retry_text is not None:
                    return retry_text
        return text

    def _retry_text_for_language(
        self,
        system: str,
        user: str,
        temperature: float,
        language: str,
        violation: str,
        *,
        account_id: str | None,
        task: str,
        source: AISource,
    ) -> str | None:
        """Retry once with a stronger language directive. Returns the retry
        text on compliance; returns None when the retry also violates or
        upstream errored (caller then serves the original)."""
        retry_system = system + _retry_language_directive(language, violation)
        try:
            resp = self._invoke(retry_system, user, temperature, json_mode=False)
        except AIProviderError as exc:
            logger.warning(
                "language_compliance_retry_errored provider=%s task=%s account=%s %s",
                self.name, task, account_id, exc,
            )
            return None
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            return None
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        if _check_language_compliance(text, language) is None:
            logger.info(
                "language_compliance_retry_succeeded provider=%s task=%s account=%s",
                self.name, task, account_id,
            )
            return text
        logger.warning(
            "language_compliance_retry_failed provider=%s task=%s account=%s",
            self.name, task, account_id,
        )
        return None

    def generate_json(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "pages",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> dict:
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        resp = self._invoke(system, user, temperature, json_mode=True)
        raw = (getattr(resp, "text", None) or "").strip()
        if not raw:
            raise AIInvalidResponseError("Gemini returned empty JSON body", provider=self.name)
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            raise AIInvalidResponseError(
                f"Gemini returned non-JSON: {exc}", provider=self.name,
            ) from exc
        if not isinstance(parsed, (dict, list)):
            raise AIInvalidResponseError(
                "Gemini JSON wasn't an object or array", provider=self.name,
            )
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        result = parsed if isinstance(parsed, dict) else {"items": parsed}
        if language and not skip_language_check:
            violation = _check_language_compliance(_extract_prose(result), language)
            if violation:
                logger.warning(
                    "language_compliance_violation provider=%s task=%s account=%s %s",
                    self.name, task, account_id, violation,
                )
                retry_result = self._retry_json_for_language(
                    system, user, temperature, language, violation,
                    account_id=account_id, task=task, source=source,
                )
                if retry_result is not None:
                    return retry_result
        return result

    def _retry_json_for_language(
        self,
        system: str,
        user: str,
        temperature: float,
        language: str,
        violation: str,
        *,
        account_id: str | None,
        task: str,
        source: AISource,
    ) -> dict | None:
        """JSON variant of the retry. Same semantics as `_retry_text_for_language`."""
        retry_system = system + _retry_language_directive(language, violation)
        try:
            resp = self._invoke(retry_system, user, temperature, json_mode=True)
        except AIProviderError as exc:
            logger.warning(
                "language_compliance_retry_errored provider=%s task=%s account=%s %s",
                self.name, task, account_id, exc,
            )
            return None
        raw = (getattr(resp, "text", None) or "").strip()
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return None
        if not isinstance(parsed, (dict, list)):
            return None
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        result = parsed if isinstance(parsed, dict) else {"items": parsed}
        if _check_language_compliance(_extract_prose(result), language) is None:
            logger.info(
                "language_compliance_retry_succeeded provider=%s task=%s account=%s",
                self.name, task, account_id,
            )
            return result
        logger.warning(
            "language_compliance_retry_failed provider=%s task=%s account=%s",
            self.name, task, account_id,
        )
        return None

    def generate_chat(
        self,
        system: str,
        history: list[dict[str, str]],
        new_user_message: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "ask",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str:
        # `language` and `skip_language_check` are accepted for API uniformity
        # but Ask BASIRET (the primary caller) intentionally opts out — mixed-
        # language input/output is legitimate in conversational mode, and the
        # post-hoc check would false-positive on bilingual replies.
        del language, skip_language_check
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        if not self._configured():
            raise AIProviderUnavailableError(
                "GEMINI_API_KEY not configured", provider=self.name,
            )
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                self.model,
                system_instruction=system,
                generation_config=genai.GenerationConfig(temperature=temperature),
            )
            # Gemini chat history uses role "model" for the assistant turns and
            # the `parts: [text]` shape. Empty turns are skipped so a stray
            # blank assistant message can't break the alternation invariant.
            mapped = [
                {
                    "role": "model" if (turn.get("role") == "assistant") else "user",
                    "parts": [str(turn.get("content") or "")],
                }
                for turn in history
                if turn.get("content")
            ]
            chat = model.start_chat(history=mapped)
            resp = chat.send_message(new_user_message)
        except Exception as exc:
            raise self._map_exception(exc) from exc
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            raise AIInvalidResponseError("Gemini returned empty chat reply", provider=self.name)
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        return text


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.OPENAI_CAPTION_MODEL

    def _configured(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def _client(self):
        from openai import OpenAI
        return OpenAI(api_key=settings.OPENAI_API_KEY)

    def _invoke(self, system: str, user: str, temperature: float, json_mode: bool):
        if not self._configured():
            raise AIProviderUnavailableError(
                "OPENAI_API_KEY not configured", provider=self.name,
            )
        try:
            client = self._client()
            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            return client.chat.completions.create(**kwargs)
        except Exception as exc:
            raise self._map_exception(exc) from exc

    def _map_exception(self, exc: Exception) -> AIProviderError:
        cls_name = exc.__class__.__name__
        msg = str(exc)
        msg_lower = msg.lower()
        # Billing-cap errors arrive as BadRequestError with a specific code.
        # They're NOT rate-limit errors (waiting won't help) and NOT
        # availability errors (service is fine) — they need their own bucket
        # so the user sees an accurate message.
        if "billing_hard_limit_reached" in msg_lower or "billing_not_active" in msg_lower:
            return AIBillingLimitError(msg, provider=self.name)
        if cls_name in ("RateLimitError",) or "429" in msg or "rate_limit" in msg_lower:
            return AIQuotaExceededError(msg, provider=self.name)
        if cls_name in (
            "APITimeoutError",
            "APIConnectionError",
            "InternalServerError",
            "APIStatusError",
        ):
            return AIProviderUnavailableError(msg, provider=self.name)
        if cls_name == "AuthenticationError":
            return AIProviderUnavailableError(
                "OpenAI authentication failed", provider=self.name,
            )
        if "timeout" in msg_lower or "connection" in msg_lower:
            return AIProviderUnavailableError(msg, provider=self.name)
        logger.warning("OpenAI call failed (unmapped: %s): %s", cls_name, exc)
        return AIProviderUnavailableError(msg, provider=self.name)

    @staticmethod
    def _tokens_used(resp) -> int | None:
        usage = getattr(resp, "usage", None)
        if not usage:
            return None
        return getattr(usage, "total_tokens", None)

    @staticmethod
    def _openai_text(resp) -> str:
        try:
            return (resp.choices[0].message.content or "").strip()
        except (IndexError, AttributeError) as exc:
            raise AIInvalidResponseError(
                f"OpenAI response missing choices[0].message.content: {exc}",
                provider="openai",
            ) from exc

    def generate_text(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "captions",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str:
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        resp = self._invoke(system, user, temperature, json_mode=False)
        text = self._openai_text(resp)
        if not text:
            raise AIInvalidResponseError("OpenAI returned empty text", provider=self.name)
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        if language and not skip_language_check:
            violation = _check_language_compliance(text, language)
            if violation:
                logger.warning(
                    "language_compliance_violation provider=%s task=%s account=%s %s",
                    self.name, task, account_id, violation,
                )
                retry_system = system + _retry_language_directive(language, violation)
                try:
                    retry_resp = self._invoke(retry_system, user, temperature, json_mode=False)
                    retry_text = self._openai_text(retry_resp)
                except AIProviderError as exc:
                    logger.warning(
                        "language_compliance_retry_errored provider=%s task=%s %s",
                        self.name, task, exc,
                    )
                    return text
                if retry_text:
                    _log_usage(
                        provider=self.name, task=task, account_id=account_id,
                        source=source, tokens_used=self._tokens_used(retry_resp),
                    )
                    if _check_language_compliance(retry_text, language) is None:
                        logger.info(
                            "language_compliance_retry_succeeded provider=%s task=%s account=%s",
                            self.name, task, account_id,
                        )
                        return retry_text
                logger.warning(
                    "language_compliance_retry_failed provider=%s task=%s account=%s",
                    self.name, task, account_id,
                )
        return text

    def generate_json(
        self,
        system: str,
        user: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "captions",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> dict:
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        resp = self._invoke(system, user, temperature, json_mode=True)
        raw = self._openai_text(resp)
        if not raw:
            raise AIInvalidResponseError("OpenAI returned empty JSON body", provider=self.name)
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, ValueError) as exc:
            raise AIInvalidResponseError(
                f"OpenAI returned non-JSON: {exc}", provider=self.name,
            ) from exc
        if not isinstance(parsed, (dict, list)):
            raise AIInvalidResponseError(
                "OpenAI JSON wasn't an object or array", provider=self.name,
            )
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        result = parsed if isinstance(parsed, dict) else {"items": parsed}
        if language and not skip_language_check:
            violation = _check_language_compliance(_extract_prose(result), language)
            if violation:
                logger.warning(
                    "language_compliance_violation provider=%s task=%s account=%s %s",
                    self.name, task, account_id, violation,
                )
                retry_system = system + _retry_language_directive(language, violation)
                try:
                    retry_resp = self._invoke(retry_system, user, temperature, json_mode=True)
                    retry_raw = self._openai_text(retry_resp)
                except AIProviderError as exc:
                    logger.warning(
                        "language_compliance_retry_errored provider=%s task=%s %s",
                        self.name, task, exc,
                    )
                    return result
                if retry_raw:
                    try:
                        retry_parsed = json.loads(retry_raw)
                    except (json.JSONDecodeError, ValueError):
                        retry_parsed = None
                    if isinstance(retry_parsed, (dict, list)):
                        _log_usage(
                            provider=self.name, task=task, account_id=account_id,
                            source=source, tokens_used=self._tokens_used(retry_resp),
                        )
                        retry_result = (
                            retry_parsed if isinstance(retry_parsed, dict)
                            else {"items": retry_parsed}
                        )
                        if _check_language_compliance(_extract_prose(retry_result), language) is None:
                            logger.info(
                                "language_compliance_retry_succeeded provider=%s task=%s account=%s",
                                self.name, task, account_id,
                            )
                            return retry_result
                logger.warning(
                    "language_compliance_retry_failed provider=%s task=%s account=%s",
                    self.name, task, account_id,
                )
        return result

    def generate_chat(
        self,
        system: str,
        history: list[dict[str, str]],
        new_user_message: str,
        temperature: float = 0.5,
        *,
        account_id: str | None = None,
        task: str = "ask",
        source: AISource = "user",
        language: str | None = None,
        skip_language_check: bool = False,
    ) -> str:
        del language, skip_language_check  # Same opt-out reasoning as Gemini.generate_chat
        if source == "user":
            _check_rate_limit(provider=self.name, account_id=account_id, task=task)
        if not self._configured():
            raise AIProviderUnavailableError(
                "OPENAI_API_KEY not configured", provider=self.name,
            )
        # OpenAI's role names already match the abstraction's "user"/"assistant"
        # so history passes through directly. System message goes first.
        msgs: list[dict[str, str]] = [{"role": "system", "content": system}]
        for turn in history:
            content = str(turn.get("content") or "")
            if not content:
                continue
            role = "assistant" if turn.get("role") == "assistant" else "user"
            msgs.append({"role": role, "content": content})
        msgs.append({"role": "user", "content": new_user_message})
        try:
            client = self._client()
            resp = client.chat.completions.create(
                model=self.model,
                messages=msgs,
                temperature=temperature,
            )
        except Exception as exc:
            raise self._map_exception(exc) from exc
        try:
            text = (resp.choices[0].message.content or "").strip()
        except (IndexError, AttributeError) as exc:
            raise AIInvalidResponseError(
                f"OpenAI chat response missing choices[0].message.content: {exc}",
                provider=self.name,
            ) from exc
        if not text:
            raise AIInvalidResponseError("OpenAI returned empty chat reply", provider=self.name)
        _log_usage(
            provider=self.name, task=task, account_id=account_id,
            source=source, tokens_used=self._tokens_used(resp),
        )
        return text


_ROUTING: dict[str, str] = {
    "captions": "openai",
    "insights": "gemini",
    "personas": "gemini",
    "pages": "gemini",
    "ask": "gemini",
}


def get_provider(task: AITask) -> AIProvider:
    """Return the provider configured for `task`. Falls back to Gemini when the
    preferred provider isn't configured (e.g. OpenAI not enabled yet)."""
    preferred = _ROUTING.get(task, "gemini")
    if preferred == "openai" and settings.OPENAI_API_KEY:
        return OpenAIProvider()
    return GeminiProvider()
