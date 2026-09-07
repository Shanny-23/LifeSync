import io
from datetime import datetime, date, time, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.conflict_resolver import (
    find_conflicting_event,
    resolve_schedule_conflicts,
    compute_non_conflicting_free_slots
)


def run_conflict_resolver_tests():
    print("=== Running Conflict Resolver Service & API Tests ===")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=1)).date()
    target_date_str = target_date.strftime("%Y-%m-%d")
    deadline_dt = datetime.combine(target_date + timedelta(days=3), time(23, 59))

    with TestClient(app) as client:
        # -------------------------------------------------------------
        # 1. Verify conflict_log Table in Database
        # -------------------------------------------------------------
        print("\n--- 1. Testing conflict_log Database Schema ---")
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Database tables: {tables}")
        assert "conflict_log" in tables, f"Expected 'conflict_log' in {tables}"
        print(" Table 'conflict_log' exists in SQLite database.")

        db = SessionLocal()
        try:
            # Clean test tables for an isolated run
            db.query(models.ConflictLog).delete()
            db.query(models.ScheduledSlot).delete()
            db.query(models.Event).delete()
            db.query(models.Task).delete()
            db.commit()

            # ---------------------------------------------------------
            # 2. Setup a Conflicting Scenario: Fest Event vs Scheduled Slot
            # ---------------------------------------------------------
            print("\n--- 2. Setting up Conflicting Event & Slot ---")
            # Blocking Fest: 10:00 to 14:00 on target_date
            fest_event = models.Event(
                title="Annual Spring Tech Fest",
                type="fest",
                start_datetime=datetime.combine(target_date, time(10, 0)),
                end_datetime=datetime.combine(target_date, time(14, 0)),
                description="Campus Tech Fest Hackathon & Keynotes",
                status="scheduled"
            )
            db.add(fest_event)

            # Task with deadline 3 days away
            task_algo = models.Task(
                title="Algorithms Dynamic Programming Set",
                type="assignment",
                subject="CS101",
                deadline=deadline_dt,
                weightage="25%",
                status="scheduled",
                priority_score=85
            )
            db.add(task_algo)
            db.commit()
            db.refresh(fest_event)
            db.refresh(task_algo)

            # Scheduled Slot overlapping the fest: 11:00 to 12:30
            conflicted_slot = models.ScheduledSlot(
                task_id=task_algo.id,
                scheduled_date=target_date_str,
                start_time="11:00",
                end_time="12:30",
                status="active"
            )
            db.add(conflicted_slot)
            db.commit()
            db.refresh(conflicted_slot)

            print(f"Created Fest #{fest_event.id}: {fest_event.title} (10:00 - 14:00)")
            print(f"Created Slot #{conflicted_slot.id}: Task #{task_algo.id} (11:00 - 12:30) -> OVERLAPS WITH FEST")

            # ---------------------------------------------------------
            # 3. Test Conflict Detection
            # ---------------------------------------------------------
            print("\n--- 3. Testing Conflict Detection ---")
            detected_event = find_conflicting_event(conflicted_slot, db)
            assert detected_event is not None, "Conflict detection failed to identify overlapping fest"
            assert detected_event.id == fest_event.id
            print(f" Correctly detected collision with '{detected_event.title}' ({detected_event.type}).")

            # ---------------------------------------------------------
            # 4. Run Conflict Resolution Service
            # ---------------------------------------------------------
            print("\n--- 4. Running Conflict Resolution Service ---")
            resolution = resolve_schedule_conflicts(db, days_ahead=7)
            print("Resolution summary:", resolution["message"])
            assert resolution["conflicts_detected"] == 1
            assert resolution["conflicts_rescheduled"] == 1
            assert len(resolution["conflict_logs"]) == 1

            # Verify the slot was rescheduled outside the fest window
            db.refresh(conflicted_slot)
            print(f" Rescheduled slot: Date={conflicted_slot.scheduled_date}, {conflicted_slot.start_time} - {conflicted_slot.end_time}")
            assert conflicted_slot.status == "active"
            # It must not overlap 10:00 - 14:00 on target_date
            if conflicted_slot.scheduled_date == target_date_str:
                assert conflicted_slot.end_time <= "10:00" or conflicted_slot.start_time >= "14:00"

            # ---------------------------------------------------------
            # 5. Verify Conflict Log Entry
            # ---------------------------------------------------------
            print("\n--- 5. Verifying Conflict Log Entry in DB ---")
            log_entry = db.query(models.ConflictLog).first()
            assert log_entry is not None
            assert log_entry.slot_id == conflicted_slot.id
            assert log_entry.task_id == task_algo.id
            assert log_entry.conflicting_event_id == fest_event.id
            assert log_entry.conflict_type == "overlap_fest"
            assert log_entry.resolved_action == "rescheduled"
            assert log_entry.original_start_time == "11:00"
            assert log_entry.new_start_time == conflicted_slot.start_time
            print(" Conflict log record verified with full audit transparency:")
            print(f"  - Action: {log_entry.resolved_action}")
            print(f"  - Original: {log_entry.original_date} {log_entry.original_start_time}-{log_entry.original_end_time}")
            print(f"  - Rescheduled to: {log_entry.new_date} {log_entry.new_start_time}-{log_entry.new_end_time}")
            print(f"  - Notes: {log_entry.notes}")

            # ---------------------------------------------------------
            # 6. Test Removal when No Alternate Slot is Available
            # ---------------------------------------------------------
            print("\n--- 6. Testing Removal when No Alternate Slot Exists ---")
            # Create an impossible task due in 10 minutes, but blocked by a full-day holiday
            holiday_date = (now + timedelta(days=2)).date()
            holiday_date_str = holiday_date.strftime("%Y-%m-%d")

            holiday_event = models.Event(
                title="Independence Day Holiday",
                type="holiday",
                start_datetime=datetime.combine(holiday_date, time(0, 0)),
                end_datetime=datetime.combine(holiday_date, time(23, 59)),
                description="National holiday - all facilities closed",
                status="scheduled"
            )
            db.add(holiday_event)

            impossible_task = models.Task(
                title="Urgent Homework due during holiday",
                type="assignment",
                subject="CS101",
                deadline=datetime.combine(holiday_date, time(18, 0)),  # Deadline is on the holiday
                status="scheduled"
            )
            db.add(impossible_task)
            db.commit()
            db.refresh(holiday_event)
            db.refresh(impossible_task)

            holiday_slot = models.ScheduledSlot(
                task_id=impossible_task.id,
                scheduled_date=holiday_date_str,
                start_time="10:00",
                end_time="11:30",
                status="active"
            )
            db.add(holiday_slot)
            db.commit()
            db.refresh(holiday_slot)

            # Resolve conflicts: since the whole day is a holiday and deadline is that evening,
            # no alternate slot before deadline can exist on or after the holiday!
            res_holiday = resolve_schedule_conflicts(db, days_ahead=2)
            db.refresh(holiday_slot)
            db.refresh(impossible_task)

            # Slot was either removed or rescheduled before the holiday
            print(f" Holiday conflict action: slot.status={holiday_slot.status}, task.status={impossible_task.status}")
            logs = db.query(models.ConflictLog).filter(models.ConflictLog.task_id == impossible_task.id).all()
            assert len(logs) >= 1
            print(f" Logged action for holiday task: {logs[0].resolved_action}")

        finally:
            db.close()

        # -------------------------------------------------------------
        # 7. Test API Endpoints
        # -------------------------------------------------------------
        print("\n--- 7. Testing API Endpoints ---")
        AUTH_HEADERS = {"Authorization": "Bearer demo-token-demo_user_1"}
        post_resp = client.post("/api/schedule/resolve-conflicts?days_ahead=7", headers=AUTH_HEADERS)
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        print("POST /api/schedule/resolve-conflicts response:", post_data["message"])

        get_resp = client.get("/api/schedule/conflicts", headers=AUTH_HEADERS)
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        print(f"GET /api/schedule/conflicts returned {len(get_data)} logged conflict(s).")
        assert len(get_data) >= 1

    print("\n ALL CONFLICT RESOLVER TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_conflict_resolver_tests()
