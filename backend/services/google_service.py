import os
import json
import base64
import re
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from dateutil import parser as dateutil_parser
from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)

# Required Google API Scopes as specified
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events"
]

# Base directory for resolving client_secret.json
BACKEND_DIR = Path(__file__).resolve().parent.parent


def get_client_secret_path() -> Optional[str]:
    """
    Locates the Google OAuth 2.0 client_secret.json file.
    Checks:
    1. GOOGLE_CLIENT_SECRET_FILE environment variable
    2. backend/client_secret.json
    3. client_secret.json in current working directory
    """
    env_path = os.getenv("GOOGLE_CLIENT_SECRET_FILE")
    if env_path and os.path.exists(env_path):
        return env_path

    default_backend_path = BACKEND_DIR / "client_secret.json"
    if default_backend_path.exists():
        return str(default_backend_path)

    cwd_path = Path.cwd() / "client_secret.json"
    if cwd_path.exists():
        return str(cwd_path)

    return None


def get_client_config_fallback() -> Optional[Dict[str, Any]]:
    """
    Fallback to construct client configuration from environment variables
    if client_secret.json is not physically placed on disk.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if client_id and client_secret:
        return {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        }
    return None


def create_oauth_flow(redirect_uri: str) -> Flow:
    """
    Constructs a google-auth-oauthlib Flow instance from client_secret.json
    or environment configuration.
    """
    secret_path = get_client_secret_path()
    if secret_path:
        flow = Flow.from_client_secrets_file(
            secret_path,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        return flow

    client_config = get_client_config_fallback()
    if client_config:
        client_config["web"]["redirect_uris"] = [redirect_uri]
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        return flow

    raise FileNotFoundError(
        "Google OAuth credentials not found!\n"
        "Please place your 'client_secret.json' file (downloaded from Google Cloud Console) "
        f"into '{BACKEND_DIR / 'client_secret.json'}', or set GOOGLE_CLIENT_SECRET_FILE in your .env.\n"
        "Also ensure your Authorized redirect URI in Google Cloud Console matches: "
        f"{redirect_uri}"
    )


def save_user_credentials(user_id: int, credentials: Credentials, db: Session) -> models.UserGoogleToken:
    """
    Persists OAuth credentials to the user_google_tokens database table,
    storing access_token, refresh_token, token_uri, client_id, client_secret, scopes, expiry.
    """
    token_rec = (
        db.query(models.UserGoogleToken)
        .filter(models.UserGoogleToken.user_id == user_id)
        .first()
    )

    expiry_dt = credentials.expiry
    if expiry_dt and expiry_dt.tzinfo is not None:
        expiry_dt = expiry_dt.astimezone(timezone.utc).replace(tzinfo=None)

    scopes_str = " ".join(credentials.scopes) if credentials.scopes else " ".join(SCOPES)

    token_meta = {
        "token": credentials.token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "scopes": credentials.scopes,
        "expiry": expiry_dt.isoformat() if expiry_dt else None
    }

    if not token_rec:
        token_rec = models.UserGoogleToken(
            user_id=user_id,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri or "https://oauth2.googleapis.com/token",
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            scopes=scopes_str,
            expiry=expiry_dt,
            tokens_json=json.dumps(token_meta),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(token_rec)
    else:
        token_rec.access_token = credentials.token
        # Google doesn't always send a refresh token on re-authorization unless prompt='consent'
        # Preserve existing refresh token if new one is omitted
        if credentials.refresh_token:
            token_rec.refresh_token = credentials.refresh_token
        if credentials.token_uri:
            token_rec.token_uri = credentials.token_uri
        if credentials.client_id:
            token_rec.client_id = credentials.client_id
        if credentials.client_secret:
            token_rec.client_secret = credentials.client_secret
        token_rec.scopes = scopes_str
        token_rec.expiry = expiry_dt
        token_rec.tokens_json = json.dumps(token_meta)
        token_rec.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(token_rec)
    return token_rec


def get_google_credentials(user_id: int, db: Session) -> Optional[Credentials]:
    """
    Reconstructs a google.oauth2.credentials.Credentials object from the database record.
    Automatically detects token expiration and refreshes + re-saves the token to the database.
    """
    token_rec = (
        db.query(models.UserGoogleToken)
        .filter(models.UserGoogleToken.user_id == user_id)
        .first()
    )
    if not token_rec or not token_rec.access_token:
        return None

    scopes = token_rec.scopes.split() if token_rec.scopes else SCOPES

    # Pull client_id / client_secret from token_rec or client_secret.json fallback
    client_id = token_rec.client_id or os.getenv("GOOGLE_CLIENT_ID")
    client_secret = token_rec.client_secret or os.getenv("GOOGLE_CLIENT_SECRET")
    token_uri = token_rec.token_uri or "https://oauth2.googleapis.com/token"

    if not client_id or not client_secret:
        secret_path = get_client_secret_path()
        if secret_path:
            try:
                with open(secret_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    client_info = data.get("web") or data.get("installed") or {}
                    client_id = client_id or client_info.get("client_id")
                    client_secret = client_secret or client_info.get("client_secret")
                    token_uri = token_uri or client_info.get("token_uri")
            except Exception as e:
                logger.warning(f"Could not read client_secret.json for client details: {e}")

    creds = Credentials(
        token=token_rec.access_token,
        refresh_token=token_rec.refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
        expiry=token_rec.expiry
    )

    # Auto-refresh if expired and refresh_token exists
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Persist newly refreshed token
            token_rec.access_token = creds.token
            token_rec.expiry = creds.expiry
            token_rec.updated_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"Successfully refreshed and saved Google credentials for user_id {user_id}")
        except Exception as refresh_err:
            logger.error(f"Failed to refresh Google credentials for user {user_id}: {refresh_err}")
            return None

    return creds


def fetch_recent_emails(creds: Credentials, max_results: int = 15) -> List[Dict[str, Any]]:
    """
    Fetches recent Gmail messages with subject, sender, date, and snippet.
    """
    service = build("gmail", "v1", credentials=creds)
    results = service.users().messages().list(userId="me", maxResults=max_results).execute()
    messages = results.get("messages", [])

    emails = []
    for m in messages:
        msg_id = m["id"]
        try:
            msg = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()

            headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
            emails.append({
                "id": msg_id,
                "thread_id": msg.get("threadId", ""),
                "subject": headers.get("Subject", "(No Subject)"),
                "sender": headers.get("From", "(Unknown Sender)"),
                "date": headers.get("Date", ""),
                "snippet": msg.get("snippet", "")
            })
        except Exception as err:
            logger.warning(f"Error fetching email metadata for {msg_id}: {err}")
            continue

    return emails


def extract_email_body_text(payload: Dict[str, Any]) -> str:
    """
    Recursively extracts plain text body from a Gmail message payload.
    """
    body_text = ""
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain" and "data" in payload.get("body", {}):
        try:
            return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
        except Exception:
            return ""

    parts = payload.get("parts", [])
    for part in parts:
        part_type = part.get("mimeType", "")
        if part_type == "text/plain" and "data" in part.get("body", {}):
            try:
                body_text += base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace") + "\n"
            except Exception:
                pass
        elif "parts" in part:
            body_text += extract_email_body_text(part) + "\n"

    if not body_text and "data" in payload.get("body", {}):
        try:
            raw = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
            # Clean basic HTML tags if text/html was the only body
            clean = re.sub(r"<[^>]+>", " ", raw)
            return re.sub(r"\s+", " ", clean).strip()
        except Exception:
            pass

    return body_text.strip()


def detect_datetime_in_text(text: str) -> Optional[datetime]:
    """
    Attempts to detect a date and time in the provided email text.
    Uses regex scanning for common date/time patterns and python-dateutil fuzzy parsing.
    Returns detected datetime or None.
    """
    if not text:
        return None

    # Patterns matching typical meeting/event phrases:
    # "September 15 at 3:00 PM", "Sept 15, 2026 14:00", "2026-09-15 10:30", "15/09/2026 3pm"
    candidate_regexes = [
        r"(?:on\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)?",
        r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm|AM|PM))?)?",
        r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)?",
        r"\b(?:tomorrow|today|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\b",
    ]

    for pattern in candidate_regexes:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate_str = match.group(0).strip()
            try:
                # Handle relative words like 'tomorrow'
                lower_cand = candidate_str.lower()
                base_dt = datetime.now(timezone.utc)
                if "tomorrow" in lower_cand:
                    base_dt = base_dt + timedelta(days=1)
                parsed = dateutil_parser.parse(candidate_str, fuzzy=True, default=base_dt)
                return parsed
            except Exception:
                continue

    # Secondary approach: inspect lines individually with fuzzy parse
    lines = [line.strip() for line in text.splitlines() if len(line.strip()) > 5]
    for line in lines[:25]:  # search top 25 non-empty lines
        # Check if line contains time indicators like 'pm', 'am', ':', '2026', 'at '
        if re.search(r"\b(?:\d{1,2}:\d{2}|am|pm|202[0-9]|at\s+\d)\b", line, re.IGNORECASE):
            try:
                parsed = dateutil_parser.parse(line, fuzzy=True, default=datetime.now(timezone.utc))
                # Validate that the parsed year is reasonable
                if 2020 <= parsed.year <= 2035:
                    return parsed
            except Exception:
                continue

    return None


def create_calendar_event_from_email(creds: Credentials, message_id: str) -> Dict[str, Any]:
    """
    Fetches the full email by message_id, extracts subject and body snippet,
    detects date/time (defaulting to starting now for 1 hour if not found),
    and creates an event on the user's primary Google Calendar via events.insert.
    """
    gmail_service = build("gmail", "v1", credentials=creds)
    calendar_service = build("calendar", "v3", credentials=creds)

    # 1. Fetch full email content
    msg = gmail_service.users().messages().get(userId="me", id=message_id, format="full").execute()
    payload = msg.get("payload", {})
    headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

    subject = headers.get("Subject", "LifeSync Event from Email")
    sender = headers.get("From", "")
    snippet = msg.get("snippet", "")
    body_text = extract_email_body_text(payload)

    combined_text = f"{subject}\n\n{snippet}\n\n{body_text}"

    # 2. Date / Time Detection
    detected_dt = detect_datetime_in_text(combined_text)
    if detected_dt:
        start_dt = detected_dt
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
    else:
        # Default starting now for 1 hour duration
        start_dt = datetime.now(timezone.utc)

    end_dt = start_dt + timedelta(hours=1)

    # 3. Assemble Calendar Event
    body_preview = body_text[:600] + ("..." if len(body_text) > 600 else "")
    description = (
        f"Created by LifeSync from Email\n\n"
        f"From: {sender}\n"
        f"Snippet: {snippet}\n\n"
        f"Content Preview:\n{body_preview}"
    )

    event_payload = {
        "summary": subject,
        "description": description,
        "start": {
            "dateTime": start_dt.isoformat(),
        },
        "end": {
            "dateTime": end_dt.isoformat(),
        },
        "reminders": {
            "useDefault": True
        }
    }

    # 4. Insert via Google Calendar API
    created_event = calendar_service.events().insert(calendarId="primary", body=event_payload).execute()

    return {
        "event_id": created_event.get("id"),
        "summary": created_event.get("summary", subject),
        "html_link": created_event.get("htmlLink", ""),
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "has_detected_date": bool(detected_dt),
        "message_id": message_id
    }


def bulk_sync_to_google_calendar(
    creds: Credentials,
    events: List[Any],
    tasks: List[Any]
) -> Dict[str, Any]:
    """
    Exports newly committed events and tasks with deadlines directly to the user's primary Google Calendar.
    """
    calendar_service = build("calendar", "v3", credentials=creds)
    synced_count = 0
    errors = []
    created_links = []

    # 1. Sync Calendar Events (Exams, Classes, Holidays)
    for ev in events:
        start_dt = getattr(ev, "start_datetime", None)
        if not start_dt:
            continue
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)

        end_dt = getattr(ev, "end_datetime", None) or (start_dt + timedelta(hours=1))
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)

        title = getattr(ev, "title", "Academic Event")
        ev_type = getattr(ev, "type", "event")
        location = getattr(ev, "location", "") or "Campus"
        subject = getattr(ev, "subject", "") or ""
        description = getattr(ev, "description", "") or ""

        # If it's an all-day holiday
        is_all_day = (ev_type == "holiday" and start_dt.hour == 0 and end_dt.hour == 23)
        if is_all_day:
            event_body = {
                "summary": title,
                "description": f"{description}\nLocation: {location}\nCategory: {subject or 'Academic Holiday'}",
                "location": location,
                "start": {"date": start_dt.strftime("%Y-%m-%d")},
                "end": {"date": (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")},
            }
        else:
            event_body = {
                "summary": title,
                "description": f"{description}\nLocation: {location}\nSubject: {subject}",
                "location": location,
                "start": {"dateTime": start_dt.isoformat()},
                "end": {"dateTime": end_dt.isoformat()},
            }

        try:
            res = calendar_service.events().insert(calendarId="primary", body=event_body).execute()
            synced_count += 1
            if res.get("htmlLink"):
                created_links.append(res.get("htmlLink"))
        except Exception as e:
            logger.warning(f"Error syncing event '{title}' to Google Calendar: {e}")
            errors.append(str(e))

    # 2. Sync Tasks with Deadlines
    for t in tasks:
        deadline_dt = getattr(t, "deadline", None)
        if not deadline_dt:
            continue
        if deadline_dt.tzinfo is None:
            deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)

        title = getattr(t, "title", "Coursework Item")
        subject = getattr(t, "subject", "") or "Academic"
        weightage = getattr(t, "weightage", "") or "N/A"
        description = getattr(t, "description", "") or ""
        priority = getattr(t, "priority_score", 50)

        event_body = {
            "summary": f"Deadline: {title}",
            "description": f"{description}\nSubject: {subject}\nWeightage: {weightage}\nPriority Score: {priority}",
            "start": {"dateTime": (deadline_dt - timedelta(hours=1)).isoformat()},
            "end": {"dateTime": deadline_dt.isoformat()},
        }

        try:
            res = calendar_service.events().insert(calendarId="primary", body=event_body).execute()
            synced_count += 1
            if res.get("htmlLink"):
                created_links.append(res.get("htmlLink"))
        except Exception as e:
            logger.warning(f"Error syncing task deadline '{title}' to Google Calendar: {e}")
            errors.append(str(e))

    return {
        "success": True,
        "synced_count": synced_count,
        "errors_count": len(errors),
        "sample_links": created_links[:3]
    }
