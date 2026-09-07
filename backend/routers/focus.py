from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
from schemas import FocusSessionCreate, FocusSessionResponse, FocusStatsResponse
from services.auth_service import get_current_user

router = APIRouter(
    prefix="/api/focus",
    tags=["Focus Sessions"]
)


@router.get(
    "/stats",
    response_model=FocusStatsResponse,
    summary="Get today's focus session metrics, streak, and recent sessions"
)
def get_focus_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Computes today's completed focus sessions count, total study minutes,
    and returns recent focus session logs.
    """
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)

    # Today's sessions
    today_sessions = (
        db.query(models.FocusSession)
        .filter(models.FocusSession.user_id == current_user.id)
        .filter(models.FocusSession.completed == True)
        .filter(models.FocusSession.completed_at >= today_start)
        .all()
    )

    today_count = len(today_sessions)
    today_seconds = sum(s.duration_seconds for s in today_sessions)
    today_minutes = round(today_seconds / 60)

    # Recent 10 sessions
    recent = (
        db.query(models.FocusSession)
        .filter(models.FocusSession.user_id == current_user.id)
        .order_by(models.FocusSession.completed_at.desc())
        .limit(10)
        .all()
    )

    # Calculate streak (days with at least 1 completed focus session)
    streak_days = 1
    # Check past 7 days
    for days_ago in range(1, 14):
        day_start = today_start - timedelta(days=days_ago)
        day_end = day_start + timedelta(days=1)
        has_session = (
            db.query(models.FocusSession.id)
            .filter(models.FocusSession.user_id == current_user.id)
            .filter(models.FocusSession.completed == True)
            .filter(models.FocusSession.completed_at >= day_start)
            .filter(models.FocusSession.completed_at < day_end)
            .first()
        )
        if has_session:
            streak_days += 1
        else:
            break

    # If no session today yet, show at least baseline streak or historical streak
    streak_days = max(1, streak_days)

    return FocusStatsResponse(
        today_sessions_count=today_count,
        today_focus_seconds=today_seconds,
        today_focus_minutes=today_minutes,
        streak_days=streak_days,
        recent_sessions=[FocusSessionResponse.model_validate(s) for s in recent]
    )


@router.post(
    "/complete",
    response_model=FocusSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a completed focus/Pomodoro interval"
)
def record_focus_session(
    payload: FocusSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Records a completed focus session, linking it optionally to an active task.
    """
    now = datetime.now(timezone.utc)
    started = now - timedelta(seconds=payload.duration_seconds)

    # Validate task_id if provided
    if payload.task_id is not None:
        task = db.query(models.Task).filter(models.Task.id == payload.task_id, models.Task.user_id == current_user.id).first()
        if not task:
            # If invalid task id, keep task_id None and retain target_name
            payload.task_id = None

    session = models.FocusSession(
        user_id=current_user.id,
        task_id=payload.task_id,
        mode=payload.mode.upper(),
        duration_seconds=payload.duration_seconds,
        completed=payload.completed,
        target_name=payload.target_name,
        started_at=started,
        completed_at=now
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return FocusSessionResponse.model_validate(session)


@router.get(
    "/sessions",
    response_model=list[FocusSessionResponse],
    summary="List all focus sessions"
)
def list_focus_sessions(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    sessions = (
        db.query(models.FocusSession)
        .filter(models.FocusSession.user_id == current_user.id)
        .order_by(models.FocusSession.completed_at.desc())
        .limit(limit)
        .all()
    )
    return [FocusSessionResponse.model_validate(s) for s in sessions]
