import os
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session

import models
from services.conflict_resolver import (
    compute_non_conflicting_free_slots,
    find_conflicting_event,
    find_alternate_slot_for_task
)

DEFAULT_INTERVALS = [7, 4, 2, 1]
SESSION_DURATION_MINUTES = 60


def generate_exam_study_plan(
    task_id: int,
    db: Session,
    intervals: Optional[list[int]] = None
) -> dict[str, Any]:
    """
    Implements spaced repetition study planning for upcoming exams (CAT/FAT):
    1. Identifies the exam date from the task deadline or linked subject events.
    2. Determines spaced study session dates leading up to the exam (e.g. 7, 4, 2, 1 days before).
    3. Finds free time slots outside of classes and existing scheduled slots.
    4. Tags each generated slot with slot_type='study_session'.
    5. Runs all candidate sessions through the conflict resolver before finalization.
    """
    if intervals is None:
        intervals = DEFAULT_INTERVALS

    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise ValueError(f"Task with id {task_id} not found.")

    now = datetime.now(timezone.utc)
    today = now.date()

    # 1. Determine exam date
    exam_dt = task.deadline
    if not exam_dt and task.subject:
        # Check if an exam event is registered under this subject
        exam_ev = (
            db.query(models.Event)
            .filter(
                models.Event.subject == task.subject,
                models.Event.start_datetime >= now
            )
            .order_by(models.Event.start_datetime.asc())
            .first()
        )
        if exam_ev and exam_ev.start_datetime:
            exam_dt = exam_ev.start_datetime

    if not exam_dt:
        # Default to 7 days ahead if no explicit deadline or event is attached
        exam_dt = now + timedelta(days=7)

    if exam_dt.tzinfo is not None:
        exam_date = exam_dt.astimezone(timezone.utc).date()
    else:
        exam_date = exam_dt.date()

    days_until_exam = (exam_date - today).days
    if days_until_exam <= 0:
        raise ValueError(
            f"Exam date for '{task.title}' is {exam_date} (today or in the past). "
            "Spaced repetition requires an upcoming exam date."
        )

    # 2. Select applicable spaced repetition intervals
    planned_intervals = [d for d in intervals if 0 < d < days_until_exam]
    if not planned_intervals:
        # If exam is very close, schedule at least one session on the day before or today
        planned_intervals = [1] if days_until_exam > 1 else []

    # Sort descending: e.g. [7, 4, 2, 1]
    planned_intervals = sorted(list(set(planned_intervals)), reverse=True)

    # 3. Compute available non-conflicting free slots across the date range
    horizon_days = max(days_until_exam + 2, 8)
    free_slots_by_day = compute_non_conflicting_free_slots(db=db, days_ahead=horizon_days)

    free_slots_dict = {
        item["date"]: item["free_slots"]
        for item in free_slots_by_day
    }

    created_study_slots: list[models.ScheduledSlot] = []

    # 4. Allocate study sessions for each spaced interval
    for offset in planned_intervals:
        target_date = exam_date - timedelta(days=offset)
        if target_date < today:
            continue

        target_date_str = target_date.strftime("%Y-%m-%d")
        candidate_gaps = free_slots_dict.get(target_date_str, [])

        allocated_gap = None
        target_gaps = candidate_gaps
        for gap in candidate_gaps:
            if gap.get("duration_minutes", 0) >= SESSION_DURATION_MINUTES:
                allocated_gap = gap
                target_gaps = candidate_gaps
                break

        # If target date has no room, check target_date - 1 or target_date + 1
        if not allocated_gap:
            for adj_offset in [-1, 1]:
                adj_date = target_date + timedelta(days=adj_offset)
                if today <= adj_date < exam_date:
                    adj_date_str = adj_date.strftime("%Y-%m-%d")
                    adj_gaps = free_slots_dict.get(adj_date_str, [])
                    for gap in adj_gaps:
                        if gap.get("duration_minutes", 0) >= SESSION_DURATION_MINUTES:
                            allocated_gap = gap
                            target_date_str = adj_date_str
                            target_gaps = adj_gaps
                            break
                if allocated_gap:
                    break

        if allocated_gap:
            gap_start_t = datetime.strptime(allocated_gap["start_time"], "%H:%M").time()
            gap_start_dt = datetime.combine(
                datetime.strptime(target_date_str, "%Y-%m-%d").date(),
                gap_start_t
            )
            gap_end_dt = gap_start_dt + timedelta(minutes=SESSION_DURATION_MINUTES)

            # Create slot tagged with slot_type='study_session'
            study_slot = models.ScheduledSlot(
                task_id=task.id,
                user_id=task.user_id,
                scheduled_date=target_date_str,
                start_time=gap_start_dt.strftime("%H:%M"),
                end_time=gap_end_dt.strftime("%H:%M"),
                status="active",
                slot_type="study_session"
            )
            db.add(study_slot)
            created_study_slots.append(study_slot)

            # Safely consume gap to avoid internal collisions
            if allocated_gap in target_gaps:
                target_gaps.remove(allocated_gap)

    db.commit()

    # 5. Run each session through the Conflict Resolver
    conflicts_resolved_count = 0
    final_study_slots = []

    for slot in created_study_slots:
        conflicting_ev = find_conflicting_event(slot, db, user_id=task.user_id)
        if conflicting_ev:
            conflicts_resolved_count += 1
            alt = find_alternate_slot_for_task(
                task=task,
                conflicted_slot=slot,
                db=db,
                days_ahead=horizon_days,
                user_id=task.user_id
            )
            if alt:
                slot.scheduled_date = alt["scheduled_date"]
                slot.start_time = alt["start_time"]
                slot.end_time = alt["end_time"]
                slot.status = "active"
                slot.slot_type = "study_session"
                final_study_slots.append(slot)
            else:
                slot.status = "conflict_removed"
        else:
            final_study_slots.append(slot)

    task.status = "scheduled"
    db.commit()

    results = []
    for slot in final_study_slots:
        db.refresh(slot)
        results.append({
            "id": slot.id,
            "task_id": slot.task_id,
            "task_title": task.title,
            "subject": task.subject,
            "scheduled_date": slot.scheduled_date,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "status": slot.status,
            "slot_type": slot.slot_type,
            "created_at": slot.created_at
        })

    return {
        "task_id": task.id,
        "exam_title": task.title,
        "subject": task.subject,
        "exam_date": exam_date.strftime("%Y-%m-%d"),
        "intervals_planned": planned_intervals,
        "sessions_created": len(results),
        "conflicts_resolved": conflicts_resolved_count,
        "study_sessions": results,
        "message": (
            f"Successfully generated {len(results)} spaced repetition study session(s) "
            f"for '{task.title}' across intervals {planned_intervals} days before the exam."
        )
    }
