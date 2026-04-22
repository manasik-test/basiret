"""
Re-encrypt an Instagram access token for the first social account using the
current SECRET_KEY. Use when the prod DB was seeded with a token encrypted
under a different key and sync is failing with "Failed to decrypt".

Run inside the API container:
    docker compose -f docker-compose.prod.yml exec api python3 scripts/seed_production.py
"""
import os
import sys

from app.core.database import SessionLocal
from app.core.encryption import encrypt_token, decrypt_token
from app.models.social_account import SocialAccount


def main() -> int:
    token = os.environ.get("INSTAGRAM_TEST_TOKEN")
    if not token:
        print("ERROR: INSTAGRAM_TEST_TOKEN not set in environment", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        account = db.query(SocialAccount).order_by(SocialAccount.connected_at.asc()).first()
        if account is None:
            print("ERROR: no social_account rows found", file=sys.stderr)
            return 1

        account.access_token_encrypted = encrypt_token(token)
        db.commit()

        decrypt_token(account.access_token_encrypted)

        print(f"Re-encrypted token for account {account.id} (@{account.username})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
