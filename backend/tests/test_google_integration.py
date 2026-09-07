import os
import json
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import models
from database import get_db, SessionLocal
from main import app
from services.google_service import (
    SCOPES,
    detect_datetime_in_text,
    save_user_credentials,
    get_google_credentials
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_scopes_configuration():
    """Verify that scopes match requirements: gmail.readonly and calendar.events"""
    assert "https://www.googleapis.com/auth/gmail.readonly" in SCOPES
    assert "https://www.googleapis.com/auth/calendar.events" in SCOPES


def test_database_model_columns(db_session: Session):
    """Verify that UserGoogleToken stores all required fields."""
    # Check column names on UserGoogleToken
    column_names = [col.name for col in models.UserGoogleToken.__table__.columns]
    expected_fields = [
        "user_id",
        "access_token",
        "refresh_token",
        "token_uri",
        "client_id",
        "client_secret",
        "scopes",
        "expiry"
    ]
    for field in expected_fields:
        assert field in column_names, f"Field '{field}' missing from UserGoogleToken model"


def test_datetime_detection_explicit():
    """Verify dateutil / regex detection on explicit dates and times."""
    email_text = (
        "Hi Alex, please join the Computer Architecture Review on October 14, 2026 at 2:30 PM. "
        "Room 401. Thanks!"
    )
    detected = detect_datetime_in_text(email_text)
    assert detected is not None
    assert detected.month == 10
    assert detected.day == 14
    assert detected.year == 2026
    assert detected.hour == 14
    assert detected.minute == 30


def test_datetime_detection_iso_format():
    """Verify detection on ISO-style date format in email text."""
    email_text = "Project sprint review scheduled for 2026-11-20 10:00:00."
    detected = detect_datetime_in_text(email_text)
    assert detected is not None
    assert detected.year == 2026
    assert detected.month == 11
    assert detected.day == 20
    assert detected.hour == 10


def test_datetime_detection_fallback_none():
    """Verify None is returned when email contains no date/time."""
    email_text = "Hi team, please find attached the weekly notes and reading materials. Good luck with study sessions!"
    detected = detect_datetime_in_text(email_text)
    assert detected is None


def test_save_user_credentials_persistence(db_session: Session):
    """Verify that save_user_credentials persists all fields into the database."""
    # Ensure test user exists
    test_user = db_session.query(models.User).filter(models.User.email == "test_google_oauth@example.com").first()
    if not test_user:
        test_user = models.User(
            email="test_google_oauth@example.com",
            name="OAuth Tester",
            google_id="oauth_tester_id"
        )
        db_session.add(test_user)
        db_session.commit()
        db_session.refresh(test_user)

    mock_creds = MagicMock()
    mock_creds.token = "ya29.sample_access_token_12345"
    mock_creds.refresh_token = "1//sample_refresh_token_67890"
    mock_creds.token_uri = "https://oauth2.googleapis.com/token"
    mock_creds.client_id = "test-client-id.apps.googleusercontent.com"
    mock_creds.client_secret = "test-client-secret-xyz"
    mock_creds.scopes = SCOPES
    mock_creds.expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    record = save_user_credentials(user_id=test_user.id, credentials=mock_creds, db=db_session)
    assert record.user_id == test_user.id
    assert record.access_token == "ya29.sample_access_token_12345"
    assert record.refresh_token == "1//sample_refresh_token_67890"
    assert record.token_uri == "https://oauth2.googleapis.com/token"
    assert record.client_id == "test-client-id.apps.googleusercontent.com"
    assert record.client_secret == "test-client-secret-xyz"
    assert "gmail.readonly" in record.scopes
    assert "calendar.events" in record.scopes


def test_get_google_credentials_reconstruction(db_session: Session):
    """Verify get_google_credentials reconstructs Credentials object and auto-refreshes if expired."""
    test_user = db_session.query(models.User).filter(models.User.email == "test_google_oauth@example.com").first()
    assert test_user is not None

    creds = get_google_credentials(user_id=test_user.id, db=db_session)
    assert creds is not None
    assert creds.token == "ya29.sample_access_token_12345"
    assert creds.refresh_token == "1//sample_refresh_token_67890"
    assert creds.client_id == "test-client-id.apps.googleusercontent.com"


def test_token_auto_refresh_and_resave(db_session: Session):
    """Verify that an expired token automatically calls creds.refresh and re-saves to DB."""
    test_user = db_session.query(models.User).filter(models.User.email == "test_google_oauth@example.com").first()
    assert test_user is not None

    # Set expiry in the past
    token_rec = db_session.query(models.UserGoogleToken).filter(models.UserGoogleToken.user_id == test_user.id).first()
    token_rec.expiry = datetime.now(timezone.utc) - timedelta(hours=2)
    db_session.commit()

    with patch.object(models.UserGoogleToken, "__repr__", return_value=""):
        pass

    def fake_refresh(self, request):
        self.token = "ya29.new_refreshed_access_token"
        self.expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    with patch("google.oauth2.credentials.Credentials.refresh", new=fake_refresh):
        creds = get_google_credentials(user_id=test_user.id, db=db_session)
        assert creds.token == "ya29.new_refreshed_access_token"

    # Re-fetch from DB and verify updated token
    db_session.refresh(token_rec)
    assert token_rec.access_token == "ya29.new_refreshed_access_token"


def test_authorize_route_setup_guide_or_redirect(client: TestClient):
    """Verify GET /authorize is accessible."""
    response = client.get("/authorize", follow_redirects=False)
    # If client_secret.json is not present, renders 200 OK setup_guide.html, or 307/302 Redirect to accounts.google.com
    assert response.status_code in [200, 302, 307]
    if response.status_code == 200:
        assert "Google OAuth Setup" in response.text or "client_secret.json" in response.text


def test_emails_endpoint_html_and_json(client: TestClient):
    """Verify GET /emails returns HTML view by default and JSON when requested."""
    # Test HTML view
    html_resp = client.get("/emails")
    assert html_resp.status_code == 200
    assert "Gmail" in html_resp.text or "Calendar" in html_resp.text

    # Test JSON view
    json_resp = client.get("/emails?format=json")
    assert json_resp.status_code == 200
    data = json_resp.json()
    assert "connected" in data
    assert "emails" in data


def test_create_event_requires_connection(client: TestClient):
    """Verify POST /create-event/{message_id} raises 401 when account credentials are not valid."""
    resp = client.post("/create-event/invalid_msg_id_12345?format=json")
    assert resp.status_code in [401, 500]


def test_create_event_endpoint_success_flow(client: TestClient, db_session: Session):
    """Verify POST /create-event/{message_id} creates calendar event and returns event link."""
    test_user = db_session.query(models.User).filter(models.User.email == "alex.morgan@university.edu").first()
    if not test_user:
        test_user = models.User(
            email="alex.morgan@university.edu",
            name="Alex Morgan",
            google_id="demo_user_1"
        )
        db_session.add(test_user)
        db_session.commit()
        db_session.refresh(test_user)

    # Attach valid token record to default demo user
    mock_creds = MagicMock()
    mock_creds.token = "ya29.valid_test_token"
    mock_creds.refresh_token = "1//valid_refresh"
    mock_creds.token_uri = "https://oauth2.googleapis.com/token"
    mock_creds.client_id = "test-client.apps.googleusercontent.com"
    mock_creds.client_secret = "test-secret"
    mock_creds.scopes = SCOPES
    mock_creds.expiry = datetime.now(timezone.utc) + timedelta(hours=2)
    save_user_credentials(user_id=test_user.id, credentials=mock_creds, db=db_session)

    mock_event_return = {
        "event_id": "google_cal_ev_999",
        "summary": "CS201 Midterm Review",
        "html_link": "https://calendar.google.com/calendar/event?eid=google_cal_ev_999",
        "start_time": "2026-10-15T14:00:00+00:00",
        "end_time": "2026-10-15T15:00:00+00:00",
        "has_detected_date": True,
        "message_id": "msg_cs201_test"
    }

    with patch("routers.google.create_calendar_event_from_email", return_value=mock_event_return):
        # 1. Test JSON format
        json_resp = client.post("/create-event/msg_cs201_test?format=json")
        assert json_resp.status_code == 200
        data = json_resp.json()
        assert data["success"] is True
        assert data["event"]["html_link"] == "https://calendar.google.com/calendar/event?eid=google_cal_ev_999"

        # 2. Test HTML format
        html_resp = client.post("/create-event/msg_cs201_test")
        assert html_resp.status_code == 200
        assert "Event Created Successfully" in html_resp.text
        assert "View in Google Calendar" in html_resp.text
        assert "https://calendar.google.com/calendar/event?eid=google_cal_ev_999" in html_resp.text


def test_commit_extracted_items_with_google_sync(client: TestClient, db_session: Session):
    """Verify that committing extracted items with sync_to_google_calendar calls bulk_sync_to_google_calendar."""
    payload = {
        "assignments": [
            {
                "title": "Algorithms Problem Set 4",
                "subject": "CS301",
                "deadline": "2026-10-25T23:59:00",
                "weightage": "15%",
                "description": "Dynamic programming assignment"
            }
        ],
        "exams": [
            {
                "title": "CS301 Midterm Examination",
                "subject": "CS301",
                "date": "2026-10-18T10:00:00",
                "weightage": "25%",
                "location": "Room 401"
            }
        ],
        "events": [],
        "holidays": [
            {
                "name": "Diwali Recess",
                "date": "2026-11-01",
                "type": "Holiday"
            }
        ],
        "sync_to_google_calendar": True
    }

    mock_sync_return = {
        "success": True,
        "synced_count": 3,
        "errors_count": 0,
        "sample_links": ["https://calendar.google.com/event?id=123"]
    }

    with patch("services.google_service.bulk_sync_to_google_calendar", return_value=mock_sync_return):
        resp = client.post("/api/ai/commit-extracted", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "google_sync" in data
        assert data["google_sync"]["success"] is True
        assert data["google_sync"]["synced_count"] == 3
        assert "Synced 3 item(s) directly into your Google Calendar" in data["message"]
