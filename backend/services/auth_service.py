import os
import logging
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

# Pre-configured demo student profiles for instant testing and local development
DEMO_USERS: Dict[str, Dict[str, Any]] = {
    "demo_user_1": {
        "uid": "demo_user_1",
        "email": "alex.morgan@university.edu",
        "name": "Alex Morgan",
        "major": "Computer Science & AI",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        "role": "student",
        "streak_days": 12,
        "completion_rate": 88
    },
    "demo_user_2": {
        "uid": "demo_user_2",
        "email": "sarah.chen@university.edu",
        "name": "Sarah Chen",
        "major": "Biomedical Engineering",
        "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        "role": "student",
        "streak_days": 19,
        "completion_rate": 94
    }
}

DEFAULT_USER = DEMO_USERS["demo_user_1"]

_firebase_initialized = False

def init_firebase() -> bool:
    """Initialize Firebase Admin SDK with credentials or project ID if available."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    project_id = os.getenv("FIREBASE_PROJECT_ID")

    try:
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with service account key: %s", cred_path)
        elif project_id:
            firebase_admin.initialize_app(options={"projectId": project_id})
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with project ID: %s", project_id)
        else:
            logger.info("No Firebase Admin credentials found; running in development demo mode.")
            _firebase_initialized = False
    except Exception as e:
        logger.warning("Could not initialize Firebase Admin SDK: %s. Using fallback auth.", e)
        _firebase_initialized = False

    return _firebase_initialized

# Attempt initialization on import
init_firebase()

def verify_token(token: str) -> Dict[str, Any]:
    """
    Verify a Firebase ID token or handle demo user tokens.
    Returns decoded user claims dictionary.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )

    # Check for demo tokens (e.g. demo-token-demo_user_1)
    if token.startswith("demo-token-"):
        user_key = token.replace("demo-token-", "")
        if user_key in DEMO_USERS:
            return DEMO_USERS[user_key]
        return DEFAULT_USER

    # If Firebase Admin is initialized, verify the live token
    if _firebase_initialized:
        try:
            decoded = auth.verify_id_token(token)
            return {
                "uid": decoded.get("uid"),
                "email": decoded.get("email", ""),
                "name": decoded.get("name") or decoded.get("email", "").split("@")[0].capitalize(),
                "avatar": decoded.get("picture"),
                "role": "student"
            }
        except Exception as e:
            logger.warning("Firebase ID token verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired token: {str(e)}"
            )

    # In development mode, accept any non-empty token string and treat as default user
    return {
        **DEFAULT_USER,
        "token_note": "dev_fallback"
    }

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    FastAPI dependency to extract and verify the current user from the Authorization header.
    In local development, if no header is provided, it safely returns the default demo user.
    """
    if not authorization:
        return DEFAULT_USER

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return DEFAULT_USER

    token = parts[1]
    return verify_token(token)
