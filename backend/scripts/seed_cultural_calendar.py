"""Seed (upsert) cultural_event rows from the canonical JSON file.

Usage (inside the api container):
    docker compose exec -e PYTHONPATH=/app api python3 scripts/seed_cultural_calendar.py

Idempotent. Re-running with no JSON changes produces 0 inserted / 0 updated.
Non-destructive: rows present in the DB but absent from the JSON are left
alone (operator handles deletions manually).

Field handling:
  - `last_verified`: string YYYY-MM-DD → datetime.date
  - `is_active`: passed through if present in the JSON; otherwise the model
    default (True) applies on insert. On update, only fields present in the
    JSON entry are touched — so an entry that omits `is_active` will not
    flip an existing row's value.
  - Underscore-prefixed top-level keys in the JSON (`_meta`, `_entry_notes`,
    `_translation_notes`, `_curation_rules`) are documentation only and are
    NOT touched by the seeder.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.cultural_event import CulturalEvent


SEED_FILE = (
    Path(__file__).resolve().parent.parent / "app" / "data" / "cultural_calendar_seed.json"
)

# Computed at module import; safe to reuse across calls.
_MODEL_FIELDS = {c.name for c in CulturalEvent.__table__.columns}


def _coerce_entry(entry: dict) -> dict:
    """Filter to model fields and coerce types (date string → date)."""
    kw = {k: v for k, v in entry.items() if k in _MODEL_FIELDS}
    if isinstance(kw.get("last_verified"), str):
        kw["last_verified"] = date.fromisoformat(kw["last_verified"])
    return kw


def seed_cultural_calendar(
    db: Session, seed_file: Path = SEED_FILE
) -> dict[str, int]:
    """Upsert all entries from the seed file. Returns summary counts.

    The summary dict has four keys:
      - total: number of entries in the JSON file
      - inserted: new rows written this run
      - updated: existing rows whose fields changed
      - unchanged: existing rows with no diff (idempotent re-run path)
    """
    with open(seed_file, encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("entries", [])
    inserted = 0
    updated = 0
    unchanged = 0

    for entry in entries:
        ek = entry.get("event_key")
        if not ek:
            raise ValueError(f"Seed entry missing event_key: {entry!r}")
        kwargs = _coerce_entry(entry)

        existing = (
            db.query(CulturalEvent)
            .filter(CulturalEvent.event_key == ek)
            .one_or_none()
        )
        if existing is None:
            db.add(CulturalEvent(**kwargs))
            inserted += 1
        else:
            changed = False
            for k, v in kwargs.items():
                if k == "event_key":
                    continue
                if getattr(existing, k) != v:
                    setattr(existing, k, v)
                    changed = True
            if changed:
                updated += 1
            else:
                unchanged += 1

    db.commit()
    return {
        "total": len(entries),
        "inserted": inserted,
        "updated": updated,
        "unchanged": unchanged,
    }


def main() -> int:
    db = SessionLocal()
    try:
        result = seed_cultural_calendar(db)
        print(
            f"Seeded cultural_calendar: total={result['total']} "
            f"inserted={result['inserted']} updated={result['updated']} "
            f"unchanged={result['unchanged']}"
        )
        return 0
    except Exception as exc:
        print(f"Seed failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
