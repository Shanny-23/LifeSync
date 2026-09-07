"""
Pytest integration test suite for the automated LifeSync processing pipeline:
1. Uploads a sample timetable file via POST /api/upload
2. BackgroundTasks automatically chains: parse -> extract -> normalize -> done
3. Polls GET /api/upload/{upload_id}/status until 'done' or timeout
4. Calls POST /api/schedule/generate
5. Asserts GET /api/schedule returns non-empty data
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app
from database import SessionLocal, engine, Base, ensure_db_schema
import models

client = TestClient(app)

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "sample_timetable.pdf"


@pytest.fixture(autouse=True)
def clean_db():
    """Ensure a clean database state before each test run."""
    ensure_db_schema()
    db = SessionLocal()
    try:
        db.query(models.ConflictLog).delete()
        db.query(models.ScheduledSlot).delete()
        db.query(models.Task).delete()
        db.query(models.Event).delete()
        db.query(models.ExtractedData).delete()
        db.query(models.Upload).delete()
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture
def sample_timetable_pdf() -> Path:
    """Provides path to a valid sample timetable PDF fixture."""
    assert FIXTURE_PATH.exists(), f"Fixture file not found at {FIXTURE_PATH}"
    return FIXTURE_PATH


@pytest.fixture
def mock_claude():
    """
    Mocks Anthropic Claude API calls for predictable offline execution without consuming API tokens.
    Handles both timetable entity extraction and schedule generation dynamically.
    """
    def mock_messages_create(*args, **kwargs):
        system_prompt = kwargs.get("system", "")
        messages = kwargs.get("messages", [])
        prompt_text = str(messages)
        mock_resp = MagicMock()

        # Scheduler generation request
        if "academic scheduler" in system_prompt.lower() or "study planner" in system_prompt.lower():
            task_id_match = re.search(r'"task_id":\s*(\d+)', prompt_text)
            task_id = int(task_id_match.group(1)) if task_id_match else 1
            tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

            scheduled_plan = [
                {
                    "task_id": task_id,
                    "scheduled_date": tomorrow,
                    "scheduled_start_time": "13:00",
                    "scheduled_end_time": "14:30"
                }
            ]
            mock_resp.content = [MagicMock(text=json.dumps(scheduled_plan))]
            return mock_resp

        # Timetable extraction request
        extracted_classes = [
            {
                "day": "Monday",
                "start_time": "09:00",
                "end_time": "10:30",
                "subject": "CS101",
                "location": "Room 301"
            },
            {
                "day": "Wednesday",
                "start_time": "11:00",
                "end_time": "12:30",
                "subject": "CS202",
                "location": "Lab 2"
            },
            {
                "day": "Friday",
                "start_time": "14:00",
                "end_time": "15:30",
                "subject": "CS303",
                "location": "Room 405"
            }
        ]
        mock_resp.content = [MagicMock(text=json.dumps(extracted_classes))]
        return mock_resp

    with patch("anthropic.Anthropic") as MockAnthropic, \
         patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-ant-test-key-mock"}):
        instance = MockAnthropic.return_value
        instance.messages.create.side_effect = mock_messages_create
        yield MockAnthropic


def test_automated_pipeline_flow(sample_timetable_pdf, mock_claude):
    """
    End-to-end integration test:
    1. Seed a pending task that needs scheduling.
    2. Upload sample timetable PDF -> triggers parse -> extract -> normalize in background.
    3. Poll GET /api/upload/{upload_id}/status until 'done'.
    4. Call POST /api/schedule/generate to schedule the pending task into free slots outside classes.
    5. Assert GET /api/schedule returns non-empty active slots.
    """
    db = SessionLocal()

    # Step 0: Seed a pending academic task to be scheduled
    exam_deadline = datetime.now(timezone.utc) + timedelta(days=5)
    pending_task = models.Task(
        title="CS101 Binary Search Tree Assignment",
        type="assignment",
        deadline=exam_deadline,
        subject="CS101",
        weightage="20%",
        priority_score=85,
        status="pending",
        description="Implement AVL balancing and benchmark operations."
    )
    db.add(pending_task)
    db.commit()
    db.refresh(pending_task)
    task_id = pending_task.id
    db.close()

    # Step 1: Upload the sample timetable PDF
    with open(sample_timetable_pdf, "rb") as pdf_file:
        upload_resp = client.post(
            "/api/upload",
            data={"type": "timetable"},
            files={"file": ("sample_timetable.pdf", pdf_file, "application/pdf")}
        )

    assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"
    upload_data = upload_resp.json()
    upload_id = upload_data["id"]
    assert upload_id > 0
    assert upload_data["status"] == "pending"
    print(f"\n[1] Uploaded sample timetable PDF successfully. Upload ID: {upload_id}")

    # Step 2: Poll GET /api/upload/{upload_id}/status until 'done' or timeout
    max_retries = 20
    poll_interval = 0.1
    final_status_data = None

    for attempt in range(max_retries):
        status_resp = client.get(f"/api/upload/{upload_id}/status")
        assert status_resp.status_code == 200, f"Status check failed: {status_resp.text}"
        status_data = status_resp.json()
        current_status = status_data["status"]
        print(f"  Attempt {attempt + 1}: Upload #{upload_id} status='{current_status}'")

        if current_status == "done":
            final_status_data = status_data
            break
        elif current_status == "failed":
            pytest.fail(f"Background pipeline failed: {status_data.get('error_message')}")

        time.sleep(poll_interval)

    assert final_status_data is not None, f"Pipeline did not finish within timeout. Last status: {status_data}"
    assert final_status_data["status"] == "done"
    print("[2] Pipeline transitioned through all stages and reached status='done'.")

    # Verify database state after background processing
    db = SessionLocal()
    upload_rec = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
    assert upload_rec.status == "done"
    assert upload_rec.raw_text is not None and "Fall 2026 Academic Timetable" in upload_rec.raw_text

    extracted_entries = db.query(models.ExtractedData).filter(models.ExtractedData.upload_id == upload_id).all()
    assert len(extracted_entries) >= 1
    assert len(extracted_entries[0].data) == 3

    events_in_db = db.query(models.Event).all()
    assert len(events_in_db) == 3
    assert any(e.subject == "CS101" for e in events_in_db)
    assert any(e.subject == "CS202" for e in events_in_db)
    print("[3] Confirmed database contains normalized class events from timetable upload.")
    db.close()

    # Step 3: Trigger AI schedule generation (fits pending task into computed free slots)
    gen_resp = client.post("/api/schedule/generate?days_ahead=7")
    assert gen_resp.status_code == 200, f"Schedule generation failed: {gen_resp.text}"
    gen_data = gen_resp.json()
    print(f"[4] AI Schedule Generation result: {gen_data['message']}")
    assert gen_data["slots_created"] >= 1
    assert gen_data["tasks_scheduled"] >= 1

    # Step 4: Assert GET /api/schedule returns non-empty data
    sched_resp = client.get("/api/schedule")
    assert sched_resp.status_code == 200, f"GET /api/schedule failed: {sched_resp.text}"
    slots = sched_resp.json()
    print(f"[5] GET /api/schedule returned {len(slots)} slot(s):")
    for s in slots:
        print(f"  - Slot #{s['id']}: Task '{s['task_title']}' on {s['scheduled_date']} from {s['start_time']} to {s['end_time']}")

    assert len(slots) > 0, "Expected at least one scheduled slot in GET /api/schedule"
    first_slot = slots[0]
    assert first_slot["task_id"] == task_id
    assert first_slot["task_title"] == "CS101 Binary Search Tree Assignment"
    assert first_slot["task"] == "CS101 Binary Search Tree Assignment" # Frontend alias
    assert first_slot["subject"] == "CS101"
    assert first_slot["category"] == "CS101"                           # Frontend alias
    assert first_slot["scheduledSlot"] is not None                    # Frontend formatted string
    assert first_slot["status"] == "active"
    print("\n ALL PIPELINE INTEGRATION ASSERTIONS PASSED SUCCESSFULLY! ")


def test_upload_status_not_found():
    """Verify GET /api/upload/{upload_id}/status returns 404 for non-existent upload."""
    resp = client.get("/api/upload/999999/status")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
