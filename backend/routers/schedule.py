import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas import (
    FrontendSlotDetail,
    ScheduleGenerationResponse,
    ConflictResolutionResult,
    ConflictLogResponse
)
from services.scheduler import generate_ai_schedule
from services.conflict_resolver import resolve_schedule_conflicts

router = APIRouter(tags=["Schedule"])

DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def score_to_urgency(score: Optional[int]) -> str:
    """Maps priority_score (1-100) to urgency bucket ('low', 'medium', 'high')."""
    if score is None:
        return "medium"
    if score >= 75:
        return "high"
    elif score >= 40:
        return "medium"
    return "low"


def format_scheduled_slot_string(date_str: str, start_t: str, end_t: str) -> str:
    """Shapes slot into frontend mock format: 'YYYY-MM-DD HH:MM - HH:MM'."""
    return f"{date_str} {start_t} - {end_t}"


@router.get(
    "",
    response_model=list[FrontendSlotDetail],
    summary="List scheduled slots joined with task metadata, filterable by date range"
)
def get_schedule(
    from_date: Optional[str] = Query(
        None,
        alias="from",
        description="Filter slots starting from date (format: YYYY-MM-DD)"
    ),
    to_date: Optional[str] = Query(
        None,
        alias="to",
        description="Filter slots up to date (format: YYYY-MM-DD)"
    ),
    status_filter: Optional[str] = Query(
        "active",
        alias="status",
        description="Filter by slot status (e.g. 'active', 'all')"
    ),
    slot_type: Optional[str] = Query(
        None,
        description="Filter by slot_type ('regular' or 'study_session')"
    ),
    db: Session = Depends(get_db)
):
    """
    Returns scheduled slots joined with parent task details.
    Supports frontend ?from=YYYY-MM-DD&to=YYYY-MM-DD date range filtering.
    """
    # 1. Validate date formats
    if from_date:
        if not DATE_REGEX.match(from_date.strip()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid 'from' date format: '{from_date}'. Must be YYYY-MM-DD."
            )
        try:
            datetime.strptime(from_date.strip(), "%Y-%m-%d")
        except ValueError as v_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid 'from' calendar date: {str(v_err)}"
            )

    if to_date:
        if not DATE_REGEX.match(to_date.strip()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid 'to' date format: '{to_date}'. Must be YYYY-MM-DD."
            )
        try:
            datetime.strptime(to_date.strip(), "%Y-%m-%d")
        except ValueError as v_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid 'to' calendar date: {str(v_err)}"
            )

    if from_date and to_date and from_date.strip() > to_date.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'from' date ({from_date}) cannot be after 'to' date ({to_date})."
        )

    # 2. Query scheduled slots joined with task
    query = (
        db.query(models.ScheduledSlot, models.Task)
        .outerjoin(models.Task, models.ScheduledSlot.task_id == models.Task.id)
    )

    if status_filter and status_filter.lower() != "all":
        query = query.filter(models.ScheduledSlot.status == status_filter)

    if slot_type:
        query = query.filter(models.ScheduledSlot.slot_type == slot_type)

    if from_date:
        query = query.filter(models.ScheduledSlot.scheduled_date >= from_date.strip())

    if to_date:
        query = query.filter(models.ScheduledSlot.scheduled_date <= to_date.strip())

    rows = query.order_by(
        models.ScheduledSlot.scheduled_date.asc(),
        models.ScheduledSlot.start_time.asc()
    ).all()

    # 3. Look up events to optionally link event details
    event_lookup = {}
    if rows:
        dates = {slot.scheduled_date for slot, _ in rows}
        all_events = db.query(models.Event).all()
        for ev in all_events:
            if ev.start_datetime:
                d_str = ev.start_datetime.strftime("%Y-%m-%d")
                if d_str in dates:
                    if ev.subject:
                        event_lookup[(d_str, ev.subject.upper().strip())] = ev
                    if d_str not in event_lookup:
                        event_lookup[d_str] = ev

    results = []
    for slot, task in rows:
        task_title = task.title if task else None
        subject = task.subject if task else None
        p_score = task.priority_score if task else 50
        deadline = task.deadline if task else None
        urgency = score_to_urgency(p_score)

        # Match event if available
        matched_event = None
        if task and task.subject:
            matched_event = event_lookup.get((slot.scheduled_date, task.subject.upper().strip()))
        if not matched_event:
            matched_event = event_lookup.get(slot.scheduled_date)

        event_id = matched_event.id if matched_event else None
        event_title = matched_event.title if matched_event else None

        results.append(
            FrontendSlotDetail(
                id=slot.id,
                task_id=slot.task_id,
                task_title=task_title,
                task=task_title,                   # Frontend alias
                subject=subject,
                category=subject,                  # Frontend alias
                scheduled_date=slot.scheduled_date,
                start_time=slot.start_time,
                end_time=slot.end_time,
                scheduledSlot=format_scheduled_slot_string(
                    slot.scheduled_date,
                    slot.start_time,
                    slot.end_time
                ),
                status=slot.status,
                slot_type=slot.slot_type or "regular",
                priority_score=p_score,
                urgency=urgency,
                deadline=deadline,
                event_id=event_id,
                event_title=event_title,
                created_at=slot.created_at
            )
        )

    return results


@router.get(
    "/conflicts",
    response_model=list[ConflictLogResponse],
    summary="List all logged scheduling conflict resolutions"
)
def list_conflict_logs(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Retrieve audit records from the conflict_log table."""
    records = (
        db.query(models.ConflictLog)
        .order_by(models.ConflictLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return records


@router.get(
    "/{slot_id}",
    response_model=FrontendSlotDetail,
    summary="Get a single scheduled slot by ID"
)
def get_slot_by_id(slot_id: int, db: Session = Depends(get_db)):
    """Retrieve a single scheduled slot with joined task details."""
    row = (
        db.query(models.ScheduledSlot, models.Task)
        .outerjoin(models.Task, models.ScheduledSlot.task_id == models.Task.id)
        .filter(models.ScheduledSlot.id == slot_id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduled slot with id {slot_id} not found."
        )

    slot, task = row
    task_title = task.title if task else None
    subject = task.subject if task else None
    p_score = task.priority_score if task else 50
    deadline = task.deadline if task else None

    matched_ev = None
    if task and task.subject:
        matched_ev = (
            db.query(models.Event)
            .filter(models.Event.subject.ilike(f"%{task.subject.strip()}%"))
            .first()
        )
    event_id = matched_ev.id if matched_ev else None
    event_title = matched_ev.title if matched_ev else None

    return FrontendSlotDetail(
        id=slot.id,
        task_id=slot.task_id,
        task_title=task_title,
        task=task_title,
        subject=subject,
        category=subject,
        scheduled_date=slot.scheduled_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        scheduledSlot=format_scheduled_slot_string(
            slot.scheduled_date,
            slot.start_time,
            slot.end_time
        ),
        status=slot.status,
        slot_type=slot.slot_type or "regular",
        priority_score=p_score,
        urgency=score_to_urgency(p_score),
        deadline=deadline,
        event_id=event_id,
        event_title=event_title,
        created_at=slot.created_at
    )


@router.post(
    "/generate",
    response_model=ScheduleGenerationResponse,
    summary="Generate schedule fitting pending tasks into free slots"
)
def generate_schedule(
    days_ahead: int = 7,
    db: Session = Depends(get_db)
):
    """Triggers the AI scheduling engine and conflict resolver for pending tasks."""
    try:
        result = generate_ai_schedule(db=db, days_ahead=days_ahead)
        return ScheduleGenerationResponse(**result)
    except RuntimeError as r_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(r_err)
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scheduling engine failed: {str(exc)}"
        )


@router.post(
    "/resolve-conflicts",
    response_model=ConflictResolutionResult,
    summary="Check active scheduled slots against blocking events"
)
def resolve_conflicts_endpoint(
    days_ahead: int = 7,
    db: Session = Depends(get_db)
):
    """Scans all active scheduled slots for collisions against fests, holidays, and club events."""
    try:
        results = resolve_schedule_conflicts(db=db, days_ahead=days_ahead)
        return ConflictResolutionResult(**results)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Conflict resolution failed: {str(exc)}"
        )
