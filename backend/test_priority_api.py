import io
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.priority import (
    compute_deadline_proximity,
    resolve_task_weightage,
    calculate_task_priority,
    recalculate_all_priorities
)


def run_priority_tests():
    print("=== Running Priority Calculator Service & API Tests ===")

    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # 1. Test Deadline Proximity Scaling (Inverse of days remaining)
    # -------------------------------------------------------------
    print("\n--- 1. Testing Deadline Proximity Scaling ---")
    prox_overdue = compute_deadline_proximity(now - timedelta(days=2), now)
    prox_due_soon = compute_deadline_proximity(now + timedelta(hours=6), now)
    prox_1_day = compute_deadline_proximity(now + timedelta(days=1), now)
    prox_3_days = compute_deadline_proximity(now + timedelta(days=3), now)
    prox_14_days = compute_deadline_proximity(now + timedelta(days=14), now)
    prox_no_deadline = compute_deadline_proximity(None, now)

    print(f"Overdue proximity: {prox_overdue:.1f}")
    print(f"6 hours proximity: {prox_due_soon:.1f}")
    print(f"1 day proximity: {prox_1_day:.1f}")
    print(f"3 days proximity: {prox_3_days:.1f}")
    print(f"14 days proximity: {prox_14_days:.1f}")
    print(f"No deadline proximity: {prox_no_deadline:.1f}")

    assert prox_overdue == 100.0, "Overdue tasks should have maximum proximity (100.0)"
    assert prox_due_soon > prox_1_day > prox_3_days > prox_14_days, (
        "Proximity must strictly increase as deadline approaches"
    )
    assert 1.0 <= prox_no_deadline <= 50.0
    print(" Deadline proximity strictly scales up as deadline approaches (inverse curve verified).")

    # -------------------------------------------------------------
    # 2. Test Weightage Resolution from Syllabus Data
    # -------------------------------------------------------------
    print("\n--- 2. Testing Syllabus Weightage Resolution ---")
    db = SessionLocal()
    try:
        # Clear existing tasks/uploads for clean test
        db.query(models.Task).delete()
        db.query(models.Upload).delete()
        db.commit()

        # Insert a syllabus upload and study_topic task with weightage
        syl_upload = models.Upload(
            type="syllabus",
            filename="math101_syllabus.pdf",
            filepath="storage/uploads/math101_syllabus.pdf",
            status="normalized",
            raw_text="Linear Algebra 30% weightage"
        )
        db.add(syl_upload)
        db.commit()
        db.refresh(syl_upload)

        syllabus_topic = models.Task(
            source_upload_id=syl_upload.id,
            title="Study: Linear Algebra",
            type="study_topic",
            subject="MATH101",
            weightage="30%",
            status="pending"
        )
        db.add(syllabus_topic)
        db.commit()

        # Assignment task for same subject with no explicit weightage
        unweighted_task = models.Task(
            title="Homework 1: Matrix Inverses",
            type="assignment",
            subject="MATH101",
            deadline=now + timedelta(days=2),
            weightage=None,
            status="pending"
        )
        db.add(unweighted_task)
        db.commit()
        db.refresh(unweighted_task)

        resolved_w = resolve_task_weightage(unweighted_task, db)
        print(f"Resolved weightage for unweighted MATH101 task: {resolved_w}%")
        assert resolved_w == 30.0, f"Expected 30.0% from linked MATH101 syllabus, got {resolved_w}"
        print(" Syllabus weightage linkage by subject verified successfully.")

        # -------------------------------------------------------------
        # 3. Test Priority Score Computation & Range
        # -------------------------------------------------------------
        print("\n--- 3. Testing Priority Calculation Formula ---")
        urgent_task = models.Task(
            title="Final Project",
            type="exam_work",
            subject="MATH101",
            deadline=now + timedelta(hours=12),
            weightage="40%",
            status="pending"
        )
        db.add(urgent_task)
        db.commit()
        db.refresh(urgent_task)

        urgent_score = calculate_task_priority(urgent_task, db, now)
        regular_score = calculate_task_priority(unweighted_task, db, now)
        print(f"Urgent Task Score: {urgent_score} | Regular Task Score: {regular_score}")
        assert 1 <= urgent_score <= 100
        assert 1 <= regular_score <= 100
        assert urgent_score > regular_score, "Urgent task must have higher priority score"
        print(" Priority score formula f(proximity, weightage) verified within [1, 100].")

        # -------------------------------------------------------------
        # 4. Test Recalculate All Priorities
        # -------------------------------------------------------------
        print("\n--- 4. Testing In-Place DB Recomputation ---")
        recalc_result = recalculate_all_priorities(db, now)
        print(f"Tasks updated: {recalc_result['tasks_updated']}")
        assert recalc_result["tasks_updated"] >= 3
        assert recalc_result["highest_priority_task"]["task_id"] == urgent_task.id

        # Verify in DB
        db.refresh(urgent_task)
        db.refresh(unweighted_task)
        assert urgent_task.priority_score == urgent_score
        print(f" DB record updated: urgent_task.priority_score = {urgent_task.priority_score}")
    finally:
        db.close()

    # -------------------------------------------------------------
    # 5. Test POST /api/tasks/recalculate-priority Endpoint
    # -------------------------------------------------------------
    print("\n--- 5. Testing POST /api/tasks/recalculate-priority ---")
    with TestClient(app) as client:
        resp = client.post("/api/tasks/recalculate-priority")
        assert resp.status_code == 200
        data = resp.json()
        print(f"Endpoint response: {data['message']}")
        print(f"Total tasks updated via API: {data['tasks_updated']}")
        assert data["tasks_updated"] >= 3
        assert len(data["tasks"]) >= 3
        print(" Top task via API:", data["highest_priority_task"]["title"], "Score:", data["highest_priority_task"]["priority_score"])
        assert data["highest_priority_task"]["priority_score"] >= 80

    print("\n ALL PRIORITY CALCULATOR TESTS COMPLETED SUCCESSFULLY!")


if __name__ == "__main__":
    run_priority_tests()
