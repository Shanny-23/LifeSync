import os
import urllib.parse
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from pydantic import BaseModel
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


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    major: Optional[str] = "Computer Science & AI"


class DemoLoginRequest(BaseModel):
    persona: str = "demo_user_1"


@router.get("/google/login", summary="Initiate Google OAuth2 Login Flow")
def google_login(request: Request):
    """
    Redirects the browser to Google's OAuth2 consent screen requesting
    scopes: 'openid email profile' for user identity.
    If GOOGLE_CLIENT_ID is not configured, provides a seamless local development
    fallback establishing a session for Totok Michael.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    redirect_uri = os.getenv("GOOGLE_AUTH_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/google/callback").strip()
    
    # Intelligently resolve frontend URL based on caller origin (127.0.0.1 vs localhost)
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if "127.0.0.1:5173" in origin:
        frontend_url = "http://127.0.0.1:5173"
    elif "localhost:5173" in origin:
        frontend_url = "http://localhost:5173"
    else:
        frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")

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
            response = RedirectResponse(url=f"{frontend_url}/dashboard?token={session_token}", status_code=302)
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


@router.post("/login", summary="Sign in with Email and Password")
def email_login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Sign in with an email address. If the student doesn't exist yet,
    gracefully auto-provisions their student account so they never get locked out.
    """
    email_clean = data.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid university or personal email address."
        )

    # Check for known demo user aliases
    demo_match = None
    for p_id, p_data in DEMO_USERS.items():
        if p_data.get("email", "").lower() == email_clean:
            demo_match = p_data
            break

    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user:
        # Auto-create student user account
        default_name = demo_match["name"] if demo_match else email_clean.split("@")[0].replace(".", " ").title()
        default_avatar = demo_match["avatar"] if demo_match else "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        user = models.User(
            google_id=f"email_user_{email_clean}",
            email=email_clean,
            name=default_name,
            picture_url=default_avatar
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed(user_id=user.id)

    session_token = create_session_token(user_id=user.id, email=user.email, name=user.name)

    res = JSONResponse(
        content={
            "success": True,
            "token": session_token,
            "user": {
                "id": user.id,
                "uid": user.google_id,
                "email": user.email,
                "name": user.name,
                "picture_url": user.picture_url,
                "avatar": user.picture_url,
                "major": "Computer Science & AI",
                "streak_days": 12,
                "completion_rate": 88
            }
        }
    )
    res.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_cookie_secure(),
        path="/"
    )
    return res


@router.post("/register", summary="Register New Student Account")
def email_register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """
    Register a new student account with name, email, and academic major.
    """
    email_clean = data.email.strip().lower()
    name_clean = data.name.strip()

    if not email_clean or "@" not in email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address."
        )
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your full student name."
        )

    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user:
        user = models.User(
            google_id=f"registered_user_{email_clean}",
            email=email_clean,
            name=name_clean,
            picture_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        # Seed initial curriculum and sample schedule for new student
        seed(user_id=user.id)
    else:
        user.name = name_clean
        db.commit()

    session_token = create_session_token(user_id=user.id, email=user.email, name=user.name)

    res = JSONResponse(
        content={
            "success": True,
            "token": session_token,
            "user": {
                "id": user.id,
                "uid": user.google_id,
                "email": user.email,
                "name": user.name,
                "picture_url": user.picture_url,
                "avatar": user.picture_url,
                "major": data.major or "Computer Science & AI",
                "streak_days": 1,
                "completion_rate": 100
            }
        }
    )
    res.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_cookie_secure(),
        path="/"
    )
    return res


@router.post("/demo", summary="One-Click Demo Student Persona Login")
def demo_login(data: DemoLoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Instantly authenticates as one of the pre-configured student personas.
    """
    persona_key = data.persona
    persona = DEMO_USERS.get(persona_key, DEFAULT_USER)

    user = db.query(models.User).filter(models.User.google_id == persona["uid"]).first()
    if not user:
        user = models.User(
            google_id=persona["uid"],
            email=persona["email"],
            name=persona["name"],
            picture_url=persona["avatar"]
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed(user_id=user.id)

    session_token = create_session_token(user_id=user.id, email=user.email, name=user.name)

    res = JSONResponse(
        content={
            "success": True,
            "token": session_token,
            "user": {
                "id": user.id,
                "uid": persona["uid"],
                "email": user.email,
                "name": user.name,
                "picture_url": user.picture_url,
                "avatar": user.picture_url,
                "major": persona.get("major", "Computer Science & AI"),
                "streak_days": persona.get("streak_days", 12),
                "completion_rate": persona.get("completion_rate", 88)
            }
        }
    )
    res.set_cookie(
        key=COOKIE_NAME,
        value=session_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_cookie_secure(),
        path="/"
    )
    return res


class DemoLoginLegacyRequest(BaseModel):
    user_id: Optional[str] = None
    persona: Optional[str] = None


class VerifyTokenRequest(BaseModel):
    token: str


@router.get("/demo-users", summary="List Available Demo Student Personas")
def list_demo_users():
    """Returns list of pre-configured demo student profiles."""
    users_list = list(DEMO_USERS.values())
    return {
        "status": "success",
        "users": users_list
    }


@router.post("/demo-login", summary="Legacy/Alternative Demo Student Persona Login")
def legacy_demo_login(payload: DemoLoginLegacyRequest, response: Response, db: Session = Depends(get_db)):
    """Accepts user_id or persona key for demo login."""
    target_persona = payload.user_id or payload.persona or "demo_user_1"
    persona = DEMO_USERS.get(target_persona, DEFAULT_USER)

    user = db.query(models.User).filter(models.User.google_id == persona["uid"]).first()
    if not user:
        user = models.User(
            google_id=persona["uid"],
            email=persona["email"],
            name=persona["name"],
            picture_url=persona["avatar"]
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        seed(user_id=user.id)

    token_str = f"demo-token-{persona['uid']}"
    user_dict = {
        "id": user.id,
        "uid": persona["uid"],
        "email": user.email,
        "name": user.name,
        "picture_url": user.picture_url,
        "avatar": user.picture_url,
        "major": persona.get("major", "Computer Science & AI"),
        "streak_days": persona.get("streak_days", 12),
        "completion_rate": persona.get("completion_rate", 88)
    }

    res = JSONResponse(
        content={
            "status": "success",
            "success": True,
            "token": token_str,
            "user": user_dict
        }
    )
    res.set_cookie(
        key=COOKIE_NAME,
        value=token_str,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_cookie_secure(),
        path="/"
    )
    return res


@router.post("/verify", summary="Verify Session Token and Return User Profile")
def verify_token_endpoint(payload: VerifyTokenRequest, db: Session = Depends(get_db)):
    """Verifies a JWT token or demo token string."""
    token = payload.token.strip()
    if token.startswith("demo-token-"):
        persona_key = token.replace("demo-token-", "")
        persona = DEMO_USERS.get(persona_key, DEFAULT_USER)
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
        return {
            "status": "success",
            "valid": True,
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "picture_url": db_user.picture_url
            }
        }

    from services.jwt_service import verify_session_token
    token_payload = verify_session_token(token)
    if not token_payload or "user_id" not in token_payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = token_payload["user_id"]
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {
        "status": "success",
        "valid": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "picture_url": user.picture_url
        }
    }

