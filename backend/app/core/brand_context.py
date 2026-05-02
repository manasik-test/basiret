"""
Brand-identity → prompt context formatting.

Mirrors `format_business_profile` from `app.tasks.insights`, but reads from the
`organization.brand_identity` JSONB column. Returns an empty string when nothing
is set so callers can concatenate without conditional formatting:

    block = format_business_profile(profile) + format_brand_identity(org_id, db)
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.organization import Organization


_TONE_LABELS = {
    "professional": "Professional",
    "friendly": "Friendly",
    "luxurious": "Luxurious",
    "playful": "Playful",
    "inspiring": "Inspiring",
}

_LANGUAGE_STYLE_LABELS = {
    "formal_arabic": "Formal Arabic (فصحى)",
    "casual_dialect": "Casual Arabic (عامية)",
    "bilingual": "Bilingual (Arabic + English)",
}

_EMOJI_LABELS = {
    "never": "Never",
    "occasionally": "Occasionally",
    "frequently": "Frequently",
}

_LENGTH_LABELS = {
    "short": "Short (<50 words)",
    "medium": "Medium (50-100 words)",
    "long": "Long (100+ words)",
}


def format_brand_identity(org_id, db: Session) -> str:
    """Return a BRAND IDENTITY block for prompt injection.

    Returns an empty string if the organization is unknown or has no brand
    identity configured. This means a creator who has not visited the Brand
    Identity tab gets the same AI behavior as before — graceful fallback.
    """
    if org_id is None:
        return ""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.brand_identity:
        return ""
    bi = org.brand_identity
    pillars_list = [p for p in (bi.get("content_pillars") or []) if p]
    pillars = ", ".join(pillars_list) if pillars_list else "(not set)"
    tone_label = _TONE_LABELS.get(bi.get("tone"), str(bi.get("tone") or "Friendly").title())
    lang_label = _LANGUAGE_STYLE_LABELS.get(
        bi.get("language_style"), "Bilingual (Arabic + English)"
    )
    emoji_label = _EMOJI_LABELS.get(bi.get("emoji_usage"), "Occasionally")
    length_label = _LENGTH_LABELS.get(bi.get("caption_length"), "Medium (50-100 words)")
    return (
        "BRAND IDENTITY:\n"
        f"- Tone: {tone_label}\n"
        f"- Language style: {lang_label}\n"
        f"- Emoji usage: {emoji_label}\n"
        f"- Caption length: {length_label}\n"
        f"- Content pillars: {pillars}\n"
        f"- Primary color: {bi.get('primary_color', '#664FA1')}\n"
    )
