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

def seed(user_id=None):
    db = SessionLocal()
    try:
        # Check if tasks already exist for this user (or globally if user_id is None)
        task_query = db.query(models.Task)
        if user_id is not None:
            task_query = task_query.filter(models.Task.user_id == user_id)
        
        existing = task_query.count()
        if existing > 0:
            print(f"Database already has {existing} tasks for user_id={user_id}. Skipping duplicate seed.")
            return

        # Base date: Monday, September 7, 2026
        base_date = datetime(2026, 9, 7, tzinfo=timezone.utc)

        # 1. Events
        events = [
            models.Event(
                user_id=user_id,
                title="CS101 Morning Lecture: Graph Algorithms",
                type="class_session",
                start_datetime=base_date.replace(hour=9, minute=0),
                end_datetime=base_date.replace(hour=10, minute=30),
                subject="CS101",
                location="Hall B, Science Block",
                status="scheduled"
            ),
            models.Event(
                user_id=user_id,
                title="Math 204 Linear Algebra Recitation",
                type="class_session",
                start_datetime=base_date.replace(day=8, hour=11, minute=0),
                end_datetime=base_date.replace(day=8, hour=12, minute=30),
                subject="MATH204",
                location="Room 302",
                status="scheduled"
            ),
            models.Event(
                user_id=user_id,
                title="Robotics Club Hack Night",
                type="club_event",
                start_datetime=base_date.replace(day=9, hour=18, minute=0),
                end_datetime=base_date.replace(day=9, hour=21, minute=30),
                subject="ROBOTICS",
                location="Maker Lab 2",
                status="scheduled"
            ),
            models.Event(
                user_id=user_id,
                title="Campus Autumn Cultural Fest",
                type="fest",
                start_datetime=base_date.replace(day=12, hour=10, minute=0),
                end_datetime=base_date.replace(day=12, hour=22, minute=0),
                subject="CAMPUS",
                location="Main Amphitheater",
                status="scheduled"
            ),
            models.Event(
                user_id=user_id,
                title="University Founder's Day Holiday",
                type="holiday",
                start_datetime=base_date.replace(day=15, hour=0, minute=0),
                end_datetime=base_date.replace(day=15, hour=23, minute=59),
                subject="HOLIDAY",
                location="Campus-wide",
                status="scheduled"
            )
        ]
        db.add_all(events)
        db.commit()

        # 2. Academic Tasks
        t1 = models.Task(
            user_id=user_id,
            title="CS101 Problem Set 3: Shortest Path & Dijkstra",
            type="assignment",
            deadline=base_date.replace(day=8, hour=23, minute=59),
            subject="CS101",
            weightage="15%",
            priority_score=92,
            status="pending",
            description="Implement Dijkstra algorithm in Python with adjacency list representation."
        )
        t2 = models.Task(
            user_id=user_id,
            title="Math 204 Midterm Exam Revision: Vector Spaces",
            type="exam_work",
            deadline=base_date.replace(day=10, hour=14, minute=0),
            subject="MATH204",
            weightage="30%",
            priority_score=88,
            status="pending",
            description="Spaced repetition review covering eigenvalues, eigenvectors, and diagonalization."
        )
        t3 = models.Task(
            user_id=user_id,
            title="Physics 102 Lab Report: Wave Interference",
            type="assignment",
            deadline=base_date.replace(day=11, hour=17, minute=0),
            subject="PHYS102",
            weightage="10%",
            priority_score=68,
            status="pending",
            description="Analyze laser diffraction grating data and calculate optical wavelength error margins."
        )
        t4 = models.Task(
            user_id=user_id,
            title="Database Systems Group Project Milestone 1",
            type="study_topic",
            deadline=base_date.replace(day=13, hour=23, minute=59),
            subject="CS204",
            weightage="20%",
            priority_score=72,
            status="pending",
            description="Draft entity relationship (ER) schema diagram and initial PostgreSQL DDL scripts."
        )
        t5 = models.Task(
            user_id=user_id,
            title="Technical Writing Paper: AI Ethics Literature Review",
            type="assignment",
            deadline=base_date.replace(day=14, hour=18, minute=0),
            subject="ENG201",
            weightage="15%",
            priority_score=55,
            status="pending",
            description="Review 5 recent IEEE publications on autonomous system algorithmic bias."
        )
        t6 = models.Task(
            user_id=user_id,
            title="Discrete Structures: Review Recurrence Relations",
            type="study_topic",
            deadline=base_date.replace(day=16, hour=12, minute=0),
            subject="MATH201",
            weightage="10%",
            priority_score=45,
            status="pending",
            description="Practice Master Theorem and generating functions for divide-and-conquer runtime proofs."
        )
        t7 = models.Task(
            user_id=user_id,
            title="Cybersecurity Fundamentals: Set up Wireshark Lab",
            type="study_topic",
            deadline=base_date.replace(day=18, hour=20, minute=0),
            subject="CS305",
            weightage="10%",
            priority_score=38,
            status="pending",
            description="Install Wireshark in Kali Linux VM and capture three-way TCP handshake packets."
        )

        tasks = [t1, t2, t3, t4, t5, t6, t7]
        db.add_all(tasks)
        db.commit()

        # 3. Scheduled Slots for the current week
        slots = [
            models.ScheduledSlot(
                user_id=user_id,
                task_id=t1.id,
                scheduled_date="2026-09-07",
                start_time="10:45",
                end_time="12:30",
                status="active",
                slot_type="study_session"
            ),
            models.ScheduledSlot(
                user_id=user_id,
                task_id=t2.id,
                scheduled_date="2026-09-08",
                start_time="13:30",
                end_time="15:30",
                status="active",
                slot_type="study_session"
            ),
            models.ScheduledSlot(
                user_id=user_id,
                task_id=t3.id,
                scheduled_date="2026-09-09",
                start_time="14:00",
                end_time="16:00",
                status="active",
                slot_type="regular"
            ),
            models.ScheduledSlot(
                user_id=user_id,
                task_id=t4.id,
                scheduled_date="2026-09-08",
                start_time="14:30",
                end_time="15:30",
                status="active",
                slot_type="regular"
            ),
            models.ScheduledSlot(
                user_id=user_id,
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

        print(f"Successfully seeded {len(tasks)} tasks, {len(events)} events, and {len(slots)} scheduled slots for user_id={user_id}!")
    except Exception as e:
        db.rollback()
        print("Error seeding data:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed()
