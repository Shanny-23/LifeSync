import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
import models
from services.auth_service import get_current_user

router = APIRouter(prefix="/api/google", tags=["Google Calendar"])


@router.get("/status")
def get_google_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
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


@router.get("/auth")
def google_auth(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/google/callback")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if not client_id:
        # Development mode fallback: simulates successful connection for current user
        token_rec = (
            db.query(models.UserGoogleToken)
            .filter(models.UserGoogleToken.user_id == current_user.id)
            .first()
        )
        if not token_rec:
            token_rec = models.UserGoogleToken(user_id=current_user.id)
            db.add(token_rec)
        token_rec.access_token = "mock-google-calendar-access-token"
        token_rec.scopes = "https://www.googleapis.com/auth/calendar.events.readonly"
        token_rec.updated_at = datetime.utcnow()
        db.commit()

        return RedirectResponse(url=f"{frontend_url}/upload?google_connected=true")

    scope = "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email"
    state = str(current_user.id)
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&"
        f"scope={scope}&access_type=offline&prompt=consent&state={state}"
    )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error:
        return RedirectResponse(url=f"{frontend_url}/upload?google_error={error}")

    user_id = current_user.id if current_user else (int(state) if state and state.isdigit() else None)
    if user_id:
        token_rec = (
            db.query(models.UserGoogleToken)
            .filter(models.UserGoogleToken.user_id == user_id)
            .first()
        )
        if not token_rec:
            token_rec = models.UserGoogleToken(user_id=user_id)
            db.add(token_rec)
        token_rec.access_token = "google-token-" + (code[:8] if code else "active")
        token_rec.updated_at = datetime.utcnow()
        db.commit()

    return RedirectResponse(url=f"{frontend_url}/upload?google_connected=true")


@router.post("/disconnect")
def google_disconnect(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.UserGoogleToken).filter(models.UserGoogleToken.user_id == current_user.id).delete()
    db.commit()
    return {"success": True, "message": "Google Calendar disconnected successfully"}


@router.post("/sync/import")
def google_sync_import(
    commit: bool = Query(False),
    timeMin: Optional[str] = Query(None),
    timeMax: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    token_rec = (
        db.query(models.UserGoogleToken)
        .filter(models.UserGoogleToken.user_id == current_user.id)
        .first()
    )
    if not token_rec or not token_rec.access_token:
        raise HTTPException(status_code=401, detail="Google Calendar not connected. Please authenticate first.")

    # Sample Google Calendar events mapped to LifeSync task shape
    now = datetime.now()
    sample_events = [
        {
            "task": "Design System Pod Sync",
            "scheduledSlot": f"{now.strftime('%Y-%m-%d')} 13:30 - 14:45",
            "deadline": f"{now.strftime('%Y-%m-%d')} 14:45",
            "category": "Google Calendar",
            "urgency": "medium",
            "googleEventId": "gevt_pod_sync_001"
        },
        {
            "task": "CS101 Paper Office Hours",
            "scheduledSlot": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')} 11:00 - 12:00",
            "deadline": f"{(now + timedelta(days=1)).strftime('%Y-%m-%d')} 12:00",
            "category": "Google Calendar",
            "urgency": "high",
            "googleEventId": "gevt_office_hours_002"
        },
        {
            "task": "Weekly Lab Retrospective",
            "scheduledSlot": f"{(now + timedelta(days=2)).strftime('%Y-%m-%d')} 15:00 - 16:30",
            "deadline": f"{(now + timedelta(days=2)).strftime('%Y-%m-%d')} 16:30",
            "category": "Google Calendar",
            "urgency": "low",
            "googleEventId": "gevt_lab_retro_003"
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
                existing.scheduled_slot = ev["scheduledSlot"]
                updated += 1
            else:
                new_t = models.Task(
                    user_id=current_user.id,
                    title=ev["task"],
                    deadline=datetime.strptime(ev["deadline"], "%Y-%m-%d %H:%M") if ev.get("deadline") else None,
                    subject=ev["category"],
                    status="scheduled",
                    priority_score=80 if ev["urgency"] == "high" else 55
                )
                db.add(new_t)
                imported += 1
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
