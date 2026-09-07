from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas import (
    CourseResponse,
    CourseCreate,
    CourseSyllabusUpdate,
    ExamPlannerResponse,
)
from services.exam_planner import generate_exam_study_plan
from services.auth_service import get_current_user

router = APIRouter(
    prefix="/api/courses",
    tags=["Courses & Syllabus"]
)

DEFAULT_COURSES = [
    {
        "code": "CS101",
        "name": "Data Structures & Algorithms",
        "credits": 4,
        "syllabus_covered_pct": 82,
        "next_exam": "CAT-1 in 4 days",
        "exam_date": "2026-09-11",
        "color": "#2563EB",
        "semester": "Fall 2026",
    },
    {
        "code": "MATH204",
        "name": "Linear Algebra & Calculus",
        "credits": 4,
        "syllabus_covered_pct": 64,
        "next_exam": "Midterm in 8 days",
        "exam_date": "2026-09-15",
        "color": "#7C3AED",
        "semester": "Fall 2026",
    },
    {
        "code": "PHY102",
        "name": "Engineering Physics & Labs",
        "credits": 3,
        "syllabus_covered_pct": 90,
        "next_exam": "Lab FAT in 14 days",
        "exam_date": "2026-09-21",
        "color": "#059669",
        "semester": "Fall 2026",
    },
]


def seed_default_courses_if_needed(db: Session, user_id: Optional[int] = None):
    query = db.query(models.Course)
    if user_id is not None:
        query = query.filter(models.Course.user_id == user_id)
    count = query.count()
    if count == 0:
        for c in DEFAULT_COURSES:
            course = models.Course(**c, user_id=user_id)
            db.add(course)
        db.commit()


@router.get(
    "",
    response_model=list[CourseResponse],
    summary="List all enrolled semester courses with syllabus progress"
)
def list_courses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    seed_default_courses_if_needed(db, user_id=current_user.id)
    courses = (
        db.query(models.Course)
        .filter(models.Course.user_id == current_user.id)
        .order_by(models.Course.code.asc())
        .all()
    )
    return [CourseResponse.model_validate(c) for c in courses]


@router.post(
    "",
    response_model=CourseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new enrolled course"
)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    existing = (
        db.query(models.Course)
        .filter(models.Course.code == payload.code.upper().strip(), models.Course.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course with code '{payload.code}' already exists."
        )

    course = models.Course(
        user_id=current_user.id,
        code=payload.code.upper().strip(),
        name=payload.name.strip(),
        credits=payload.credits,
        syllabus_covered_pct=min(100, max(0, payload.syllabus_covered_pct)),
        next_exam=payload.next_exam,
        exam_date=payload.exam_date,
        color=payload.color or "#2563EB",
        semester=payload.semester or "Fall 2026",
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return CourseResponse.model_validate(course)


@router.put(
    "/{course_id}/syllabus",
    response_model=CourseResponse,
    summary="Update syllabus covered percentage for a course"
)
def update_syllabus(
    course_id: int,
    payload: CourseSyllabusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found."
        )

    course.syllabus_covered_pct = min(100, max(0, payload.syllabus_covered_pct))
    db.commit()
    db.refresh(course)
    return CourseResponse.model_validate(course)


@router.post(
    "/{course_id}/plan-exam",
    response_model=ExamPlannerResponse,
    summary="Generate AI spaced-repetition study blocks for an enrolled course exam"
)
def plan_course_exam_study(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found."
        )

    # Find or create a matching Task for this course exam
    task = (
        db.query(models.Task)
        .filter(models.Task.subject == course.code, models.Task.user_id == current_user.id)
        .filter(models.Task.type.in_(["exam_work", "study_topic"]))
        .first()
    )

    if not task:
        # Determine deadline from course.exam_date or default to 7 days from now
        deadline = None
        if course.exam_date:
            try:
                deadline = datetime.strptime(course.exam_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                deadline = datetime.now(timezone.utc) + timedelta(days=7)
        else:
            deadline = datetime.now(timezone.utc) + timedelta(days=7)

        task = models.Task(
            user_id=current_user.id,
            title=f"{course.code} Exam Review & Practice",
            type="exam_work",
            subject=course.code,
            deadline=deadline,
            weightage=f"{course.credits * 10}%",
            description=f"Comprehensive exam preparation and spaced repetition review for {course.name}.",
            priority_score=85,
            status="pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)

    # Invoke the Spaced Repetition Exam Planner
    try:
        results = generate_exam_study_plan(task_id=task.id, db=db)
        return ExamPlannerResponse(**results)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate study plan: {str(exc)}"
        )


@router.delete(
    "/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a course"
)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.user_id == current_user.id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found."
        )
    db.delete(course)
    db.commit()
    return None
