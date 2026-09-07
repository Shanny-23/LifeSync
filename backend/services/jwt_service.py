import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import jwt

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "lifesync-jwt-session-secret-key-2026-secure")
JWT_ALGORITHM = "HS256"
SESSION_EXPIRATION_DAYS = 7


def create_session_token(
    user_id: int,
    email: str,
    name: Optional[str] = None,
    expires_days: int = SESSION_EXPIRATION_DAYS
) -> str:
    """Creates a cryptographically signed JWT token for the user session."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "email": email,
        "name": name or "",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_days)).timestamp())
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT session token. Returns payload dict or None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.PyJWTError):
        return None
