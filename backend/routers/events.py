import re
from datetime import datetime, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas import FrontendEventDetail
from services.auth_service import get_current_user

router = APIRouter(tags=["Events"])

DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@router.get(
    "",
    response_model=list[FrontendEventDetail],
    summary="List all events (classes, fests, holidays, club events), optionally filtered by type"
)
def get_events(
    type_filter: Optional[str] = Query(
        None,
        alias="type",
        description="Filter by event type (class_session, fest, holiday, club_event)"
    ),
    subject: Optional[str] = Query(
        None,
        description="Filter by subject code (e.g. CS101)"
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by category (alias of subject)"
    ),
    from_date: Optional[str] = Query(
        None,
        alias="from",
        description="Filter events starting from date (format: YYYY-MM-DD)"
    ),
    to_date: Optional[str] = Query(
        None,
        alias="to",
        description="Filter events up to date (format: YYYY-MM-DD)"
    ),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns calendar events for the authenticated user.
    Supports filtering by type, subject/category, and date ranges.
    """
    # 1. Validate date filters
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

    # 2. Build query scoped to current user or campus-wide events
    query = db.query(models.Event).filter(
        (models.Event.user_id == current_user.id) | (models.Event.user_id == None)
    )

    if type_filter and type_filter.lower() != "all":
        # Handle 'class' vs 'class_session'
        if type_filter == "class":
            query = query.filter(models.Event.type.in_(["class", "class_session"]))
        else:
            query = query.filter(models.Event.type == type_filter)

    subj_val = subject or category
    if subj_val and subj_val.lower() != "all":
        query = query.filter(models.Event.subject.ilike(f"%{subj_val.strip()}%"))

    if from_date:
        f_dt = datetime.combine(datetime.strptime(from_date.strip(), "%Y-%m-%d").date(), time(0, 0))
        query = query.filter(models.Event.start_datetime >= f_dt)

    if to_date:
        t_dt = datetime.combine(datetime.strptime(to_date.strip(), "%Y-%m-%d").date(), time(23, 59, 59))
        query = query.filter(models.Event.start_datetime <= t_dt)

    events = query.order_by(models.Event.start_datetime.asc()).all()

    results = []
    for ev in events:
        results.append(
            FrontendEventDetail(
                id=ev.id,
                source_upload_id=ev.source_upload_id,
                title=ev.title,
                name=ev.title,                        # Frontend alias
                type=ev.type,
                start_datetime=ev.start_datetime,
                end_datetime=ev.end_datetime,
                subject=ev.subject,
                category=ev.subject or "Campus",      # Frontend alias
                location=ev.location,
                weightage=ev.weightage,
                description=ev.description,
                status=ev.status,
                created_at=ev.created_at
            )
        )

    return results


@router.get(
    "/{event_id}",
    response_model=FrontendEventDetail,
    summary="Get a single event by ID"
)
def get_event_by_id(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve a single event by ID for the authenticated user."""
    ev = db.query(models.Event).filter(
        models.Event.id == event_id,
        (models.Event.user_id == current_user.id) | (models.Event.user_id == None)
    ).first()
    if not ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found."
        )

    return FrontendEventDetail(
        id=ev.id,
        source_upload_id=ev.source_upload_id,
        title=ev.title,
        name=ev.title,
        type=ev.type,
        start_datetime=ev.start_datetime,
        end_datetime=ev.end_datetime,
        subject=ev.subject,
        category=ev.subject or "Campus",
        location=ev.location,
        weightage=ev.weightage,
        description=ev.description,
        status=ev.status,
        created_at=ev.created_at
    )
