import os
import urllib.parse
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from database import get_db
import models
from services.jwt_service import create_session_token
from services.auth_service import get_current_user, DEMO_USERS, DEFAULT_USER
from seed_data import seed

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

COOKIE_NAME = "lifesync_session"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days in seconds


def get_cookie_secure() -> bool:
    return os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1")


@router.get("/google/login", summary="Initiate Google OAuth2 Login Flow")
def google_login():
    """
    Redirects the browser to Google's OAuth2 consent screen requesting
    scopes: 'openid email profile' for user identity.
    If GOOGLE_CLIENT_ID is not configured, provides a seamless local development
    fallback establishing a session for Totok Michael.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    redirect_uri = os.getenv("GOOGLE_AUTH_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback").strip()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    if not client_id:
        # Development mode fallback: establish session for demo student user
        from database import SessionLocal
        db = SessionLocal()
        try:
            demo_google_id = "google_user_totok_michael_01"
            user = db.query(models.User).filter(models.User.google_id == demo_google_id).first()
            if not user:
                user = models.User(
                    google_id=demo_google_id,
                    email="totok.michael@university.edu",
                    name="Totok Michael",
                    picture_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                )
                db.add(user)
                db.commit()
                db.refresh(user)

            # Seed initial sample data for this user if they don't have tasks yet
            existing_tasks = db.query(models.Task).filter(models.Task.user_id == user.id).count()
            if existing_tasks == 0:
                seed(user_id=user.id)

            session_token = create_session_token(user_id=user.id, email=user.email, name=user.name)
            response = RedirectResponse(url=f"{frontend_url}/dashboard", status_code=302)
            response.set_cookie(
                key=COOKIE_NAME,
                value=session_token,
                max_age=COOKIE_MAX_AGE,
                httponly=True,
                samesite="lax",
                secure=get_cookie_secure(),
                path="/"
            )
            return response
        finally:
            db.close()

    # Live Google OAuth 2.0 Flow (identity scopes only: openid, email, profile)
    scopes = "openid email profile"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "prompt": "consent"
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/google/callback", summary="Google OAuth2 Callback Handler")
async def google_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Exchanges Google authorization code for tokens, retrieves user profile
    from Google UserInfo endpoint, finds or creates User record, and sets
    httpOnly session JWT cookie.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    if error:
        return RedirectResponse(url=f"{frontend_url}/landing?auth_error={urllib.parse.quote(error)}")

    if not code:
        return RedirectResponse(url=f"{frontend_url}/landing?auth_error=missing_code")

    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv("GOOGLE_AUTH_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback").strip()

    try:
        # Exchange authorization code for tokens with Google OAuth
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                },
                headers={"Accept": "application/json"}
            )

            if token_res.status_code != 200:
                logger_msg = f"Failed Google token exchange: {token_res.text}"
                return RedirectResponse(url=f"{frontend_url}/landing?auth_error=token_exchange_failed")

            token_data = token_res.json()
            access_token = token_data.get("access_token")

            # Fetch user profile using userinfo endpoint
            userinfo_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if userinfo_res.status_code != 200:
                return RedirectResponse(url=f"{frontend_url}/landing?auth_error=userinfo_failed")

            userinfo = userinfo_res.json()

        google_id = userinfo.get("sub")
        email = userinfo.get("email")
        name = userinfo.get("name") or email.split("@")[0].capitalize()
        picture_url = userinfo.get("picture")

        if not google_id or not email:
            return RedirectResponse(url=f"{frontend_url}/landing?auth_error=missing_profile_data")

        # Find or create user
        user = db.query(models.User).filter(
            (models.User.google_id == google_id) | (models.User.email == email)
        ).first()

        if not user:
            user = models.User(
                google_id=google_id,
                email=email,
                name=name,
                picture_url=picture_url
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Auto-seed initial tasks for this new user so dashboard is populated
            seed(user_id=user.id)
        else:
            # Update latest profile details
            user.google_id = google_id
            user.name = name or user.name
            user.picture_url = picture_url or user.picture_url
            db.commit()

        # Generate JWT session token
        session_token = create_session_token(user_id=user.id, email=user.email, name=user.name)

        # Set secure httpOnly cookie and redirect to dashboard
        response = RedirectResponse(url=f"{frontend_url}/dashboard", status_code=302)
        response.set_cookie(
            key=COOKIE_NAME,
            value=session_token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=get_cookie_secure(),
            path="/"
        )
        return response

    except Exception as exc:
        return RedirectResponse(url=f"{frontend_url}/landing?auth_error={urllib.parse.quote(str(exc))}")


@router.get("/me", summary="Get Current Authenticated User Profile")
def get_me(current_user: models.User = Depends(get_current_user)):
    """
    Returns the basic profile of the currently logged-in user.
    Throws 401 Unauthorized if not authenticated.
    """
    profile = {
        "id": current_user.id,
        "google_id": current_user.google_id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }
    return {
        **profile,
        "user": profile
    }


@router.post("/logout", summary="Log Out of Current Session")
def logout(response: Response):
    """
    Clears the httpOnly session cookie and ends the user session.
    """
    res = JSONResponse(content={"success": True, "message": "Logged out successfully"})
    res.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        samesite="lax"
    )
    return res
