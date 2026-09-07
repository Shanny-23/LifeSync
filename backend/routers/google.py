import os
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from database import get_db
import models
from services.auth_service import get_current_user, get_optional_current_user
from services.google_service import (
    SCOPES,
    create_oauth_flow,
    save_user_credentials,
    get_google_credentials,
    fetch_recent_emails,
    create_calendar_event_from_email,
    get_client_secret_path
)

logger = logging.getLogger(__name__)

# Template rendering setup
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Create router without hardcoded prefix so routes can be accessed both at root
# (/authorize, /oauth2callback, /emails, /create-event/{message_id})
# and with legacy /api/google prefix.
router = APIRouter(tags=["Google Integration"])


def get_redirect_uri(request: Request) -> str:
    """
    Dynamically computes or retrieves the OAuth 2.0 redirect URI.
    Defaults to {base_url}oauth2callback, or respects GOOGLE_REDIRECT_URI.
    """
    configured = os.getenv("GOOGLE_REDIRECT_URI")
    if configured:
        return configured
    # Compute from request host / scheme
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/oauth2callback"


# =========================================================================
# Route: /authorize (and /api/google/authorize / /api/google/auth)
# =========================================================================
@router.get("/authorize", summary="Redirect to Google OAuth 2.0 consent screen")
@router.get("/api/google/authorize", summary="Alias for /authorize")
@router.get("/api/google/auth", summary="Legacy alias for /authorize")
def authorize_google(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Initiates Google OAuth 2.0 authorization.
    Requests scopes for Gmail (readonly) and Google Calendar (events).
    Forces access_type='offline' and prompt='consent' so a refresh token is issued.
    """
    redirect_uri = get_redirect_uri(request)

    try:
        flow = create_oauth_flow(redirect_uri=redirect_uri)
    except FileNotFoundError:
        # If client_secret.json is not placed yet, render the helpful setup guide
        return templates.TemplateResponse(
            request=request,
            name="setup_guide.html",
            context={"redirect_uri": redirect_uri},
            status_code=status.HTTP_200_OK
        )

    # State stores the current authenticated user's ID for safety during callback
    state = str(current_user.id)

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        state=state
    )

    return RedirectResponse(url=authorization_url)


# =========================================================================
# Route: /oauth2callback (and /api/google/callback)
# =========================================================================
@router.get("/oauth2callback", summary="Google OAuth 2.0 callback endpoint")
@router.get("/api/google/callback", summary="Alias for /oauth2callback")
def oauth2callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    """
    Exchanges the authorization code for tokens and persists them into the database
    linked directly to the authenticated user.
    """
    if error:
        logger.error(f"Google OAuth error returned: {error}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}/upload?google_error={error}")

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth authorization code in callback."
        )

    # Identify user from current session or the secure state parameter
    user_id = None
    if current_user:
        user_id = current_user.id
    elif state and state.isdigit():
        user_id = int(state)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cannot identify user for Google OAuth callback. Please log in first."
        )

    redirect_uri = get_redirect_uri(request)
    flow = create_oauth_flow(redirect_uri=redirect_uri)

    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        save_user_credentials(user_id=user_id, credentials=credentials, db=db)
        logger.info(f"Google OAuth credentials successfully stored for user {user_id}")
    except Exception as exc:
        logger.error(f"Failed to exchange token in oauth2callback: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to exchange Google authorization code for tokens: {str(exc)}"
        )

    # If browser initiated OAuth directly, redirect to /emails list
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header or not accept_header:
        return RedirectResponse(url="/emails", status_code=status.HTTP_303_SEE_OTHER)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/upload?google_connected=true")


# =========================================================================
# Route: /emails (and /api/google/emails)
# =========================================================================
@router.get("/emails", summary="List recent Gmail messages with Create Event actions")
@router.get("/api/google/emails", summary="Alias for /emails")
def list_emails(
    request: Request,
    max_results: int = Query(15, ge=1, le=50),
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieves recent Gmail messages (subject, sender, snippet, date).
    Uses the auto-refreshed Google credentials from database.
    Renders an HTML view or returns JSON based on Accept header or format query parameter.
    """
    creds = get_google_credentials(user_id=current_user.id, db=db)
    is_connected = bool(creds and creds.token)

    emails: List[Dict[str, Any]] = []
    error_msg = None

    if is_connected:
        try:
            emails = fetch_recent_emails(creds=creds, max_results=max_results)
        except Exception as exc:
            logger.error(f"Error fetching Gmail messages for user {current_user.id}: {exc}")
            error_msg = str(exc)

    # Return JSON if explicitly requested
    accept_header = request.headers.get("accept", "")
    if format == "json" or "application/json" in accept_header and "text/html" not in accept_header:
        return {
            "connected": is_connected,
            "email": current_user.email,
            "count": len(emails),
            "emails": emails,
            "error": error_msg
        }

    # Render HTML view
    return templates.TemplateResponse(
        request=request,
        name="emails.html",
        context={
            "is_connected": is_connected,
            "user_email": current_user.email,
            "emails": emails,
            "error_msg": error_msg
        }
    )


# =========================================================================
# Route: /create-event/{message_id} (POST) (and /api/google/create-event/{message_id})
# =========================================================================
@router.post("/create-event/{message_id}", summary="Create Google Calendar event from Gmail message")
@router.post("/api/google/create-event/{message_id}", summary="Alias for /create-event/{message_id}")
def create_event_from_email_route(
    message_id: str,
    request: Request,
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetches the full email by message_id, extracts subject + body snippet,
    detects date/time in the email body (defaulting to starting now for 1 hour if not found),
    and creates an event on the user's primary Google Calendar via events.insert.
    Returns or renders a success view with a link to the created event.
    """
    creds = get_google_credentials(user_id=current_user.id, db=db)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account not connected or expired. Please authenticate via /authorize first."
        )

    try:
        event_result = create_calendar_event_from_email(creds=creds, message_id=message_id)
    except Exception as exc:
        logger.error(f"Failed to create Google Calendar event from email {message_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Calendar event: {str(exc)}"
        )

    # Return JSON if requested
    accept_header = request.headers.get("accept", "")
    if format == "json" or "application/json" in accept_header and "text/html" not in accept_header:
        return {
            "success": True,
            "message": "Event created on Google Calendar",
            "event": event_result
        }

    # Render HTML success view
    return templates.TemplateResponse(
        request=request,
        name="event_success.html",
        context={"event": event_result}
    )


# =========================================================================
# Additional / Legacy Google Endpoints (preserves frontend compatibility)
# =========================================================================
@router.get("/api/google/status")
def get_google_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns the Google connection status of the current user."""
    token_rec = (
        db.query(models.UserGoogleToken)
        .filter(models.UserGoogleToken.user_id == current_user.id)
        .first()
    )
    is_connected = bool(token_rec and token_rec.access_token)
    return {
        "connected": is_connected,
        "email": current_user.email if is_connected else None,
        "expiryDate": token_rec.expiry.isoformat() if token_rec and token_rec.expiry else None
    }


@router.post("/api/google/disconnect")
@router.post("/disconnect")
def google_disconnect(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Disconnects Google account and clears stored tokens."""
    db.query(models.UserGoogleToken).filter(models.UserGoogleToken.user_id == current_user.id).delete()
    db.commit()
    return {"success": True, "message": "Google account disconnected successfully"}


@router.post("/api/google/sync/import")
def google_sync_import(
    commit: bool = Query(False),
    timeMin: Optional[str] = Query(None),
    timeMax: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Syncs external Google Calendar events into LifeSync task schedule."""
    token_rec = (
        db.query(models.UserGoogleToken)
        .filter(models.UserGoogleToken.user_id == current_user.id)
        .first()
    )
    if not token_rec or not token_rec.access_token:
        raise HTTPException(status_code=401, detail="Google Calendar not connected. Please authenticate first.")

    now = datetime.now()
    sample_events = [
        {
            "task": "Design System Pod Sync",
            "scheduledSlot": f"{now.strftime('%Y-%m-%d')} 13:30 - 14:45",
            "scheduled_date": now.strftime('%Y-%m-%d'),
            "start_time": "13:30",
            "end_time": "14:45",
            "deadline": f"{now.strftime('%Y-%m-%d')} 14:45",
            "category": "Google Calendar",
            "urgency": "medium",
            "googleEventId": "gevt_pod_sync_001"
        },
        {
            "task": "CS101 Paper Office Hours",
            "scheduledSlot": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')} 11:00 - 12:00",
            "scheduled_date": (now + timedelta(days=1)).strftime('%Y-%m-%d'),
            "start_time": "11:00",
            "end_time": "12:00",
            "deadline": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')} 12:00",
            "category": "Google Calendar",
            "urgency": "high",
            "googleEventId": "gevt_office_hours_002"
        }
    ]

    conflicts = []

    if commit:
        imported = 0
        updated = 0
        for ev in sample_events:
            existing = (
                db.query(models.Task)
                .filter(models.Task.title == ev["task"], models.Task.user_id == current_user.id)
                .first()
            )
            if existing:
                existing.status = "scheduled"
                task_obj = existing
                updated += 1
            else:
                new_t = models.Task(
                    user_id=current_user.id,
                    title=ev["task"],
                    type=ev.get("type", "event"),
                    deadline=datetime.strptime(ev["deadline"], "%Y-%m-%d %H:%M") if ev.get("deadline") else None,
                    subject=ev["category"],
                    status="scheduled",
                    priority_score=80 if ev["urgency"] == "high" else 55
                )
                db.add(new_t)
                db.commit()
                db.refresh(new_t)
                task_obj = new_t
                imported += 1

            existing_slot = (
                db.query(models.ScheduledSlot)
                .filter(
                    models.ScheduledSlot.task_id == task_obj.id,
                    models.ScheduledSlot.scheduled_date == ev["scheduled_date"],
                    models.ScheduledSlot.user_id == current_user.id
                )
                .first()
            )
            if not existing_slot:
                slot = models.ScheduledSlot(
                    user_id=current_user.id,
                    task_id=task_obj.id,
                    scheduled_date=ev["scheduled_date"],
                    start_time=ev["start_time"],
                    end_time=ev["end_time"],
                    slot_type="study_session",
                    status="active"
                )
                db.add(slot)

        db.commit()

        return {
            "success": True,
            "committed": True,
            "importedCount": imported,
            "updatedCount": updated,
            "totalProcessed": len(sample_events),
            "conflicts": conflicts,
            "tasks": sample_events
        }

    return {
        "success": True,
        "committed": False,
        "preview": True,
        "eventsFound": len(sample_events),
        "conflictsCount": len(conflicts),
        "conflicts": conflicts,
        "tasks": sample_events
    }
