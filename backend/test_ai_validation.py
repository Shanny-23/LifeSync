import os
import json
from datetime import datetime, date, time, timedelta, timezone
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from database import engine, SessionLocal
import models
from services.scheduler import (
    validate_schedule_slot,
    generate_ai_schedule,
)
from services.conflict_resolver import (
    resolve_schedule_conflicts,
    find_alternate_slot_for_task
)

AUTH_HEADERS = {"Authorization": "Bearer demo-token-demo_user_1"}


def run_ai_validation_tests():
    print("=== Running AI Scheduler & Conflict Resolver Stricter Validation Tests ===")

    db = SessionLocal()
    try:
        # Clean DB state for isolation
        db.query(models.ConflictLog).delete()
        db.query(models.ScheduledSlot).delete()
        db.query(models.Event).delete()
        db.query(models.Task).delete()
        db.commit()

        now = datetime.now(timezone.utc)
        today = now.date()
        sched_date_str = today.strftime("%Y-%m-%d")

        # ---------------------------------------------------------------------
        # Setup Test Fixtures:
        # Fixed Event 1: Morning Class (09:00 - 10:30)
        # Fixed Event 2: Midterm Exam (14:00 - 16:00)
        # ---------------------------------------------------------------------
        class_ev = models.Event(
            title="CS101 Morning Lecture",
            type="class_session",
            start_datetime=datetime.combine(today, time(9, 0)),
            end_datetime=datetime.combine(today, time(10, 30)),
            subject="CS101",
            status="scheduled"
        )
        exam_ev = models.Event(
            title="Math 204 Midterm Exam",
            type="exam",
            start_datetime=datetime.combine(today, time(14, 0)),
            end_datetime=datetime.combine(today, time(16, 0)),
            subject="MATH204",
            status="scheduled"
        )
        db.add_all([class_ev, exam_ev])

        # Task A: Valid deadline (tomorrow night)
        task_valid = models.Task(
            title="Valid Research Task",
            type="assignment",
            subject="CS101",
            deadline=datetime.combine(today + timedelta(days=1), time(23, 59)),
            status="pending",
            priority_score=80
        )
        # Task B: Tight deadline (today at 13:00)
        task_tight_deadline = models.Task(
            title="Tight Deadline Lab Writeup",
            type="assignment",
            subject="CS102",
            deadline=datetime.combine(today, time(13, 0)),
            status="pending",
            priority_score=90
        )
        # Task C: Overlap target
        task_overlap = models.Task(
            title="Exam Prep Topic",
            type="study_topic",
            subject="MATH204",
            deadline=datetime.combine(today + timedelta(days=2), time(23, 59)),
            status="pending",
            priority_score=85
        )
        db.add_all([task_valid, task_tight_deadline, task_overlap])
        db.commit()
        db.refresh(task_valid)
        db.refresh(task_tight_deadline)
        db.refresh(task_overlap)

        t_valid_id = task_valid.id
        t_tight_id = task_tight_deadline.id
        t_overlap_id = task_overlap.id

        # ---------------------------------------------------------------------
        # TEST 1: Unit Validation - Task ID Verification (Hallucinated Task ID)
        # ---------------------------------------------------------------------
        print("\n--- Test 1: Hallucinated task_id verification ---")
        hallucinated_slot = {
            "task_id": 999999,  # Does not exist
            "scheduled_date": sched_date_str,
            "scheduled_start_time": "11:00",
            "scheduled_end_time": "12:00"
        }
        is_valid, task, reason = validate_schedule_slot(hallucinated_slot, db)
        assert is_valid is False
        assert task is None
        assert "not_found" in reason
        print(f" [PASS] Hallucinated task_id 999999 successfully rejected: {reason}")

        # ---------------------------------------------------------------------
        # TEST 2: Unit Validation - Deadline Window Verification
        # ---------------------------------------------------------------------
        print("\n--- Test 2: Scheduled slot past actual deadline verification ---")
        # Task tight deadline is 13:00 today. Propose slot ending at 13:30 (after deadline)
        late_slot = {
            "task_id": t_tight_id,
            "scheduled_date": sched_date_str,
            "scheduled_start_time": "12:30",
            "scheduled_end_time": "13:30"  # Exceeds 13:00 deadline!
        }
        is_valid, task, reason = validate_schedule_slot(late_slot, db)
        assert is_valid is False
        assert task is not None
        assert task.id == t_tight_id
        assert "exceeds_deadline" in reason
        print(f" [PASS] Slot past deadline successfully rejected: {reason}")

        # ---------------------------------------------------------------------
        # TEST 3: Unit Validation - Hard Assertion Overlap with Fixed Event
        # ---------------------------------------------------------------------
        print("\n--- Test 3: Hard assertion overlap with fixed event (class or exam) ---")
        # Exam is 14:00 to 16:00. Propose slot 14:30 to 15:30 (overlaps exam!)
        exam_overlap_slot = {
            "task_id": t_overlap_id,
            "scheduled_date": sched_date_str,
            "scheduled_start_time": "14:30",
            "scheduled_end_time": "15:30"
        }
        is_valid, task, reason = validate_schedule_slot(exam_overlap_slot, db)
        assert is_valid is False
        assert task is not None
        assert "overlaps_fixed_event" in reason
        print(f" [PASS] Overlap with exam '{exam_ev.title}' hard-rejected: {reason}")

        # Also test overlap with Morning Class (09:00 - 10:30)
        class_overlap_slot = {
            "task_id": t_overlap_id,
            "scheduled_date": sched_date_str,
            "scheduled_start_time": "10:00",
            "scheduled_end_time": "11:00"
        }
        is_valid, task, reason = validate_schedule_slot(class_overlap_slot, db)
        assert is_valid is False
        assert "overlaps_fixed_event" in reason
        print(f" [PASS] Overlap with class '{class_ev.title}' hard-rejected: {reason}")

        # Valid slot (11:00 - 12:00) during free gap
        good_slot = {
            "task_id": t_valid_id,
            "scheduled_date": sched_date_str,
            "scheduled_start_time": "11:00",
            "scheduled_end_time": "12:00"
        }
        is_valid, task, reason = validate_schedule_slot(good_slot, db)
        assert is_valid is True
        assert task.id == t_valid_id
        assert reason is None
        print(" [PASS] Conflict-free slot within deadline accepted successfully.")

        # ---------------------------------------------------------------------
        # TEST 4: End-to-End AI Scheduling Engine with Mixed Output
        # Propose 4 slots:
        # - Slot 1: Valid Task A -> Scheduled
        # - Slot 2: Task B scheduled past deadline -> Rejected, marked needs_manual_review
        # - Slot 3: Task C overlapping Math 204 Exam -> Rejected, marked needs_manual_review
        # - Slot 4: Task 999999 (hallucinated) -> Discarded
        # ---------------------------------------------------------------------
        print("\n--- Test 4: End-to-End AI Scheduling Engine with Strict Validation ---")
        mock_ai_response = json.dumps([
            {
                "task_id": t_valid_id,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "11:00",
                "scheduled_end_time": "12:00"
            },
            {
                "task_id": t_tight_id,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "13:00",
                "scheduled_end_time": "14:00"  # Exceeds 13:00 deadline!
            },
            {
                "task_id": t_overlap_id,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "14:30",
                "scheduled_end_time": "15:30"  # Overlaps exam!
            },
            {
                "task_id": 999999,
                "scheduled_date": sched_date_str,
                "scheduled_start_time": "16:30",
                "scheduled_end_time": "17:30"  # Hallucinated task!
            }
        ])

        with patch("services.scheduler.call_groq_chat") as mock_groq, \
             patch("services.scheduler.get_groq_api_key", return_value="gsk-test-key"):
            mock_groq.return_value = mock_ai_response

            with TestClient(app) as client:
                res = client.post("/api/schedule/generate", headers=AUTH_HEADERS)
                assert res.status_code == 200, f"Error: {res.text}"
                data = res.json()
                print("API Generate Schedule Result:", data)

                # Verify counts: Only Task A should be scheduled
                assert data["tasks_scheduled"] == 1
                assert data["slots_created"] == 1
                assert len(data["scheduled_slots"]) == 1
                assert data["scheduled_slots"][0]["task_id"] == t_valid_id

                # Verify flagged tasks
                assert t_tight_id in data["flagged_tasks"]
                assert t_overlap_id in data["flagged_tasks"]
                assert 999999 not in data["flagged_tasks"]  # Discarded, not in DB
                print(" [PASS] Return payload accurately isolated valid slots vs flagged tasks.")

        # ---------------------------------------------------------------------
        # TEST 5: Verify Database State & "needs_manual_review" Status
        # ---------------------------------------------------------------------
        print("\n--- Test 5: Verify Database Tasks Statuses ---")
        db.expire_all()
        t_val_db = db.query(models.Task).filter(models.Task.id == t_valid_id).first()
        t_tight_db = db.query(models.Task).filter(models.Task.id == t_tight_id).first()
        t_overlap_db = db.query(models.Task).filter(models.Task.id == t_overlap_id).first()

        assert t_val_db.status == "scheduled", f"Expected 'scheduled', got {t_val_db.status}"
        assert t_tight_db.status == "needs_manual_review", f"Expected 'needs_manual_review', got {t_tight_db.status}"
        assert t_overlap_db.status == "needs_manual_review", f"Expected 'needs_manual_review', got {t_overlap_db.status}"

        print(f" Task #{t_val_db.id} status: {t_val_db.status} [PASS]")
        print(f" Task #{t_tight_db.id} status: {t_tight_db.status} [PASS - Surfaces to user]")
        print(f" Task #{t_overlap_db.id} status: {t_overlap_db.status} [PASS - Surfaces to user]")

        # ---------------------------------------------------------------------
        # TEST 6: Conflict Resolver Unresolved Task Status
        # When a conflicted task cannot be scheduled before deadline,
        # it must be marked "needs_manual_review"
        # ---------------------------------------------------------------------
        print("\n--- Test 6: Conflict Resolver Unresolved Task marked 'needs_manual_review' ---")
        # Test 6: Task with a conflict where no valid gap of >=45 min exists before deadline
        # Class is 09:00 - 10:30. Task deadline is today at 09:30.
        # Active slot was erroneously scheduled at 09:15 - 10:15 (overlapping class).
        # Any alternate slot before 09:30 must be between 08:00 and 09:00 (only 60 min gap, but class starts at 09:00 and deadline is 09:30).
        # But if deadline is 08:30 (only 30 min from day start 08:00), no 45+ min slot can exist!
        impossible_task = models.Task(
            title="Instant Turn-in Assignment",
            type="assignment",
            subject="ENG301",
            deadline=datetime.combine(today, time(8, 30)),
            status="scheduled"
        )
        db.add(impossible_task)
        db.commit()
        db.refresh(impossible_task)

        bad_slot = models.ScheduledSlot(
            task_id=impossible_task.id,
            scheduled_date=today.strftime("%Y-%m-%d"),
            start_time="08:15",
            end_time="09:15",
            status="active"
        )
        db.add(bad_slot)

        # Add a morning assembly event overlapping 08:00 - 09:00
        morning_assembly = models.Event(
            title="Dean's Morning Address",
            type="event",
            start_datetime=datetime.combine(today, time(8, 0)),
            end_datetime=datetime.combine(today, time(9, 0)),
            status="scheduled"
        )
        db.add(morning_assembly)
        db.commit()

        # Run conflict resolver
        with TestClient(app) as client:
            c_res = client.post("/api/schedule/resolve-conflicts?days_ahead=2", headers=AUTH_HEADERS)
            assert c_res.status_code == 200
            c_data = c_res.json()
            print("Conflict resolution output:", c_data["message"])

        db.refresh(impossible_task)
        assert impossible_task.status == "needs_manual_review", (
            f"Expected conflict-unresolved task to be 'needs_manual_review', got '{impossible_task.status}'"
        )
        print(f" [PASS] Conflicted task without alternate slot marked '{impossible_task.status}'.")

        # Verify conflict log entry
        c_log = db.query(models.ConflictLog).filter(models.ConflictLog.task_id == impossible_task.id).first()
        assert c_log is not None
        assert c_log.resolved_action == "needs_manual_review"
        print(f" [PASS] Conflict log action recorded: '{c_log.resolved_action}'.")

    finally:
        db.close()

    print("\n ALL STRICT VALIDATION TESTS PASSED SUCCESSFULLY! ")


if __name__ == "__main__":
    run_ai_validation_tests()
