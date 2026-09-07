"""
Seed realistic demo data into LifeSync database for rich UI presentation.
Includes:
- Academic tasks with various priorities and deadlines
- Events (lectures, club hack night, fest, holidays)
- Scheduled slots for the current week (Sep 7 - Sep 13, 2026)
"""

from datetime import datetime, timezone, timedelta
from database import SessionLocal, engine
import models

def seed():
    db = SessionLocal()
    try:
        # Check if tasks already exist
        existing = db.query(models.Task).count()
        if existing > 0:
            print(f"Database already has {existing} tasks. Resetting to ensure fresh state...")
            db.query(models.ConflictLog).delete()
            db.query(models.ScheduledSlot).delete()
            db.query(models.Task).delete()
            db.query(models.Event).delete()
            db.commit()

        # Base date: Monday, September 7, 2026
        base_date = datetime(2026, 9, 7, tzinfo=timezone.utc)

        # 1. Events
        events = [
            models.Event(
                title="CS101 Morning Lecture: Graph Algorithms",
                type="class_session",
                start_datetime=base_date.replace(hour=9, minute=0),
                end_datetime=base_date.replace(hour=10, minute=30),
                subject="CS101",
                location="Hall B, Science Block",
                status="scheduled"
            ),
            models.Event(
                title="Math 204 Linear Algebra Recitation",
                type="class_session",
                start_datetime=base_date.replace(day=8, hour=11, minute=0),
                end_datetime=base_date.replace(day=8, hour=12, minute=30),
                subject="MATH204",
                location="Room 302",
                status="scheduled"
            ),
            models.Event(
                title="Robotics Club Hack Night",
                type="club_event",
                start_datetime=base_date.replace(day=9, hour=18, minute=0),
                end_datetime=base_date.replace(day=9, hour=21, minute=30),
                subject="ROBOTICS",
                location="Maker Lab 2",
                status="scheduled"
            ),
            models.Event(
                title="Campus Autumn Cultural Fest",
                type="fest",
                start_datetime=base_date.replace(day=12, hour=10, minute=0),
                end_datetime=base_date.replace(day=12, hour=22, minute=0),
                subject="CAMPUS",
                location="Main Amphitheater",
                status="scheduled"
            ),
            models.Event(
                title="University Founder's Day Holiday",
                type="holiday",
                start_datetime=base_date.replace(day=15, hour=0, minute=0),
                end_datetime=base_date.replace(day=15, hour=23, minute=59),
                subject="CAMPUS",
                status="scheduled"
            )
        ]
        db.add_all(events)
        db.commit()

        # 2. Tasks
        t1 = models.Task(
            title="CS101 Term Paper Draft - Literature Review",
            type="assignment",
            deadline=base_date.replace(hour=17, minute=0),
            subject="CS101",
            weightage="35%",
            priority_score=94,  # High urgency (due today!)
            status="pending",
            description="Complete methodologies and background comparison of tree structures."
        )
        t2 = models.Task(
            title="Math 204 Midterm Prep & Practice Exam",
            type="study_topic",
            deadline=base_date.replace(day=8, hour=10, minute=0),
            subject="MATH204",
            weightage="25%",
            priority_score=86,  # High urgency
            status="pending",
            description="Review eigenvalues, eigenvectors, and diagonalization theorems."
        )
        t3 = models.Task(
            title="Data Structures Lab Assignment 3 (BST Balance)",
            type="assignment",
            deadline=base_date.replace(day=9, hour=23, minute=59),
            subject="CS101",
            weightage="15%",
            priority_score=78,  # High urgency
            status="scheduled",
            description="Implement AVL tree self-balancing rotations in C++."
        )
        t4 = models.Task(
            title="Product Strategy Sync & Design Audit",
            type="study_topic",
            deadline=base_date.replace(day=8, hour=14, minute=30),
            subject="PRODUCT",
            weightage="10%",
            priority_score=65,  # Medium urgency
            status="pending",
            description="Review UI components and prototype flows with team."
        )
        t5 = models.Task(
            title="Operating Systems Memory Management Notes",
            type="study_topic",
            deadline=base_date.replace(day=11, hour=18, minute=0),
            subject="CS202",
            weightage="15%",
            priority_score=52,  # Medium urgency
            status="pending",
            description="Synthesize virtual memory, page tables, and LRU eviction policy."
        )
        t6 = models.Task(
            title="Ethics in AI Reading Summary (Chapter 4)",
            type="assignment",
            deadline=base_date.replace(day=13, hour=23, minute=59),
            subject="HU101",
            weightage="5%",
            priority_score=35,  # Low urgency
            status="completed",
            description="Summarize Chapter 4 case studies on algorithmic fairness."
        )
        t7 = models.Task(
            title="Robotics Hackathon Hardware Checklist",
            type="exam_work",
            deadline=base_date.replace(day=9, hour=17, minute=0),
            subject="ROBOTICS",
            weightage="10%",
            priority_score=28,  # Low urgency
            status="completed",
            description="Verify sensor kits, battery packs, and Arduino board serial lines."
        )

        tasks = [t1, t2, t3, t4, t5, t6, t7]
        db.add_all(tasks)
        db.commit()

        # 3. Scheduled Slots for the current week
        slots = [
            models.ScheduledSlot(
                task_id=t1.id,
                scheduled_date="2026-09-07",
                start_time="10:45",
                end_time="12:30",
                status="active",
                slot_type="study_session"
            ),
            models.ScheduledSlot(
                task_id=t2.id,
                scheduled_date="2026-09-08",
                start_time="13:30",
                end_time="15:30",
                status="active",
                slot_type="study_session"
            ),
            models.ScheduledSlot(
                task_id=t3.id,
                scheduled_date="2026-09-09",
                start_time="14:00",
                end_time="16:00",
                status="active",
                slot_type="regular"
            ),
            models.ScheduledSlot(
                task_id=t4.id,
                scheduled_date="2026-09-08",
                start_time="14:30",
                end_time="15:30",
                status="active",
                slot_type="regular"
            ),
            models.ScheduledSlot(
                task_id=t5.id,
                scheduled_date="2026-09-10",
                start_time="15:00",
                end_time="17:00",
                status="active",
                slot_type="study_session"
            )
        ]
        db.add_all(slots)
        db.commit()

        print(f"Successfully seeded {len(tasks)} tasks, {len(events)} events, and {len(slots)} scheduled slots!")
    except Exception as e:
        db.rollback()
        print("Error seeding data:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed()
