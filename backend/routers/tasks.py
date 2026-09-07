from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas import (
    FrontendTaskDetail,
    FrontendSlotDetail,
    PriorityRecalculationResponse
)
from services.priority import recalculate_all_priorities
from services.auth_service import get_current_user

router = APIRouter(tags=["Tasks"])


def score_to_urgency(score: Optional[int]) -> str:
    """Maps numeric priority score to frontend urgency bucket."""
    if score is None:
        return "medium"
    if score >= 75:
        return "high"
    elif score >= 40:
        return "medium"
    return "low"


def format_scheduled_slot_string(slot: models.ScheduledSlot) -> str:
    """Formats slot into 'YYYY-MM-DD HH:MM - HH:MM' for frontend calendar/table."""
    return f"{slot.scheduled_date} {slot.start_time} - {slot.end_time}"


def serialize_task_with_slots(task: models.Task, slots: list[models.ScheduledSlot]) -> FrontendTaskDetail:
    """Shapes a Task and its linked ScheduledSlots into the FrontendTaskDetail schema."""
    primary_slot_str = None
    slot_details = []

    for s in slots:
        slot_str = format_scheduled_slot_string(s)
        if primary_slot_str is None and s.status == "active":
            primary_slot_str = slot_str

        slot_details.append(
            FrontendSlotDetail(
                id=s.id,
                task_id=s.task_id,
                task_title=task.title,
                task=task.title,
                subject=task.subject,
                category=task.subject,
                scheduled_date=s.scheduled_date,
                start_time=s.start_time,
                end_time=s.end_time,
                scheduledSlot=slot_str,
                status=s.status,
                slot_type=s.slot_type or "regular",
                priority_score=task.priority_score,
                urgency=score_to_urgency(task.priority_score),
                created_at=s.created_at
            )
        )

    return FrontendTaskDetail(
        id=task.id,
        task=task.title,
        title=task.title,
        type=task.type,
        category=task.subject or "General",
        subject=task.subject or "General",
        deadline=task.deadline.isoformat() if task.deadline else None,
        weightage=task.weightage,
        description=task.description,
        priority_score=task.priority_score if task.priority_score is not None else 50,
        urgency=score_to_urgency(task.priority_score), # Frontend urgency
        status=task.status,
        completed=(task.status == "completed"),        # Frontend completed flag
        scheduledSlot=primary_slot_str,                # Primary slot string
        scheduled_slots=slot_details,
        created_at=task.created_at
    )


@router.get(
    "",
    response_model=list[FrontendTaskDetail],
    summary="List tasks with priority scores, status, and linked scheduled slots"
)
def get_tasks(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (pending, scheduled, completed)"),
    type_filter: Optional[str] = Query(None, alias="type", description="Filter by task type (assignment, study_topic, exam_work)"),
    category: Optional[str] = Query(None, description="Filter by course subject / category"),
    urgency: Optional[str] = Query(None, description="Filter by urgency bucket ('low', 'medium', 'high')"),
    search: Optional[str] = Query(None, description="Search keyword in title or description"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns tasks for the authenticated user with priority_score, status, and linked scheduled_slots.
    Supports filtering by category, status, urgency, and search keywords.
    """
    query = db.query(models.Task).filter(models.Task.user_id == current_user.id)

    if status_filter and status_filter.lower() != "all":
        query = query.filter(models.Task.status == status_filter)

    if type_filter and type_filter.lower() != "all":
        query = query.filter(models.Task.type == type_filter)

    if category and category.lower() != "all":
        query = query.filter(models.Task.subject.ilike(f"%{category.strip()}%"))

    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Task.title.ilike(s_term),
                models.Task.description.ilike(s_term),
                models.Task.subject.ilike(s_term)
            )
        )

    tasks = query.order_by(
        models.Task.priority_score.desc().nullslast(),
        models.Task.deadline.asc().nullslast()
    ).all()

    # Pre-fetch all scheduled slots for these tasks to avoid N+1 queries
    task_ids = [t.id for t in tasks]
    slots = (
        db.query(models.ScheduledSlot)
        .filter(models.ScheduledSlot.task_id.in_(task_ids))
        .order_by(models.ScheduledSlot.scheduled_date.asc(), models.ScheduledSlot.start_time.asc())
        .all()
    ) if task_ids else []

    slots_by_task: dict[int, list[models.ScheduledSlot]] = {}
    for s in slots:
        slots_by_task.setdefault(s.task_id, []).append(s)

    results = []
    for t in tasks:
        t_slots = slots_by_task.get(t.id, [])
        detail = serialize_task_with_slots(t, t_slots)

        # Apply urgency filter if specified
        if urgency and urgency.lower() != "all" and detail.urgency != urgency.lower():
            continue

        results.append(detail)

    return results


@router.get(
    "/{task_id}",
    response_model=FrontendTaskDetail,
    summary="Get a single task by ID with its linked scheduled slots"
)
def get_task_by_id(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve a single task by ID with linked slots for the authenticated user."""
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found."
        )

    slots = (
        db.query(models.ScheduledSlot)
        .filter(models.ScheduledSlot.task_id == task.id)
        .order_by(models.ScheduledSlot.scheduled_date.asc(), models.ScheduledSlot.start_time.asc())
        .all()
    )

    return serialize_task_with_slots(task, slots)


@router.post(
    "/recalculate-priority",
    response_model=PriorityRecalculationResponse,
    summary="Batch recalculate urgency scores for all active tasks of current user"
)
def recalculate_priorities_endpoint(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Computes urgency_score for each active task of current user."""
    try:
        results = recalculate_all_priorities(db=db, user_id=current_user.id)
        return PriorityRecalculationResponse(**results)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate task priorities: {str(exc)}"
        )


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Task title")
    subject: Optional[str] = Field("General", description="Subject or course code (e.g. CS101, MATH204)")
    category: Optional[str] = Field(None, description="Category alias for subject")
    type: Optional[str] = Field("assignment", description="Task type (assignment, study_topic, exam_work)")
    deadline: Optional[datetime] = Field(None, description="Task deadline in ISO format")
    urgency: Optional[str] = Field("medium", description="Urgency level ('high', 'medium', 'low')")
    priority_score: Optional[int] = Field(None, description="Custom priority score 0-100")
    weightage: Optional[str] = Field(None, description="Syllabus grade weightage (e.g. '15%')")
    description: Optional[str] = Field(None, description="Detailed task description")


@router.post(
    "",
    response_model=FrontendTaskDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task with priority scoring"
)
def create_task(
    payload: TaskCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subj = payload.subject or payload.category or "General"
    
    # Derive priority score if not explicitly set
    score = payload.priority_score
    if score is None:
        if payload.urgency == "high":
            score = 85
        elif payload.urgency == "low":
            score = 30
        else:
            score = 60
            
    new_task = models.Task(
        user_id=current_user.id,
        title=payload.title.strip(),
        subject=subj.strip(),
        type=payload.type or "assignment",
        deadline=payload.deadline,
        priority_score=score,
        weightage=payload.weightage,
        description=payload.description,
        status="pending"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    return serialize_task_with_slots(new_task, [])


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    deadline: Optional[datetime] = None
    urgency: Optional[str] = None
    priority_score: Optional[int] = None
    weightage: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    completed: Optional[bool] = None


@router.patch(
    "/{task_id}",
    response_model=FrontendTaskDetail,
    summary="Update a task's details or completion status"
)
def update_task(
    task_id: int,
    payload: TaskUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found."
        )

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.subject is not None:
        task.subject = payload.subject.strip()
    elif payload.category is not None:
        task.subject = payload.category.strip()
    if payload.type is not None:
        task.type = payload.type
    if payload.deadline is not None:
        task.deadline = payload.deadline
    if payload.weightage is not None:
        task.weightage = payload.weightage
    if payload.description is not None:
        task.description = payload.description

    # Handle completion status
    if payload.completed is not None:
        task.status = "completed" if payload.completed else "pending"
    elif payload.status is not None:
        task.status = payload.status

    # Priority score or urgency
    if payload.priority_score is not None:
        task.priority_score = payload.priority_score
    elif payload.urgency is not None:
        if payload.urgency == "high":
            task.priority_score = 85
        elif payload.urgency == "low":
            task.priority_score = 30
        else:
            task.priority_score = 60

    db.commit()
    db.refresh(task)

    slots = (
        db.query(models.ScheduledSlot)
        .filter(models.ScheduledSlot.task_id == task.id)
        .all()
    )
    return serialize_task_with_slots(task, slots)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task and its linked slots"
)
def delete_task(
    task_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id,
        models.Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found."
        )

    # Delete linked scheduled slots
    db.query(models.ScheduledSlot).filter(models.ScheduledSlot.task_id == task.id).delete()
    db.delete(task)
    db.commit()
    return None
