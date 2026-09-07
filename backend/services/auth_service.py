import os
import logging
from typing import Optional, Dict, Any
from fastapi import Request, Header, HTTPException, status, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
from services.jwt_service import verify_session_token

logger = logging.getLogger(__name__)

# Pre-configured demo student profiles for development and fast testing
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


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """
    Validates the authenticated session using httpOnly cookie 'lifesync_session'
    or 'Authorization: Bearer <token>' header.
    Returns the database User model, or raises 401 Unauthorized.
    """
    token = request.cookies.get("lifesync_session")

    # Fallback to Authorization Bearer header if cookie not sent
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in."
        )

    # Handle demo tokens
    if token.startswith("demo-token-"):
        persona_key = token.replace("demo-token-", "")
        persona = DEMO_USERS.get(persona_key, DEFAULT_USER)
        
        # Ensure demo user exists in database
        db_user = db.query(models.User).filter(models.User.google_id == persona["uid"]).first()
        if not db_user:
            db_user = models.User(
                google_id=persona["uid"],
                email=persona["email"],
                name=persona["name"],
                picture_url=persona["avatar"]
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        return db_user

    # Validate JWT session token
    payload = verify_session_token(token)
    if not payload or "user_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again."
        )

    user_id = payload["user_id"]
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found."
        )

    return user


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Returns current user if authenticated, or None if not."""
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None
