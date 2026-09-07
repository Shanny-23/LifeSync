import json
from datetime import datetime, date, time, timedelta, timezone
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.scheduler import (
    compute_daily_free_slots,
    calculate_task_priority,
    get_schedule_context,
)


def run_scheduler_tests():
    print("=== Running AI Scheduler Service & API Tests ===")

    # -------------------------------------------------------------
    # 1. Test Free Slot Calculation Logic
    # -------------------------------------------------------------
    print("\n--- 1. Testing Gap & Free Slot Calculation ---")
    test_date = date(2026, 9, 8)
    busy_classes = [
        (time(9, 0), time(10, 30)),
        (time(14, 0), time(15, 30))
    ]
    free_gaps = compute_daily_free_slots(test_date, busy_classes)
    print(f"Computed free gaps for {test_date}: {free_gaps}")

    # Expected:
    # Gap 1: 08:00 - 09:00 (60 mins)
    # Gap 2: 10:30 - 14:00 (210 mins)
    # Gap 3: 15:30 - 22:00 (390 mins)
    assert len(free_gaps) == 3
    assert free_gaps[0]["start_time"] == "08:00"
    assert free_gaps[0]["end_time"] == "09:00"
    assert free_gaps[1]["start_time"] == "10:30"
    assert free_gaps[1]["end_time"] == "14:00"
    assert free_gaps[2]["start_time"] == "15:30"
    assert free_gaps[2]["end_time"] == "22:00"
    print(" Free time gaps between classes calculated accurately.")

    # -------------------------------------------------------------
    # 2. Test Priority Score Calculation
    # -------------------------------------------------------------
    print("\n--- 2. Testing Priority Score Calculation ---")
    now = datetime.now(timezone.utc)
    urgent_task = models.Task(
        title="Urgent Assignment",
        type="assignment",
        deadline=now + timedelta(days=1),
        weightage="30%",
        status="pending"
    )
    future_task = models.Task(
        title="Optional Reading",
        type="study_topic",
        deadline=now + timedelta(days=15),
        weightage=None,
        status="pending"
    )

    urgent_score = calculate_task_priority(urgent_task, now)
    future_score = calculate_task_priority(future_task, now)
    print(f"Urgent Task Score: {urgent_score} | Future Task Score: {future_score}")
    assert urgent_score > future_score
    print(" Priority scoring correctly favors near deadlines and high weightage.")

    # -------------------------------------------------------------
    # 3. Test API Endpoint & Database Persistence
    # -------------------------------------------------------------
    print("\n--- 3. Testing POST /api/schedule/generate Endpoint ---")

    with TestClient(app) as client:
        # 3a. Verify scheduled_slots table in database
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert "scheduled_slots" in tables, f"Expected 'scheduled_slots' in {tables}"
        print(" Table 'scheduled_slots' exists in SQLite database.")

        db = SessionLocal()
        db.query(models.ScheduledSlot).delete()
        db.query(models.Task).delete()
        db.query(models.Event).delete()
        db.commit()

        # Seed 1 fixed class event
        today_date = datetime.now(timezone.utc).date()
        class_ev = models.Event(
            title="CS101 Morning Lecture",
            type="class_session",
            start_datetime=datetime.combine(today_date, time(9, 0)),
            end_datetime=datetime.combine(today_date, time(10, 30)),
            subject="CS101",
            location="Hall A",
            status="scheduled"
        )
        db.add(class_ev)

        # Seed 2 pending tasks
        task_1 = models.Task(
            title="Algorithm Problem Set 1",
            type="assignment",
            subject="CS101",
            deadline=datetime.combine(today_date + timedelta(days=2), time(23, 59)),
            weightage="20%",
            status="pending"
        )
        task_2 = models.Task(
            title="Read Chapter 3 Concurrency",
            type="study_topic",
            subject="CS102",
            deadline=datetime.combine(today_date + timedelta(days=5), time(23, 59)),
            weightage="10%",
            status="pending"
        )
        db.add_all([task_1, task_2])
        db.commit()
        db.refresh(task_1)
        db.refresh(task_2)

        t1_id = task_1.id
        t2_id = task_2.id
        db.close()

        # Mock Claude response allocating slots
        sched_date_str = today_date.strftime("%Y-%m-%d")
        mock_claude_json = json.dumps([
            {
                "task_id": t1_id,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "11:00",
                "scheduled_end_time": "12:30"
            },
            {
                "task_id": t2_id,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "16:00",
                "scheduled_end_time": "17:15"
            }
        ])

        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text=mock_claude_json)]

        AUTH_HEADERS = {"Authorization": "Bearer demo-token-demo_user_1"}
        with patch("anthropic.Anthropic") as MockAnthropic, \
             patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-ant-test-key"}):
            instance = MockAnthropic.return_value
            instance.messages.create.return_value = mock_resp

            gen_resp = client.post("/api/schedule/generate", headers=AUTH_HEADERS)
            assert gen_resp.status_code == 200, f"Error: {gen_resp.text}"
            res_data = gen_resp.json()
            print(f"Schedule Generation Response: {res_data}")
            assert res_data["slots_created"] == 2
            assert res_data["tasks_scheduled"] == 2
            assert len(res_data["scheduled_slots"]) == 2
            print(" POST /api/schedule/generate created 2 scheduled slots via Claude.")

        # 3b. Verify Database records directly
        db = SessionLocal()
        slots_in_db = db.query(models.ScheduledSlot).all()
        assert len(slots_in_db) == 2
        assert slots_in_db[0].status == "active"
        assert bool(slots_in_db[0].start_time)

        # Verify task status transitioned to 'scheduled'
        t1 = db.query(models.Task).filter(models.Task.id == t1_id).first()
        assert t1.status == "scheduled"
        print(" Task status accurately updated to 'scheduled'.")
        db.close()

        # 3c. Test GET /api/schedule
        get_sched_resp = client.get("/api/schedule", headers=AUTH_HEADERS)
        assert get_sched_resp.status_code == 200
        sched_list = get_sched_resp.json()
        print(f"GET /api/schedule returned {len(sched_list)} active slot(s):")
        for s in sched_list:
            print(f"  - Slot #{s['id']}: Task '{s['task_title']}' ({s['subject']}) on {s['scheduled_date']} from {s['start_time']} to {s['end_time']}")
        assert len(sched_list) == 2
        print(" GET /api/schedule query endpoint verified.")

    print("\n ALL AI SCHEDULER TESTS PASSED SUCCESSFULLY!")


def test_scheduler():
    run_scheduler_tests()


if __name__ == "__main__":
    run_scheduler_tests()
