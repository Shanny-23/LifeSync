import os
import json
import re
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
from schemas import ScheduledSlotItem
from services.groq_service import (
    call_groq_chat,
    clean_groq_json_response,
    get_groq_api_key,
    REASONING_MODEL
)
import logging

load_dotenv()
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
DAY_START_TIME = time(8, 0)
DAY_END_TIME = time(22, 0)


def parse_slot_datetimes(slot_date_str: str, start_time_str: str, end_time_str: str) -> tuple[datetime, datetime]:
    """Parses date and start/end time strings into naive UTC-comparable datetime objects."""
    s_date = datetime.strptime(slot_date_str.strip(), "%Y-%m-%d").date()
    s_time = datetime.strptime(start_time_str.strip(), "%H:%M").time()
    e_time = datetime.strptime(end_time_str.strip(), "%H:%M").time()
    return datetime.combine(s_date, s_time), datetime.combine(s_date, e_time)


def is_event_overlapping(
    slot_start: datetime,
    slot_end: datetime,
    event: models.Event
) -> bool:
    """
    Checks if a time interval [slot_start, slot_end] overlaps with an event.
    Handles all-day events, multi-day fests/holidays, and time-bound events.
    """
    if not event.start_datetime:
        return False

    ev_start = event.start_datetime
    # Make naive for comparison if needed
    if ev_start.tzinfo is not None:
        ev_start = ev_start.replace(tzinfo=None)

    ev_end = event.end_datetime
    if ev_end is not None and ev_end.tzinfo is not None:
        ev_end = ev_end.replace(tzinfo=None)

    slot_date = slot_start.date()

    # Case 1: Event has both start and end datetimes
    if ev_end:
        # Check if it's an all-day or multi-day date range (00:00 to 00:00 or 23:59)
        if ev_start.time() == time(0, 0) and (ev_end.time() == time(0, 0) or ev_end.time() == time(23, 59)):
            return ev_start.date() <= slot_date <= ev_end.date()
        # Specific time interval
        return slot_start < ev_end and slot_end > ev_start

    # Case 2: Only start_datetime is provided
    if ev_start.time() == time(0, 0):
        # All-day event on ev_start.date()
        return ev_start.date() == slot_date
    else:
        # Time-bound event with default 2-hour duration
        ev_end_inferred = ev_start + timedelta(hours=2)
        return slot_start < ev_end_inferred and slot_end > ev_start


def find_conflicting_event(
    slot: models.ScheduledSlot,
    db: Session,
    user_id: Optional[int] = None
) -> Optional[models.Event]:
    """
    Checks if the scheduled slot overlaps with any blocking event in 'events'
    (fests, holidays, club events, or any non-cancelled event).
    """
    try:
        slot_start, slot_end = parse_slot_datetimes(
            slot.scheduled_date,
            slot.start_time,
            slot.end_time
        )
    except Exception:
        return None

    # Query events that could overlap (fests, holidays, club events)
    blocking_events_query = (
        db.query(models.Event)
        .filter(
            models.Event.type.in_(["fest", "holiday", "club_event", "event"]),
            models.Event.status != "cancelled"
        )
    )
    if user_id is not None:
        blocking_events_query = blocking_events_query.filter(
            (models.Event.user_id == user_id) | (models.Event.user_id == None)
        )
    blocking_events = blocking_events_query.all()

    for ev in blocking_events:
        if is_event_overlapping(slot_start, slot_end, ev):
            return ev

    return None


def compute_non_conflicting_free_slots(
    db: Session,
    days_ahead: int = 7,
    exclude_slot_id: Optional[int] = None,
    user_id: Optional[int] = None
) -> list[dict[str, Any]]:
    """
    Computes all free time slots over the scheduling horizon that do NOT overlap
    with:
    1. Fixed timetable classes
    2. Blocking calendar events (fests, holidays, club events)
    3. Other active scheduled slots (except the one being rescheduled)
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    end_date = today + timedelta(days=days_ahead)

    # Collect all busy intervals grouped by date
    daily_busy: dict[date, list[tuple[time, time]]] = {}
    for i in range(days_ahead + 1):
        daily_busy[today + timedelta(days=i)] = []

    # 1. Classes and all blocking events in range
    events_query = (
        db.query(models.Event)
        .filter(
            models.Event.start_datetime >= datetime.combine(today, time(0, 0)),
            models.Event.start_datetime <= datetime.combine(end_date, time(23, 59)),
            models.Event.status != "cancelled"
        )
    )
    if user_id is not None:
        events_query = events_query.filter(
            (models.Event.user_id == user_id) | (models.Event.user_id == None)
        )
    events = events_query.all()

    for ev in events:
        if not ev.start_datetime:
            continue
        ev_start = ev.start_datetime.replace(tzinfo=None) if ev.start_datetime.tzinfo else ev.start_datetime
        ev_date = ev_start.date()
        if ev_date not in daily_busy:
            continue

        if ev.end_datetime:
            ev_end = ev.end_datetime.replace(tzinfo=None) if ev.end_datetime.tzinfo else ev.end_datetime
            if ev.type in ["holiday", "fest"] and ev_start.time() == time(0, 0):
                # Whole day is busy
                daily_busy[ev_date].append((DAY_START_TIME, DAY_END_TIME))
            else:
                daily_busy[ev_date].append((ev_start.time(), ev.end_datetime.time() if ev.end_datetime else DAY_END_TIME))
        else:
            if ev_start.time() == time(0, 0):
                daily_busy[ev_date].append((DAY_START_TIME, DAY_END_TIME))
            else:
                end_t = (ev_start + timedelta(hours=2)).time()
                daily_busy[ev_date].append((ev_start.time(), end_t))

    # 2. Already active scheduled slots (exclude the slot currently in conflict)
    active_slots_query = db.query(models.ScheduledSlot).filter(models.ScheduledSlot.status == "active")
    if user_id is not None:
        active_slots_query = active_slots_query.filter(
            (models.ScheduledSlot.user_id == user_id) | (models.ScheduledSlot.user_id == None)
        )
    if exclude_slot_id:
        active_slots_query = active_slots_query.filter(models.ScheduledSlot.id != exclude_slot_id)
    active_slots = active_slots_query.all()

    for s in active_slots:
        try:
            s_date = datetime.strptime(s.scheduled_date, "%Y-%m-%d").date()
            if s_date in daily_busy:
                st_time = datetime.strptime(s.start_time, "%H:%M").time()
                et_time = datetime.strptime(s.end_time, "%H:%M").time()
                daily_busy[s_date].append((st_time, et_time))
        except Exception:
            continue

    # 3. Invert to get free slots per day
    from services.scheduler import compute_daily_free_slots
    free_slots_by_day = []
    for d, busy_list in daily_busy.items():
        slots = compute_daily_free_slots(d, busy_list)
        if slots:
            free_slots_by_day.append({
                "date": d.strftime("%Y-%m-%d"),
                "day_name": d.strftime("%A"),
                "free_slots": slots
            })

    return free_slots_by_day


def find_alternate_slot_for_task(
    task: models.Task,
    conflicted_slot: models.ScheduledSlot,
    db: Session,
    days_ahead: int = 7,
    user_id: Optional[int] = None
) -> Optional[dict[str, str]]:
    """
    Attempts to find an alternate non-overlapping free slot for a conflicted task before its deadline.
    Uses Anthropic Claude if available, or falls back to an algorithmic slot search across computed gaps.
    """
    free_slots_by_day = compute_non_conflicting_free_slots(
        db=db,
        days_ahead=days_ahead,
        exclude_slot_id=conflicted_slot.id,
        user_id=user_id
    )

    if not free_slots_by_day:
        return None

    deadline_dt = task.deadline
    if deadline_dt and deadline_dt.tzinfo:
        deadline_dt = deadline_dt.replace(tzinfo=None)

    prompt = f"""You need to reschedule ONE single task that had a calendar conflict.
Task:
{json.dumps({
    "task_id": task.id,
    "title": task.title,
    "subject": task.subject,
    "deadline": task.deadline.strftime("%Y-%m-%d %H:%M") if task.deadline else None,
    "duration_minutes": 60
}, indent=2)}

Available Conflict-Free Time Gaps:
{json.dumps(free_slots_by_day, indent=2)}

Select ONE non-overlapping free slot strictly before the task deadline (or earliest available if no deadline).
Return ONLY JSON matching:
{{
  "task_id": {task.id},
  "scheduled_date": "YYYY-MM-DD",
  "scheduled_start_time": "HH:MM",
  "scheduled_end_time": "HH:MM"
}}"""

    # 1. Try Groq with DeepSeek-R1 Distill (multi-constraint reasoning model)
    ai_parsed_item = None
    groq_key = get_groq_api_key()
    if groq_key:
        try:
            raw = call_groq_chat(
                prompt=f"You are an expert academic scheduler. Return ONLY valid JSON.\n\n{prompt}",
                model=REASONING_MODEL,
                temperature=0.0,
                custom_key=groq_key
            )
            cleaned = clean_groq_json_response(raw)
            ai_parsed_item = json.loads(cleaned)
        except Exception as e:
            logger.warning("Groq DeepSeek R1 alternate slot resolution error: %s", e)

    # 2. Try Anthropic Claude if Groq was not available or failed
    if not ai_parsed_item:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key and not api_key.startswith("test_"):
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                res = client.messages.create(
                    model=MODEL_NAME,
                    max_tokens=500,
                    temperature=0.0,
                    system="You are an academic scheduler. Return ONLY valid JSON.",
                    messages=[{"role": "user", "content": prompt}]
                )
                raw = res.content[0].text
                cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned).strip()
                ai_parsed_item = json.loads(cleaned)
            except Exception:
                pass

    # 3. Strict Validation on AI Proposed Alternate Slot
    if ai_parsed_item and isinstance(ai_parsed_item, dict):
        try:
            slot_item = ScheduledSlotItem.model_validate(ai_parsed_item)
            # 1. Verify task_id matches task.id and exists
            if slot_item.task_id != task.id:
                logger.warning(
                    "Conflict resolver validation failed: AI hallucinated task_id %s (expected %s). Discarding slot.",
                    slot_item.task_id, task.id
                )
            else:
                cand_d = datetime.strptime(slot_item.scheduled_date.strip(), "%Y-%m-%d").date()
                cand_st = datetime.strptime(slot_item.scheduled_start_time.strip(), "%H:%M").time()
                cand_et = datetime.strptime(slot_item.scheduled_end_time.strip(), "%H:%M").time()
                cand_start_dt = datetime.combine(cand_d, cand_st)
                cand_end_dt = datetime.combine(cand_d, cand_et)

                # 2. Verify falls within task's actual deadline window
                exceeds_deadline = False
                if deadline_dt and cand_end_dt > deadline_dt:
                    exceeds_deadline = True
                    logger.warning(
                        "Conflict resolver validation failed: AI proposed slot %s %s-%s exceeds actual deadline %s. Rejecting slot.",
                        cand_d, cand_st, cand_et, deadline_dt
                    )

                # 3. Hard assertion: Verify no overlap with any fixed event (class, exam, fest, holiday)
                events_q = db.query(models.Event).filter(models.Event.status != "cancelled")
                if user_id is not None:
                    events_q = events_q.filter((models.Event.user_id == user_id) | (models.Event.user_id == None))
                all_events = events_q.all()
                overlaps_fixed = any(is_event_overlapping(cand_start_dt, cand_end_dt, ev) for ev in all_events)
                if overlaps_fixed:
                    logger.warning("Conflict resolver hard assertion failed: AI proposed slot overlaps a fixed event. Rejecting slot.")

                # Hard assertion: Verify no overlap with other active scheduled slots (excluding conflicted_slot)
                active_q = db.query(models.ScheduledSlot).filter(
                    models.ScheduledSlot.status == "active",
                    models.ScheduledSlot.id != conflicted_slot.id
                )
                if user_id is not None:
                    active_q = active_q.filter(models.ScheduledSlot.user_id == user_id)
                overlaps_active = False
                for s in active_q.all():
                    try:
                        s_d = datetime.strptime(s.scheduled_date, "%Y-%m-%d").date()
                        s_st = datetime.strptime(s.start_time, "%H:%M").time()
                        s_et = datetime.strptime(s.end_time, "%H:%M").time()
                        s_start_dt = datetime.combine(s_d, s_st)
                        s_end_dt = datetime.combine(s_d, s_et)
                        if cand_start_dt < s_end_dt and cand_end_dt > s_start_dt:
                            overlaps_active = True
                            break
                    except Exception:
                        continue

                if not exceeds_deadline and not overlaps_fixed and not overlaps_active and cand_end_dt > cand_start_dt:
                    return {
                        "scheduled_date": slot_item.scheduled_date,
                        "start_time": slot_item.scheduled_start_time,
                        "end_time": slot_item.scheduled_end_time
                    }
        except Exception as val_err:
            logger.warning("Conflict resolver AI proposed slot validation error: %s", val_err)

    # 2. Deterministic Fallback: pick earliest available free gap of >= 45 mins before deadline
    for day_info in free_slots_by_day:
        slot_date = datetime.strptime(day_info["date"], "%Y-%m-%d").date()
        for gap in day_info["free_slots"]:
            if gap.get("duration_minutes", 0) >= 45:
                gap_start_t = datetime.strptime(gap["start_time"], "%H:%M").time()
                # Default 60 minute slot
                gap_start_dt = datetime.combine(slot_date, gap_start_t)
                gap_end_dt = gap_start_dt + timedelta(minutes=60)
                gap_end_t = gap_end_dt.time()

                # Check deadline constraint
                if deadline_dt and gap_end_dt > deadline_dt:
                    continue

                return {
                    "scheduled_date": day_info["date"],
                    "start_time": gap_start_t.strftime("%H:%M"),
                    "end_time": gap_end_t.strftime("%H:%M")
                }

    return None


def resolve_schedule_conflicts(
    db: Session,
    days_ahead: int = 7,
    user_id: Optional[int] = None
) -> dict[str, Any]:
    """
    Checks each active entry in 'scheduled_slots' against the 'events' table
    (fests, holidays, club events).
    - Removes or reschedules overlapping slots.
    - Re-runs conflicted tasks to find an alternate slot before deadline.
    - Logs every resolution action to the 'conflict_log' table.
    """
    active_slots_query = (
        db.query(models.ScheduledSlot)
        .filter(models.ScheduledSlot.status == "active")
    )
    if user_id is not None:
        active_slots_query = active_slots_query.filter(
            (models.ScheduledSlot.user_id == user_id) | (models.ScheduledSlot.user_id == None)
        )
    active_slots = active_slots_query.all()

    conflicts_detected = 0
    conflicts_rescheduled = 0
    conflicts_removed = 0
    logs_created = []

    for slot in active_slots:
        conflicting_ev = find_conflicting_event(slot, db, user_id=user_id)
        if not conflicting_ev:
            continue

        conflicts_detected += 1
        task = db.query(models.Task).filter(models.Task.id == slot.task_id).first()
        task_title = task.title if task else f"Task #{slot.task_id}"

        orig_date = slot.scheduled_date
        orig_start = slot.start_time
        orig_end = slot.end_time

        # Attempt to find an alternate free slot
        alt_slot = None
        if task:
            alt_slot = find_alternate_slot_for_task(
                task=task,
                conflicted_slot=slot,
                db=db,
                days_ahead=days_ahead,
                user_id=user_id
            )

        if alt_slot:
            # Reschedule slot
            slot.scheduled_date = alt_slot["scheduled_date"]
            slot.start_time = alt_slot["start_time"]
            slot.end_time = alt_slot["end_time"]
            slot.status = "active"
            if task:
                task.status = "scheduled"

            log_entry = models.ConflictLog(
                slot_id=slot.id,
                task_id=slot.task_id,
                conflicting_event_id=conflicting_ev.id,
                conflict_type=f"overlap_{conflicting_ev.type}",
                original_date=orig_date,
                original_start_time=orig_start,
                original_end_time=orig_end,
                resolved_action="rescheduled",
                new_date=alt_slot["scheduled_date"],
                new_start_time=alt_slot["start_time"],
                new_end_time=alt_slot["end_time"],
                notes=(
                    f"Slot for '{task_title}' conflicted with {conflicting_ev.type} '{conflicting_ev.title}'. "
                    f"Rescheduled to {alt_slot['scheduled_date']} {alt_slot['start_time']}-{alt_slot['end_time']}."
                )
            )
            db.add(log_entry)
            conflicts_rescheduled += 1
            logs_created.append(log_entry)
        else:
            # No alternative slot available: mark slot conflict_removed and flag task for manual review
            slot.status = "conflict_removed"
            if task:
                task.status = "needs_manual_review"

            log_entry = models.ConflictLog(
                slot_id=slot.id,
                task_id=slot.task_id,
                conflicting_event_id=conflicting_ev.id,
                conflict_type=f"overlap_{conflicting_ev.type}",
                original_date=orig_date,
                original_start_time=orig_start,
                original_end_time=orig_end,
                resolved_action="needs_manual_review",
                new_date=None,
                new_start_time=None,
                new_end_time=None,
                notes=(
                    f"Slot for '{task_title}' conflicted with {conflicting_ev.type} '{conflicting_ev.title}'. "
                    f"No conflict-free slot found before deadline window. Marked task as 'needs_manual_review'."
                )
            )
            db.add(log_entry)
            conflicts_removed += 1
            logs_created.append(log_entry)

    db.commit()

    serialized_logs = []
    for l in logs_created:
        db.refresh(l)
        serialized_logs.append({
            "id": l.id,
            "slot_id": l.slot_id,
            "task_id": l.task_id,
            "conflicting_event_id": l.conflicting_event_id,
            "conflict_type": l.conflict_type,
            "original_date": l.original_date,
            "original_start_time": l.original_start_time,
            "original_end_time": l.original_end_time,
            "resolved_action": l.resolved_action,
            "new_date": l.new_date,
            "new_start_time": l.new_start_time,
            "new_end_time": l.new_end_time,
            "notes": l.notes,
            "created_at": l.created_at
        })

    return {
        "conflicts_detected": conflicts_detected,
        "conflicts_rescheduled": conflicts_rescheduled,
        "conflicts_removed": conflicts_removed,
        "conflict_logs": serialized_logs,
        "message": (
            f"Conflict resolution completed: {conflicts_detected} conflict(s) detected, "
            f"{conflicts_rescheduled} rescheduled, {conflicts_removed} removed."
        )
    }
