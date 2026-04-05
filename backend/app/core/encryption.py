"""
Fernet-based symmetric encryption for storing access tokens.
Derives a stable 32-byte key from SECRET_KEY using PBKDF2.
"""
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from app.core.config import settings

_SALT = b"basiret-token-encryption"  # fixed salt — key already has entropy


def _derive_key() -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=480_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(settings.SECRET_KEY.encode()))


_fernet = Fernet(_derive_key())


def encrypt_token(token: str) -> str:
    return _fernet.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    return _fernet.decrypt(encrypted.encode()).decode()
