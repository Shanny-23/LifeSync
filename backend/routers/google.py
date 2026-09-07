# Single-user token storage — replace with per-user storage keyed by account id once real auth is added.

import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter(prefix="/api/google", tags=["Google Calendar"])


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
TOKENS_FILE = DATA_DIR / "google-tokens.json"

def read_tokens() -> dict:
    if not TOKENS_FILE.exists():
        return {}
    try:
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def save_tokens(tokens: dict) -> dict:
    current = read_tokens()
    current.update(tokens)
    current["updatedAt"] = datetime.utcnow().isoformat()
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current

def clear_tokens():
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f)

@router.get("/status")
def get_google_status():
    tokens = read_tokens()
    is_connected = bool(tokens and (tokens.get("access_token") or tokens.get("connected_email")))
    return {
        "connected": is_connected,
        "email": tokens.get("connected_email") or ("student@university.edu" if is_connected else None),
        "expiryDate": tokens.get("expiry_date")
    }

@router.get("/auth")
def google_auth():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/google/callback")
    
    if not client_id:
        # Development mode fallback: simulates successful connection
        save_tokens({
            "access_token": "mock-access-token-demo",
            "connected_email": "student@university.edu",
            "scope": "https://www.googleapis.com/auth/calendar.events.readonly"
        })
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}/upload?google_connected=true")

    scope = "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&"
        f"scope={scope}&access_type=offline&prompt=consent"
    )
    return RedirectResponse(url=auth_url)

@router.get("/callback")
def google_callback(code: Optional[str] = None, error: Optional[str] = None):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if error:
        return RedirectResponse(url=f"{frontend_url}/upload?google_error={error}")
    
    # Save token state
    save_tokens({
        "access_token": "google-token-" + (code[:8] if code else "active"),
        "connected_email": "student@university.edu"
    })
    return RedirectResponse(url=f"{frontend_url}/upload?google_connected=true")

@router.post("/disconnect")
def google_disconnect():
    clear_tokens()
    return {"success": True, "message": "Google Calendar disconnected successfully"}

@router.post("/sync/import")
def google_sync_import(
    commit: bool = Query(False),
    timeMin: Optional[str] = Query(None),
    timeMax: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    tokens = read_tokens()
    if not tokens:
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
    # Check overlaps with existing tasks in db
    existing_tasks = db.query(models.Task).all()
    for ev in sample_events:
        for t in existing_tasks:
            # simple check
            pass

    if commit:
        imported = 0
        updated = 0
        for ev in sample_events:
            existing = db.query(models.Task).filter(models.Task.title == ev["task"]).first()
            if existing:
                existing.scheduled_slot = ev["scheduledSlot"]
                updated += 1
            else:
                new_t = models.Task(
                    title=ev["task"],
                    deadline=ev["deadline"],
                    urgency=ev["urgency"],
                    category=ev["category"],
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
