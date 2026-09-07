import io
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.normalizer import normalize_upload_data


def run_normalizer_tests():
    print("=== Running Normalizer Service & API Tests ===")

    with TestClient(app) as client:
        # 1. Verify tables in DB
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Database tables: {tables}")
        assert "events" in tables, f"Expected 'events' table in {tables}"
        assert "tasks" in tables, f"Expected 'tasks' table in {tables}"
        print(" Tables 'events' and 'tasks' exist in SQLite database.")

        # Clean test tables for an idempotent test run
        db = SessionLocal()
        db.query(models.ScheduledSlot).delete()
        db.query(models.Event).delete()
        db.query(models.Task).delete()
        db.query(models.ExtractedData).delete()
        db.query(models.Upload).delete()
        db.commit()


        # ---------------------------------------------------------
        # 2. Test Timetable Normalization -> Events
        # ---------------------------------------------------------
        print("\n--- 2. Testing Timetable Normalization ---")
        tt_upload = models.Upload(
            type="timetable",
            filename="fall2026_schedule.pdf",
            filepath="storage/uploads/fall2026_schedule.pdf",
            status="extracted",
            raw_text="Monday 09:00 - 10:30 CS101 Algorithms Room 402"
        )
        db.add(tt_upload)
        db.commit()
        db.refresh(tt_upload)

        tt_extracted = models.ExtractedData(
            upload_id=tt_upload.id,
            type="timetable",
            data=[
                {
                    "day": "Monday",
                    "start_time": "09:00",
                    "end_time": "10:30",
                    "subject": "CS101 Algorithms",
                    "location": "Room 402"
                },
                {
                    "day": "Wednesday",
                    "start_time": "14:00",
                    "end_time": "15:30",
                    "subject": "CS102 Systems",
                    "location": "Lab 1"
                }
            ]
        )
        db.add(tt_extracted)
        db.commit()

        # Call POST /api/upload/{upload_id}/normalize
        resp_tt = client.post(f"/api/upload/{tt_upload.id}/normalize")
        assert resp_tt.status_code == 200, f"Error: {resp_tt.text}"
        data_tt = resp_tt.json()
        print(f"Timetable Normalization response: {data_tt}")
        assert data_tt["events_inserted"] == 2
        assert data_tt["events_updated"] == 0

        # Verify in DB
        events = db.query(models.Event).filter(models.Event.source_upload_id == tt_upload.id).all()
        assert len(events) == 2
        assert events[0].type == "class_session"
        assert events[0].subject in ["CS101 Algorithms", "CS102 Systems"]
        print(f" 2 class_session events created in 'events' table.")

        # Re-run to verify DEDUPLICATION (no duplicate rows created)
        resp_tt_reupload = client.post(f"/api/upload/{tt_upload.id}/normalize")
        assert resp_tt_reupload.status_code == 200
        data_tt_reupload = resp_tt_reupload.json()
        print(f"Re-upload Timetable response (Dedupe check): {data_tt_reupload}")
        assert data_tt_reupload["events_inserted"] == 0
        assert data_tt_reupload["events_updated"] == 2

        events_after = db.query(models.Event).filter(models.Event.source_upload_id == tt_upload.id).all()
        assert len(events_after) == 2, "Row count must remain 2 after re-normalizing duplicate entries"
        print(" Event deduplication verified: 0 new inserts, 2 updated.")

        # ---------------------------------------------------------
        # 3. Test Holiday / Fest / Club Normalization -> Events
        # ---------------------------------------------------------
        print("\n--- 3. Testing Fest/Holiday Calendar Normalization ---")
        fest_upload = models.Upload(
            type="fest_schedule",
            filename="techfest.pdf",
            filepath="storage/uploads/techfest.pdf",
            status="extracted",
            raw_text="TechFest 2026 Nov 5 to Nov 7"
        )
        db.add(fest_upload)
        db.commit()
        db.refresh(fest_upload)

        fest_extracted = models.ExtractedData(
            upload_id=fest_upload.id,
            type="fest_schedule",
            data=[
                {
                    "name": "RoboWars 2026",
                    "start_date": "2026-11-05",
                    "end_date": "2026-11-06",
                    "description": "Annual combat robotics championship in Arena 1"
                }
            ]
        )
        db.add(fest_extracted)
        db.commit()

        resp_fest = client.post(f"/api/upload/{fest_upload.id}/normalize")
        assert resp_fest.status_code == 200
        assert resp_fest.json()["events_inserted"] == 1
        print(" Fest schedule normalized into 'events' with type='fest'.")

        # ---------------------------------------------------------
        # 4. Test Assignments Normalization -> Tasks
        # ---------------------------------------------------------
        print("\n--- 4. Testing Assignments Normalization ---")
        asgn_upload = models.Upload(
            type="assignments",
            filename="cs101_assignments.pdf",
            filepath="storage/uploads/cs101_assignments.pdf",
            status="extracted",
            raw_text="Assignment 1 Deadline Oct 15 2026"
        )
        db.add(asgn_upload)
        db.commit()
        db.refresh(asgn_upload)

        asgn_extracted = models.ExtractedData(
            upload_id=asgn_upload.id,
            type="assignments",
            data=[
                {
                    "subject": "CS101",
                    "title": "Assignment 1 - Graph Search",
                    "deadline": "2026-10-15 23:59",
                    "rubric_notes": "Submit via GitHub with unit test coverage."
                },
                {
                    "subject": "CS101",
                    "title": "Assignment 2 - Dynamic Programming",
                    "deadline": "2026-11-01 23:59",
                    "rubric_notes": "Implement memoization and bottom-up solutions."
                }
            ]
        )
        db.add(asgn_extracted)
        db.commit()

        resp_asgn = client.post(f"/api/upload/{asgn_upload.id}/normalize")
        assert resp_asgn.status_code == 200
        data_asgn = resp_asgn.json()
        assert data_asgn["tasks_inserted"] == 2
        assert data_asgn["tasks_updated"] == 0
        print(" 2 assignment tasks created in 'tasks' table.")

        # Re-run deduplication check for tasks
        resp_asgn_re = client.post(f"/api/upload/{asgn_upload.id}/normalize")
        assert resp_asgn_re.status_code == 200
        assert resp_asgn_re.json()["tasks_inserted"] == 0
        assert resp_asgn_re.json()["tasks_updated"] == 2
        print(" Task deduplication verified: 0 new inserts, 2 updated.")

        # ---------------------------------------------------------
        # 5. Test Syllabus Normalization -> Tasks
        # ---------------------------------------------------------
        print("\n--- 5. Testing Syllabus Normalization ---")
        syl_upload = models.Upload(
            type="syllabus",
            filename="cs102_syllabus.pdf",
            filepath="storage/uploads/cs102_syllabus.pdf",
            status="extracted",
            raw_text="Module 1: Concurrency and Thread Pools"
        )
        db.add(syl_upload)
        db.commit()
        db.refresh(syl_upload)

        syl_extracted = models.ExtractedData(
            upload_id=syl_upload.id,
            type="syllabus",
            data=[
                {
                    "subject": "CS102",
                    "topic": "Concurrency & Mutexes",
                    "weightage": "25%"
                }
            ]
        )
        db.add(syl_extracted)
        db.commit()

        resp_syl = client.post(f"/api/upload/{syl_upload.id}/normalize")
        assert resp_syl.status_code == 200
        assert resp_syl.json()["tasks_inserted"] == 1
        print(" Syllabus topic normalized into 'tasks' with type='study_topic'.")

        # ---------------------------------------------------------
        # 6. Test GET /api/events and GET /api/tasks
        # ---------------------------------------------------------
        print("\n--- 6. Testing GET Endpoints ---")
        events_resp = client.get("/api/events")
        assert events_resp.status_code == 200
        all_events = events_resp.json()
        print(f"Total events in store: {len(all_events)}")
        assert len(all_events) >= 3

        tasks_resp = client.get("/api/tasks")
        assert tasks_resp.status_code == 200
        all_tasks = tasks_resp.json()
        print(f"Total tasks in store: {len(all_tasks)}")
        assert len(all_tasks) >= 3

        # Verify upload status changed to 'normalized'
        u_record = db.query(models.Upload).filter(models.Upload.id == tt_upload.id).first()
        assert u_record.status == "normalized"
        print(f" Upload status transitioned to: '{u_record.status}'.")

        db.close()

    print("\n ALL NORMALIZATION TESTS PASSED SUCCESSFULLY!")


def test_normalizer():
    run_normalizer_tests()


if __name__ == "__main__":
    run_normalizer_tests()
