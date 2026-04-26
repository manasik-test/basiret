"""
One-off: backfill social_account.username for accounts still showing the
hardcoded "test_user" placeholder (connected before commit 2aaa552 fixed
username resolution in the OAuth callback).

For each matching row, decrypts the stored token, calls
GET https://graph.instagram.com/me?fields=id,username, and updates the row
with the real handle. Skips accounts whose token can't be decrypted, whose
/me call fails, or whose response doesn't include a username — those keep
their existing value so a transient failure doesn't blank out the column.

Run inside the API container:
    docker compose -f docker-compose.prod.yml exec -e PYTHONPATH=/app api \\
        python3 scripts/backfill_usernames.py

Idempotent — re-running after success is a no-op (no rows match the filter).
"""
import sys

import httpx

from app.core.database import SessionLocal
from app.core.encryption import decrypt_token
from app.models.social_account import SocialAccount

ME_URL = "https://graph.instagram.com/me"
PLACEHOLDER = "test_user"


def main() -> int:
    db = SessionLocal()
    try:
        accounts = (
            db.query(SocialAccount)
            .filter(SocialAccount.username == PLACEHOLDER)
            .all()
        )
        if not accounts:
            print(f"No accounts with username='{PLACEHOLDER}' — nothing to backfill.")
            return 0

        print(f"Found {len(accounts)} account(s) to backfill:")
        updated = 0
        skipped = 0
        with httpx.Client(timeout=30) as client:
            for account in accounts:
                try:
                    token = decrypt_token(account.access_token_encrypted)
                except Exception as e:
                    print(f"  [skip] {account.id}: token decrypt failed ({e})", file=sys.stderr)
                    skipped += 1
                    continue

                try:
                    resp = client.get(ME_URL, params={"fields": "id,username", "access_token": token})
                except httpx.HTTPError as e:
                    print(f"  [skip] {account.id}: /me request failed ({e})", file=sys.stderr)
                    skipped += 1
                    continue

                if resp.status_code != 200:
                    print(
                        f"  [skip] {account.id}: /me returned HTTP {resp.status_code}: "
                        f"{resp.text[:200]}",
                        file=sys.stderr,
                    )
                    skipped += 1
                    continue

                resolved = resp.json().get("username")
                if not resolved:
                    print(
                        f"  [skip] {account.id}: /me response missing username field "
                        f"(payload: {resp.json()!r})",
                        file=sys.stderr,
                    )
                    skipped += 1
                    continue

                if resolved == PLACEHOLDER:
                    print(f"  [skip] {account.id}: /me itself returned '{PLACEHOLDER}', no change")
                    skipped += 1
                    continue

                account.username = resolved
                print(f"  [ok]   {account.id}: '{PLACEHOLDER}' → '{resolved}'")
                updated += 1

        if updated:
            db.commit()
        print(f"\nDone. Updated: {updated}, skipped: {skipped}.")
        return 0 if skipped == 0 else 2
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
