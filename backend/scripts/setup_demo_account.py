"""
Run the full demo-setup pipeline for one social account, in sequence:

  1. Re-encrypt the Instagram test token under the current SECRET_KEY
  2. Sync posts + comments from Instagram
  3. Analyze posts (sentiment + language + OCR) and any unanalyzed comments
  4. Regenerate K-means audience segments
  5. Generate weekly insights for English and Arabic

Usage (inside the API container):
    docker compose -f docker-compose.prod.yml exec api python3 scripts/setup_demo_account.py [social_account_id]

If no ID is passed, the earliest-connected social account is used.
Requires INSTAGRAM_TEST_TOKEN in the environment.

INVARIANT: this script operates on an existing `social_account` row only —
it never creates one. The OAuth `/callback` handler is the single source of
truth for inserting `social_account` rows (Meta's `ig_user_id` is the only
correct value for `platform_account_id`). If no row exists yet, the script
fails fast: connect Instagram through Settings first, then re-run.
"""
import os
import sys
import time

from app.core.database import SessionLocal
from app.core.encryption import encrypt_token
from app.models.social_account import SocialAccount
from app.tasks.instagram_sync import sync_instagram_posts
from app.tasks.nlp_analysis import analyze_posts
from app.tasks.segmentation import segment_audience
from app.tasks.insights import generate_weekly_insights


STEP_TIMEOUT_SECONDS = 1800  # 30 min — first analyze_posts run downloads models


def _log(msg: str) -> None:
    print(msg, flush=True)


def _run_step(step_num: int, label: str, async_result, timeout: int = STEP_TIMEOUT_SECONDS):
    _log(f"\n[{step_num}] {label} — task_id={async_result.id}")
    t0 = time.monotonic()
    result = async_result.get(timeout=timeout, propagate=True)
    elapsed = time.monotonic() - t0
    _log(f"    done in {elapsed:.1f}s → {result}")
    return result


def main() -> int:
    token = os.environ.get("INSTAGRAM_TEST_TOKEN")
    if not token:
        print("ERROR: INSTAGRAM_TEST_TOKEN not set in environment", file=sys.stderr)
        return 1

    requested_id = sys.argv[1] if len(sys.argv) > 1 else None

    db = SessionLocal()
    try:
        if requested_id:
            account = db.query(SocialAccount).filter(SocialAccount.id == requested_id).first()
            if account is None:
                print(f"ERROR: social_account {requested_id} not found", file=sys.stderr)
                return 1
        else:
            account = db.query(SocialAccount).order_by(SocialAccount.connected_at.asc()).first()
            if account is None:
                print("ERROR: no social_account rows found", file=sys.stderr)
                return 1

        account_id = str(account.id)
        _log(f"Target account: {account_id} (@{account.username})")

        _log(f"\n[1] Re-encrypting Instagram token")
        account.access_token_encrypted = encrypt_token(token)
        db.commit()
        _log("    token re-encrypted and committed")
    finally:
        db.close()

    _run_step(2, "Syncing posts + comments from Instagram",
              sync_instagram_posts.delay(account_id))

    _run_step(3, "Analyzing posts (sentiment + language + OCR)",
              analyze_posts.delay())

    _run_step(4, "Regenerating K-means audience segments",
              segment_audience.delay(account_id))

    for lang_code, lang_name in [("en", "English"), ("ar", "Arabic")]:
        _run_step(5, f"Generating weekly insights ({lang_code})",
                  generate_weekly_insights.delay(account_id, lang_name))

    _log("\nAll steps completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
