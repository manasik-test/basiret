"""
Tests for provider-level language compliance check + retry.

Covers Bug 1 from the 2026-05-15 three-bug fix: every prose-producing Gemini /
OpenAI call now runs langdetect on the response; if the dominant language
doesn't match `language=...`, we retry once with a stronger directive and
serve the original on second-time failure.

These tests substitute `GeminiProvider._invoke` directly so we exercise the
real `_check_language_compliance` + `_retry_*_for_language` code paths without
contacting any upstream API.
"""
from unittest.mock import patch

from app.core.ai_provider import (
    AIProviderUnavailableError,
    GeminiProvider,
    _check_language_compliance,
    _detect_language,
    _extract_prose,
    _retry_language_directive,
)


# ── Pure helpers ──────────────────────────────────────────────────


class TestExtractProse:
    """`_extract_prose` is what we feed langdetect for JSON responses — it
    must traverse dicts + lists and skip non-string scalars."""

    def test_flat_dict(self):
        out = _extract_prose({"a": "hello", "b": "world"})
        assert "hello" in out and "world" in out

    def test_nested(self):
        out = _extract_prose({"x": {"y": ["one", "two"], "z": 42}})
        assert "one" in out and "two" in out
        # numbers are NOT included — they confuse langdetect
        assert "42" not in out

    def test_bare_list_wrapping(self):
        out = _extract_prose(["alpha", "beta"])
        assert "alpha" in out and "beta" in out


class TestDetectLanguage:
    """The detector is the gate that decides whether to fire a retry. Short
    text must return None (skip) — we'd rather pass a borderline call than
    retry on every two-word label like "Reach +22%"."""

    def test_short_text_returns_none(self):
        # 7 words — below the 10-word threshold.
        assert _detect_language("This is a short example phrase here") is None

    def test_english_prose(self):
        text = (
            "The top post successfully leveraged a visually appealing video "
            "showcasing a clean pool, directly associating it with quality "
            "service and prompting immediate action through a clear call to action."
        )
        assert _detect_language(text) == "en"

    def test_arabic_prose(self):
        text = (
            "المنشور الناجح استخدم فيديو يركز على نتيجة الخدمة النهائية "
            "مع دعوة واضحة للتواصل واستخدام عبارات جذابة لجذب المشاهد مباشرة "
            "وزيادة التفاعل مع المحتوى المعروض في الصفحة."
        )
        assert _detect_language(text) == "ar"


class TestComplianceChecker:
    def test_compliant_returns_none(self):
        text = "this is an entirely english response that we wanted in english"
        assert _check_language_compliance(text, "en") is None

    def test_violation_returns_description(self):
        text = (
            "هذا نص باللغة العربية بالكامل ولكن طلبنا الرد باللغة الإنجليزية "
            "وهذا ما يجب أن يكتشفه الفاحص."
        )
        violation = _check_language_compliance(text, "en")
        assert violation is not None
        assert "detected=ar" in violation
        assert "expected=en" in violation

    def test_unsupported_requested_lang_skips(self):
        # We only support en/ar today; anything else should NOT fire the retry.
        assert _check_language_compliance("Some text content here for sure", "fr") is None

    def test_none_requested_lang_skips(self):
        # Caller didn't opt in.
        assert _check_language_compliance("Some text content here for sure", None) is None


class TestRetryDirective:
    """Sanity that the strengthened directive names both detected and target
    languages so the retry prompt is unambiguous."""

    def test_directive_names_target_language(self):
        rule = _retry_language_directive("en", "detected=ar expected=en")
        assert "English" in rule
        assert "ar" in rule  # the violation string is included

    def test_directive_arabic(self):
        rule = _retry_language_directive("ar", "detected=en expected=ar")
        assert "Arabic" in rule


# ── Integration via GeminiProvider with mocked _invoke ────────────


class _FakeResp:
    """Stub that quacks like a Gemini SDK response (`.text` attribute +
    `.usage_metadata` for the token logger)."""

    def __init__(self, text):
        self.text = text
        self.usage_metadata = None


def _english_paragraph():
    return (
        "Low-performing posts predominantly use static image formats or "
        "carousels that require user interaction to reveal information, and "
        "several include generic calls to action or incomplete sentences, "
        "failing to create immediate visual impact or clear value proposition."
    )


def _arabic_paragraph():
    return (
        "المنشورات منخفضة الأداء غالباً ما تكون عبارة عن صور أو فيديوهات "
        "لا تعرض نتيجة نهائية واضحة أو تركز على مشاكل عامة دون تقديم حلول "
        "مرئية جذابة. كما أن بعضها يعتمد على روابط واتساب مباشرة دون بناء "
        "اهتمام كافٍ للمشاهد."
    )


class TestProviderGenerateTextLanguageRetry:
    def test_compliant_response_no_retry(self):
        """When Gemini complies on first attempt, `_invoke` fires exactly once."""
        provider = GeminiProvider()
        responses = [_FakeResp(_english_paragraph())]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return responses.pop(0)

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            text = provider.generate_text(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 1
        assert "Low-performing" in text

    def test_violation_triggers_one_retry(self):
        """Gemini returns Arabic on attempt 1 (violation), English on retry."""
        provider = GeminiProvider()
        responses = [_FakeResp(_arabic_paragraph()), _FakeResp(_english_paragraph())]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return responses.pop(0)

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            text = provider.generate_text(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 2  # one violation + one retry
        assert "Low-performing" in text

    def test_both_attempts_violate_serves_original(self):
        """Gemini returns Arabic on both attempts → serve the (non-compliant)
        original rather than blocking the user."""
        provider = GeminiProvider()
        responses = [_FakeResp(_arabic_paragraph()), _FakeResp(_arabic_paragraph())]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return responses.pop(0)

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            text = provider.generate_text(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 2  # tried retry, retry also non-compliant
        # We serve the original Arabic response (degraded path).
        assert "المنشورات" in text

    def test_skip_language_check_bypasses_retry(self):
        """skip_language_check=True takes precedence over `language=`."""
        provider = GeminiProvider()
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return _FakeResp(_arabic_paragraph())

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            text = provider.generate_text(
                "system", "user",
                language="en",
                skip_language_check=True,
                account_id="test-acct",
            )
        assert call_count["n"] == 1  # NO retry attempted
        assert "المنشورات" in text

    def test_retry_errors_serves_original(self):
        """If the retry call itself raises (e.g. quota during retry), we still
        serve the original response — don't trade a language mismatch for a 503."""
        provider = GeminiProvider()
        responses = [_FakeResp(_arabic_paragraph())]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return responses.pop(0)
            raise AIProviderUnavailableError("retry blew up", provider="gemini")

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            text = provider.generate_text(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 2
        assert "المنشورات" in text


class TestProviderGenerateJsonLanguageRetry:
    """Same matrix as the text variant, but for the JSON path which has to
    extract prose from string values across the response tree."""

    def test_compliant_json_no_retry(self):
        provider = GeminiProvider()
        compliant = {
            "why_it_worked": _english_paragraph(),
            "what_to_change": "Switch to short video formats for better reach.",
        }
        import json as _json
        responses = [_FakeResp(_json.dumps(compliant))]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return responses.pop(0)

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            result = provider.generate_json(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 1
        assert result["why_it_worked"].startswith("Low-performing")

    def test_violation_triggers_json_retry(self):
        provider = GeminiProvider()
        import json as _json
        bad = {"why_it_worked": _arabic_paragraph(), "what_to_change": "غيّر النمط"}
        good = {
            "why_it_worked": _english_paragraph(),
            "what_to_change": "Use a stronger call-to-action and shorter video formats here.",
        }
        responses = [_FakeResp(_json.dumps(bad)), _FakeResp(_json.dumps(good))]
        call_count = {"n": 0}

        def fake_invoke(*_args, **_kwargs):
            call_count["n"] += 1
            return responses.pop(0)

        with patch.object(provider, "_invoke", side_effect=fake_invoke), \
             patch("app.core.ai_provider._log_usage"), \
             patch("app.core.ai_provider._check_rate_limit"):
            result = provider.generate_json(
                "system", "user", language="en", account_id="test-acct",
            )
        assert call_count["n"] == 2
        assert "Low-performing" in result["why_it_worked"]
