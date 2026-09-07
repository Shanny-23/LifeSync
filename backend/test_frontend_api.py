"""
Integration test suite for LifeSync Frontend REST API layer:
- GET /api/schedule (date range filtering ?from=&to=, join with task/events, 422/400 validation, 404 by ID)
- GET /api/tasks (priority_score, urgency, status, search, category, linked scheduled_slots, 404 by ID)
- GET /api/events (filtering by type, date range, 422/400 validation, 404 by ID)
- Validates Pydantic response models and frontend-compatible alias fields.
"""

from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from database import SessionLocal, Base, engine
import models
import main

client = TestClient(main.app)


def seed_test_data(db):
    """Clean slate and insert structured test events, tasks, and scheduled slots."""
    db.query(models.ConflictLog).delete()
    db.query(models.ScheduledSlot).delete()
    db.query(models.Task).delete()
    db.query(models.Event).delete()
    db.commit()

    # 1. Create Events
    ev_class = models.Event(
        title="CS101 Morning Lecture",
        type="class_session",
        start_datetime=datetime(2026, 9, 8, 9, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 9, 8, 10, 30, tzinfo=timezone.utc),
        subject="CS101",
        location="Room 401",
        status="scheduled"
    )
    ev_fest = models.Event(
        title="Riviera Cultural Fest Day 1",
        type="fest",
        start_datetime=datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 9, 12, 22, 0, tzinfo=timezone.utc),
        subject="CAMPUS",
        location="Main Ground",
        status="scheduled"
    )
    ev_holiday = models.Event(
        title="National Holiday",
        type="holiday",
        start_datetime=datetime(2026, 9, 15, 0, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 9, 15, 23, 59, tzinfo=timezone.utc),
        subject="CAMPUS",
        status="scheduled"
    )
    ev_club = models.Event(
        title="Robotics Club Hack Night",
        type="club_event",
        start_datetime=datetime(2026, 9, 9, 18, 0, tzinfo=timezone.utc),
        end_datetime=datetime(2026, 9, 9, 21, 0, tzinfo=timezone.utc),
        subject="ROBOTICS",
        location="Lab 2",
        status="scheduled"
    )
    db.add_all([ev_class, ev_fest, ev_holiday, ev_club])
    db.commit()

    # 2. Create Tasks
    task_high = models.Task(
        title="Data Structures Lab Assignment 3",
        type="assignment",
        deadline=datetime(2026, 9, 9, 23, 59, tzinfo=timezone.utc),
        subject="CS101",
        weightage="15%",
        priority_score=88, # High urgency (>= 75)
        status="scheduled",
        description="Binary Search Tree balance algorithms"
    )
    task_med = models.Task(
        title="Operating Systems Midterm Study",
        type="study_topic",
        deadline=datetime(2026, 9, 14, 18, 0, tzinfo=timezone.utc),
        subject="CS202",
        weightage="20%",
        priority_score=60, # Medium urgency (40-74)
        status="pending",
        description="Process synchronization and semaphores"
    )
    task_low = models.Task(
        title="Ethics in AI Reading Summary",
        type="assignment",
        deadline=datetime(2026, 9, 25, 23, 59, tzinfo=timezone.utc),
        subject="HU101",
        weightage="5%",
        priority_score=25, # Low urgency (< 40)
        status="completed",
        description="Read Chapter 4 on algorithmic bias"
    )
    db.add_all([task_high, task_med, task_low])
    db.commit()

    # 3. Create Scheduled Slots
    slot1 = models.ScheduledSlot(
        task_id=task_high.id,
        scheduled_date="2026-09-08",
        start_time="14:00",
        end_time="16:00",
        status="active",
        slot_type="regular"
    )
    slot2 = models.ScheduledSlot(
        task_id=task_med.id,
        scheduled_date="2026-09-10",
        start_time="10:00",
        end_time="12:00",
        status="active",
        slot_type="study_session"
    )
    db.add_all([slot1, slot2])
    db.commit()

    return {
        "events": [ev_class, ev_fest, ev_holiday, ev_club],
        "tasks": [task_high, task_med, task_low],
        "slots": [slot1, slot2]
    }


def test_schedule_endpoints():
    print("\n--- 1. Testing GET /api/schedule Endpoints ---")
    db = SessionLocal()
    data = seed_test_data(db)
    db.close()

    # 1a. Basic list
    resp = client.get("/api/schedule")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    slots = resp.json()
    assert len(slots) == 2, f"Expected 2 slots, got {len(slots)}"

    # Check first slot joined task & frontend alias fields
    first = slots[0]
    print("Slot #1 joined details:", first)
    assert first["task_id"] is not None
    assert first["task_title"] == "Data Structures Lab Assignment 3"
    assert first["task"] == "Data Structures Lab Assignment 3"     # Frontend alias
    assert first["subject"] == "CS101"
    assert first["category"] == "CS101"                           # Frontend alias
    assert first["scheduledSlot"] == "2026-09-08 14:00 - 16:00"   # Frontend formatted string
    assert first["urgency"] == "high"                             # Urgency bucket from priority_score=88
    assert first["priority_score"] == 88
    assert first["slot_type"] == "regular"
    assert first["event_id"] is not None                          # Matched CS101 event
    assert first["event_title"] == "CS101 Morning Lecture"
    print(" Verified task & event join + frontend compatibility aliases.")

    # 1b. Date range filtering ?from=YYYY-MM-DD&to=YYYY-MM-DD
    resp_range = client.get("/api/schedule?from=2026-09-07&to=2026-09-09")
    assert resp_range.status_code == 200
    range_slots = resp_range.json()
    assert len(range_slots) == 1
    assert range_slots[0]["scheduled_date"] == "2026-09-08"
    print(" Filter ?from=2026-09-07&to=2026-09-09 correctly returned only 2026-09-08 slot.")

    # 1c. Slot type filtering ?slot_type=study_session
    resp_type = client.get("/api/schedule?slot_type=study_session")
    assert resp_type.status_code == 200
    type_slots = resp_type.json()
    assert len(type_slots) == 1
    assert type_slots[0]["slot_type"] == "study_session"
    print(" Filter ?slot_type=study_session correctly returned 1 study session.")

    # 1d. HTTP 422 on invalid date format
    resp_bad_fmt = client.get("/api/schedule?from=08-09-2026")
    assert resp_bad_fmt.status_code == 422, f"Expected 422, got {resp_bad_fmt.status_code}"
    print(" HTTP 422 correctly raised on invalid date format (08-09-2026).")

    # 1e. HTTP 422 on impossible calendar date
    resp_bad_date = client.get("/api/schedule?from=2026-02-31")
    assert resp_bad_date.status_code == 422, f"Expected 422, got {resp_bad_date.status_code}"
    print(" HTTP 422 correctly raised on impossible calendar date (2026-02-31).")

    # 1f. HTTP 400 on from > to
    resp_inverted = client.get("/api/schedule?from=2026-09-15&to=2026-09-08")
    assert resp_inverted.status_code == 400, f"Expected 400, got {resp_inverted.status_code}"
    assert "cannot be after" in resp_inverted.json()["detail"]
    print(" HTTP 400 correctly raised when 'from' > 'to'.")

    # 1g. GET /api/schedule/{slot_id}
    slot_id = first["id"]
    resp_single = client.get(f"/api/schedule/{slot_id}")
    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == slot_id
    print(f" GET /api/schedule/{slot_id} verified.")

    # 1h. GET /api/schedule/999999 -> 404
    resp_404 = client.get("/api/schedule/999999")
    assert resp_404.status_code == 404
    print(" GET /api/schedule/999999 correctly returned 404.")


def test_tasks_endpoints():
    print("\n--- 2. Testing GET /api/tasks Endpoints ---")
    db = SessionLocal()
    data = seed_test_data(db)
    db.close()

    # 2a. Basic list
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    tasks = resp.json()
    assert len(tasks) == 3

    # Check tasks ordering by priority_score desc
    assert tasks[0]["priority_score"] >= tasks[1]["priority_score"] >= tasks[2]["priority_score"]

    # Check frontend compatibility fields
    t_high = tasks[0]
    print("High Priority Task:", t_high)
    assert t_high["title"] == "Data Structures Lab Assignment 3"
    assert t_high["task"] == "Data Structures Lab Assignment 3"
    assert t_high["category"] == "CS101"
    assert t_high["urgency"] == "high"
    assert t_high["status"] == "scheduled"
    assert t_high["completed"] is False
    assert t_high["scheduledSlot"] == "2026-09-08 14:00 - 16:00"
    assert len(t_high["scheduled_slots"]) == 1

    t_completed = next(t for t in tasks if t["status"] == "completed")
    assert t_completed["completed"] is True
    assert t_completed["urgency"] == "low"
    print(" Verified completed boolean flag and urgency buckets.")

    # 2b. Filtering by urgency
    resp_urg = client.get("/api/tasks?urgency=high")
    assert resp_urg.status_code == 200
    high_tasks = resp_urg.json()
    assert len(high_tasks) == 1
    assert high_tasks[0]["urgency"] == "high"
    print(" Filter ?urgency=high correctly returned only 1 task.")

    # 2c. Filtering by category
    resp_cat = client.get("/api/tasks?category=CS202")
    assert resp_cat.status_code == 200
    cat_tasks = resp_cat.json()
    assert len(cat_tasks) == 1
    assert cat_tasks[0]["subject"] == "CS202"
    print(" Filter ?category=CS202 correctly returned 1 task.")

    # 2d. Search keyword
    resp_search = client.get("/api/tasks?search=Binary Search Tree")
    assert resp_search.status_code == 200
    search_tasks = resp_search.json()
    assert len(search_tasks) == 1
    assert "Data Structures" in search_tasks[0]["title"]
    print(" Filter ?search=Binary Search Tree correctly matched task description.")

    # 2e. GET /api/tasks/{task_id}
    task_id = t_high["id"]
    resp_single = client.get(f"/api/tasks/{task_id}")
    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == task_id
    assert resp_single.json()["task"] == t_high["task"]
    print(f" GET /api/tasks/{task_id} verified.")

    # 2f. GET /api/tasks/999999 -> 404
    resp_404 = client.get("/api/tasks/999999")
    assert resp_404.status_code == 404
    print(" GET /api/tasks/999999 correctly returned 404.")


def test_events_endpoints():
    print("\n--- 3. Testing GET /api/events Endpoints ---")
    db = SessionLocal()
    data = seed_test_data(db)
    db.close()

    # 3a. Basic list
    resp = client.get("/api/events")
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) == 4

    # Verify frontend alias fields
    first = events[0]
    print("Event #1 details:", first)
    assert first["title"] is not None
    assert first["name"] == first["title"]       # Frontend alias
    assert first["category"] == first["subject"] # Frontend alias
    print(" Verified event fields and name/category frontend compatibility.")

    # 3b. Filter by type (fest)
    resp_fest = client.get("/api/events?type=fest")
    assert resp_fest.status_code == 200
    fests = resp_fest.json()
    assert len(fests) == 1
    assert fests[0]["type"] == "fest"
    assert "Riviera" in fests[0]["title"]
    print(" Filter ?type=fest correctly returned Riviera fest.")

    # 3c. Filter by type (class)
    resp_class = client.get("/api/events?type=class")
    assert resp_class.status_code == 200
    classes = resp_class.json()
    assert len(classes) == 1
    assert classes[0]["type"] in ["class", "class_session"]
    print(" Filter ?type=class correctly mapped to class_session.")

    # 3d. Date range filter on events
    resp_range = client.get("/api/events?from=2026-09-08&to=2026-09-09")
    assert resp_range.status_code == 200
    range_evs = resp_range.json()
    assert len(range_evs) == 2 # CS101 class (Sep 8) and Robotics (Sep 9)
    print(" Filter ?from=2026-09-08&to=2026-09-09 returned 2 events.")

    # 3e. Error validation (422 and 400)
    assert client.get("/api/events?from=invalid-date").status_code == 422
    assert client.get("/api/events?from=2026-09-20&to=2026-09-10").status_code == 400
    print(" Events date validation 422 and 400 verified.")

    # 3f. GET /api/events/{event_id}
    ev_id = first["id"]
    resp_single = client.get(f"/api/events/{ev_id}")
    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == ev_id
    print(f" GET /api/events/{ev_id} verified.")

    # 3g. GET /api/events/999999 -> 404
    assert client.get("/api/events/999999").status_code == 404
    print(" GET /api/events/999999 correctly returned 404.")


def test_focus_and_courses_and_google_sync_endpoints():
    print("\n--- 4. Testing Focus, Courses, and Google Sync Endpoints ---")
    
    # 4a. Focus Stats
    stats_resp = client.get("/api/focus/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "today_sessions_count" in stats
    assert "streak_days" in stats

    # 4b. Record Focus Session
    record_resp = client.post("/api/focus/complete", json={
        "mode": "POMODORO",
        "duration_seconds": 1500,
        "target_name": "CS101 Study Session"
    })
    assert record_resp.status_code == 201
    rec_data = record_resp.json()
    assert rec_data["completed"] is True
    assert rec_data["id"] > 0

    # 4c. Verify updated stats
    stats_resp2 = client.get("/api/focus/stats")
    assert stats_resp2.status_code == 200
    stats2 = stats_resp2.json()
    assert stats2["today_sessions_count"] >= 1
    assert stats2["today_focus_minutes"] >= 25

    # 4d. Courses List
    courses_resp = client.get("/api/courses")
    assert courses_resp.status_code == 200
    courses = courses_resp.json()
    assert len(courses) >= 3
    cs_course = next(c for c in courses if c["code"] == "CS101")
    assert cs_course["credits"] == 4

    # 4e. Plan Course Exam Study Blocks
    plan_resp = client.post(f"/api/courses/{cs_course['id']}/plan-exam")
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    assert "sessions_created" in plan_data
    assert "study_sessions" in plan_data

    # 4f. Google Calendar Sync & Import
    db_sync = SessionLocal()
    demo_u = db_sync.query(models.User).filter(models.User.google_id == "demo_user_1").first()
    target_uid = demo_u.id if demo_u else 1
    tok = db_sync.query(models.UserGoogleToken).filter_by(user_id=target_uid).first()
    if not tok:
        tok = models.UserGoogleToken(user_id=target_uid, access_token="mock_access_token_123")
        db_sync.add(tok)
        db_sync.commit()
    elif not tok.access_token:
        tok.access_token = "mock_access_token_123"
        db_sync.commit()
    db_sync.close()

    google_import_resp = client.post("/api/google/sync/import?commit=true")
    assert google_import_resp.status_code == 200
    g_res = google_import_resp.json()
    assert g_res.get("success") is True
    assert g_res.get("importedCount", 0) >= 1
    print(" Focus, Courses, and Google Sync Endpoints verified successfully.")


if __name__ == "__main__":
    test_schedule_endpoints()
    test_tasks_endpoints()
    test_events_endpoints()
    test_focus_and_courses_and_google_sync_endpoints()
    print("\n ALL FRONTEND REST API TESTS PASSED SUCCESSFULLY! ")
