import io
from datetime import datetime, date, time, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.exam_planner import generate_exam_study_plan


def run_exam_planner_tests():
    print("=== Running Exam Study Planner Service & API Tests ===")

    now = datetime.now(timezone.utc)
    today = now.date()
    exam_date = today + timedelta(days=9)
    exam_deadline = datetime.combine(exam_date, time(9, 30))

    with TestClient(app) as client:
        # -------------------------------------------------------------
        # 1. Verify scheduled_slots table has slot_type column
        # -------------------------------------------------------------
        print("\n--- 1. Verifying Database Schema ---")
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("scheduled_slots")]
        print("Columns in scheduled_slots:", columns)
        assert "slot_type" in columns, "Expected 'slot_type' column in 'scheduled_slots'"
        print(" Column 'slot_type' verified on 'scheduled_slots' table.")

        db = SessionLocal()
        try:
            # Clean test tables for an isolated run
            db.query(models.ConflictLog).delete()
            db.query(models.ScheduledSlot).delete()
            db.query(models.Event).delete()
            db.query(models.Task).delete()
            db.commit()

            # ---------------------------------------------------------
            # 2. Setup Exam Task & Environment
            # ---------------------------------------------------------
            print("\n--- 2. Setting up Exam Task & Fixed Classes ---")
            exam_task = models.Task(
                title="Continuous Assessment Test 1 (CAT-1): Operating Systems",
                type="exam_work",
                subject="CS201",
                deadline=exam_deadline,
                weightage="30%",
                status="pending",
                priority_score=95
            )
            db.add(exam_task)

            # Add recurring daily classes: 09:00 - 10:30 and 14:00 - 15:30 on study days
            for d_offset in range(1, 10):
                day_d = today + timedelta(days=d_offset)
                class_morning = models.Event(
                    title="OS Lecture",
                    type="class_session",
                    subject="CS201",
                    start_datetime=datetime.combine(day_d, time(9, 0)),
                    end_datetime=datetime.combine(day_d, time(10, 30)),
                    status="scheduled"
                )
                db.add(class_morning)

            # Add a blocking fest event on day 7 before exam (2 days from now)
            fest_day = exam_date - timedelta(days=7)
            fest_event = models.Event(
                title="Engineering Hackathon",
                type="fest",
                start_datetime=datetime.combine(fest_day, time(8, 0)),
                end_datetime=datetime.combine(fest_day, time(12, 0)),
                description="Hackathon - all classrooms occupied",
                status="scheduled"
            )
            db.add(fest_event)
            db.commit()
            db.refresh(exam_task)

            print(f"Created Exam Task #{exam_task.id}: '{exam_task.title}' on {exam_date}")
            print(f"Created Blocking Fest on {fest_day} (08:00 - 12:00)")

            # ---------------------------------------------------------
            # 3. Generate Spaced Repetition Study Plan
            # ---------------------------------------------------------
            print("\n--- 3. Running generate_exam_study_plan ---")
            plan = generate_exam_study_plan(task_id=exam_task.id, db=db)
            print("Plan response message:", plan["message"])
            print(f"Planned intervals: {plan['intervals_planned']}")
            print(f"Study sessions created: {plan['sessions_created']}")

            assert plan["sessions_created"] >= 3, "Expected at least 3 spaced repetition sessions"
            assert plan["intervals_planned"] == [7, 4, 2, 1]

            # ---------------------------------------------------------
            # 4. Verify Study Sessions & Tags
            # ---------------------------------------------------------
            print("\n--- 4. Verifying Session Properties & Tags ---")
            for session in plan["study_sessions"]:
                print(f" - Session on {session['scheduled_date']} from {session['start_time']} to {session['end_time']} (Type: {session['slot_type']})")
                assert session["slot_type"] == "study_session", (
                    f"Session must have slot_type='study_session', got {session['slot_type']}"
                )

                # Verify session does NOT overlap with the morning class (09:00 - 10:30)
                st = session["start_time"]
                et = session["end_time"]
                overlap_class = (st < "10:30" and et > "09:00")
                assert not overlap_class, f"Session {st}-{et} overlaps with class 09:00-10:30!"

                # Verify on fest day, session does not overlap fest (08:00 - 12:00)
                if session["scheduled_date"] == fest_day.strftime("%Y-%m-%d"):
                    overlap_fest = (st < "12:00" and et > "08:00")
                    assert not overlap_fest, f"Session {st}-{et} overlaps with fest 08:00-12:00!"

            print(" All sessions verified: tagged with 'study_session', no class overlaps, conflict-free!")

            # ---------------------------------------------------------
            # 5. Verify DB Persistence & Task Status
            # ---------------------------------------------------------
            print("\n--- 5. Verifying DB Persistence ---")
            db_slots = (
                db.query(models.ScheduledSlot)
                .filter(models.ScheduledSlot.task_id == exam_task.id)
                .all()
            )
            assert len(db_slots) == plan["sessions_created"]
            for s in db_slots:
                assert s.slot_type == "study_session"
                assert s.status == "active"

            db.refresh(exam_task)
            assert exam_task.status == "scheduled"
            print(" Database records verified: slot_type='study_session', task.status='scheduled'.")

        finally:
            db.close()

        # -------------------------------------------------------------
        # 6. Test API Endpoint POST /api/exam-planner/generate/{task_id}
        # -------------------------------------------------------------
        print("\n--- 6. Testing API Endpoint ---")
        resp = client.post(f"/api/exam-planner/generate/{exam_task.id}")
        assert resp.status_code == 200
        api_data = resp.json()
        print(f"API Endpoint returned {api_data['sessions_created']} study sessions.")
        assert api_data["task_id"] == exam_task.id
        assert api_data["exam_date"] == exam_date.strftime("%Y-%m-%d")
        assert len(api_data["study_sessions"]) >= 3
        assert api_data["study_sessions"][0]["slot_type"] == "study_session"

        # Test non-existent task error handling
        bad_resp = client.post("/api/exam-planner/generate/999999")
        assert bad_resp.status_code == 400
        print(" Non-existent task returns 400 Bad Request.")

    print("\n ALL EXAM STUDY PLANNER TESTS COMPLETED SUCCESSFULLY!")


def test_exam_planner():
    run_exam_planner_tests()


if __name__ == "__main__":
    run_exam_planner_tests()
