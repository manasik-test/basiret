"""
JWT token management and password hashing.

Access tokens: short-lived (15 min), sent in Authorization header.
Refresh tokens: long-lived (30 days), sent as httpOnly cookie.
Blacklisted refresh tokens stored in Redis with TTL matching expiry.
"""
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from redis import Redis

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Redis client for token blacklist
_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# ── Password helpers ────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ─────────────────────────────────────────────

def create_access_token(user_id: str, organization_id: str, role: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "org": organization_id,
        "role": role,
        "type": "access",
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Return (token_string, jti) — jti is used for blacklisting."""
    jti = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": jti,
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload dict or None on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


# ── OAuth state token (single-purpose, short-lived) ─────────

def create_oauth_state_token(user_id: str, ttl_minutes: int = 10) -> str:
    """Sign a short-lived JWT used as the OAuth `state` param.

    Carried through Meta's redirect so the public /callback can identify the
    user without requiring a session token. Single-purpose (`type=oauth_state`)
    so a leaked state can't be replayed against authenticated endpoints.
    """
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": user_id,
        "type": "oauth_state",
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ── Refresh-token blacklist (Redis) ────────────────────────

def blacklist_refresh_token(jti: str) -> None:
    """Add refresh token jti to blacklist with TTL = refresh expiry."""
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    get_redis().setex(f"blacklist:{jti}", ttl, "1")


def is_token_blacklisted(jti: str) -> bool:
    return get_redis().exists(f"blacklist:{jti}") > 0
