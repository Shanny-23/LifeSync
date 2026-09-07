import os
import json
import re
from datetime import datetime, date, time, timedelta, timezone
from typing import Any, Optional
from dotenv import load_dotenv
import logging
import anthropic
from pydantic import ValidationError
from sqlalchemy.orm import Session

import models
from schemas import ScheduledSlotItem
from services.groq_service import (
    call_groq_chat,
    clean_groq_json_response,
    get_groq_api_key,
    REASONING_MODEL
)
from services.conflict_resolver import is_event_overlapping

load_dotenv()
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Default daily active scheduling window (08:00 to 22:00)
DAY_START_TIME = time(8, 0)
DAY_END_TIME = time(22, 0)
MIN_SLOT_MINUTES = 30


def validate_schedule_slot(
    slot_data: dict[str, Any] | ScheduledSlotItem,
    db: Session,
    user_id: Optional[int] = None,
    current_time: Optional[datetime] = None,
    accepted_slots_intervals: Optional[list[tuple[datetime, datetime]]] = None
) -> tuple[bool, Optional[models.Task], Optional[str]]:
    """
    Stricter validation for AI scheduling engine (DeepSeek R1 / LLM) outputs:
    1. Verify task_id exists in the database — discard/flag if missing.
    2. Verify scheduled_date and start/end times fall strictly within task's actual deadline window.
    3. Hard assertion: Verify no scheduled_slot overlaps a fixed event (class, exam, fest, holiday).
       Also verify no overlap with already accepted slots in this batch.
    4. Return (is_valid, task, reason). If is_valid is False and task is not None,
       the task must be marked 'needs_manual_review' instead of being silently dropped.
    """
    if isinstance(slot_data, ScheduledSlotItem):
        task_id = slot_data.task_id
        date_str = slot_data.scheduled_date
        start_str = slot_data.scheduled_start_time
        end_str = slot_data.scheduled_end_time
    elif isinstance(slot_data, dict):
        task_id = slot_data.get("task_id")
        date_str = slot_data.get("scheduled_date")
        start_str = slot_data.get("scheduled_start_time")
        end_str = slot_data.get("scheduled_end_time")
    else:
        return False, None, f"Unsupported slot data type: {type(slot_data)}"

    # 1. Verify task_id actually exists in database
    if task_id is None:
        logger.warning("AI Scheduler validation failed: missing task_id in proposed slot.")
        return False, None, "missing_task_id"

    task_query = db.query(models.Task).filter(models.Task.id == task_id)
    if user_id is not None:
        task_query = task_query.filter((models.Task.user_id == user_id) | (models.Task.user_id == None))
    task = task_query.first()

    if not task:
        logger.warning(
            "AI Scheduler validation failed: task_id %s does not exist in database. Discarding hallucinated slot.",
            task_id
        )
        return False, None, f"task_id_{task_id}_not_found_in_db"

    # 2. Verify date/time format and deadline window
    try:
        s_date = datetime.strptime(str(date_str).strip(), "%Y-%m-%d").date()
        s_start = datetime.strptime(str(start_str).strip(), "%H:%M").time()
        s_end = datetime.strptime(str(end_str).strip(), "%H:%M").time()
        slot_start_dt = datetime.combine(s_date, s_start)
        slot_end_dt = datetime.combine(s_date, s_end)
    except Exception as parse_err:
        logger.warning(
            "AI Scheduler validation failed: task #%s ('%s') has invalid date/time format (%s %s-%s): %s",
            task.id, task.title, date_str, start_str, end_str, parse_err
        )
        return False, task, f"invalid_date_time_format: {parse_err}"

    if slot_end_dt <= slot_start_dt:
        logger.warning(
            "AI Scheduler validation failed: task #%s ('%s') end time <= start time (%s to %s).",
            task.id, task.title, start_str, end_str
        )
        return False, task, "slot_end_time_must_be_after_start_time"

    # Verify task's actual deadline window
    if task.deadline:
        deadline_dt = task.deadline.replace(tzinfo=None) if task.deadline.tzinfo else task.deadline
        if slot_end_dt > deadline_dt:
            logger.warning(
                "AI Scheduler validation failed: task #%s ('%s') scheduled slot [%s %s-%s] exceeds actual deadline %s. Rejecting slot.",
                task.id, task.title, date_str, start_str, end_str, deadline_dt
            )
            return False, task, f"exceeds_deadline: slot_end ({slot_end_dt}) > deadline ({deadline_dt})"

    # 3. Hard assertion: Verify no scheduled_slot overlaps a fixed event (class, exam, fest, holiday)
    events_query = db.query(models.Event).filter(models.Event.status != "cancelled")
    if user_id is not None:
        events_query = events_query.filter((models.Event.user_id == user_id) | (models.Event.user_id == None))
    events = events_query.all()

    for ev in events:
        if is_event_overlapping(slot_start_dt, slot_end_dt, ev):
            logger.warning(
                "AI Scheduler hard assertion failed: task #%s ('%s') scheduled slot [%s %s-%s] overlaps fixed event #%s '%s' (%s). Rejecting slot.",
                task.id, task.title, date_str, start_str, end_str, ev.id, ev.title, ev.type
            )
            return False, task, f"overlaps_fixed_event: #{ev.id} '{ev.title}' ({ev.type})"

    # Also verify no overlap with already accepted slots in this batch
    if accepted_slots_intervals:
        for a_start, a_end in accepted_slots_intervals:
            if slot_start_dt < a_end and slot_end_dt > a_start:
                logger.warning(
                    "AI Scheduler hard assertion failed: task #%s ('%s') scheduled slot [%s %s-%s] overlaps another slot in this batch (%s to %s).",
                    task.id, task.title, date_str, start_str, end_str, a_start, a_end
                )
                return False, task, "overlaps_another_slot_in_batch"

    return True, task, None


def calculate_task_priority(
    task: models.Task,
    ref_date: Optional[datetime] = None,
    db: Optional[Session] = None
) -> int:
    """
    Computes priority score by delegating to services.priority.calculate_task_priority.
    """
    from services.priority import calculate_task_priority as calc_priority
    if db is not None:
        return calc_priority(task, db, ref_date)
    from database import SessionLocal
    temp_db = SessionLocal()
    try:
        return calc_priority(task, temp_db, ref_date)
    finally:
        temp_db.close()


def compute_daily_free_slots(
    target_date: date,
    busy_intervals: list[tuple[time, time]]
) -> list[dict[str, Any]]:
    """
    Computes free time windows on a given date by subtracting busy intervals (classes/events)
    from the daily active window [DAY_START_TIME, DAY_END_TIME].
    """
    # Sort and filter valid intervals
    sorted_busy = []
    for start, end in sorted(busy_intervals, key=lambda x: x[0]):
        if start < DAY_END_TIME and end > DAY_START_TIME:
            clamped_start = max(start, DAY_START_TIME)
            clamped_end = min(end, DAY_END_TIME)
            if clamped_start < clamped_end:
                sorted_busy.append((clamped_start, clamped_end))

    # Merge overlapping busy intervals
    merged_busy = []
    for interval in sorted_busy:
        if not merged_busy:
            merged_busy.append(interval)
        else:
            prev_start, prev_end = merged_busy[-1]
            curr_start, curr_end = interval
            if curr_start <= prev_end:
                merged_busy[-1] = (prev_start, max(prev_end, curr_end))
            else:
                merged_busy.append(interval)

    # Invert busy intervals to get free gaps
    free_slots = []
    cursor = DAY_START_TIME

    for busy_start, busy_end in merged_busy:
        if busy_start > cursor:
            # Calculate gap in minutes
            dt_cursor = datetime.combine(target_date, cursor)
            dt_start = datetime.combine(target_date, busy_start)
            duration = int((dt_start - dt_cursor).total_seconds() / 60)
            if duration >= MIN_SLOT_MINUTES:
                free_slots.append({
                    "start_time": cursor.strftime("%H:%M"),
                    "end_time": busy_start.strftime("%H:%M"),
                    "duration_minutes": duration
                })
        cursor = max(cursor, busy_end)

    if cursor < DAY_END_TIME:
        dt_cursor = datetime.combine(target_date, cursor)
        dt_end = datetime.combine(target_date, DAY_END_TIME)
        duration = int((dt_end - dt_cursor).total_seconds() / 60)
        if duration >= MIN_SLOT_MINUTES:
            free_slots.append({
                "start_time": cursor.strftime("%H:%M"),
                "end_time": DAY_END_TIME.strftime("%H:%M"),
                "duration_minutes": duration
            })

    return free_slots


def get_schedule_context(db: Session, days_ahead: int = 7, user_id: Optional[int] = None) -> dict[str, Any]:
    """
    Gathers fixed classes, computes free time gaps per day, and prepares pending tasks
    ordered by priority score.
    """
    now = datetime.now(timezone.utc)
    start_date = now.date()
    end_date = start_date + timedelta(days=days_ahead)

    # 1. Query fixed timetable classes & events in range
    class_events_query = (
        db.query(models.Event)
        .filter(
            models.Event.type.in_(["class", "class_session"]),
            models.Event.start_datetime >= datetime.combine(start_date, time(0, 0)),
            models.Event.start_datetime <= datetime.combine(end_date, time(23, 59))
        )
    )
    if user_id is not None:
        class_events_query = class_events_query.filter(
            (models.Event.user_id == user_id) | (models.Event.user_id == None)
        )
    class_events = class_events_query.all()

    # Group busy intervals by date
    daily_busy: dict[date, list[tuple[time, time]]] = {}
    for i in range(days_ahead + 1):
        daily_busy[start_date + timedelta(days=i)] = []

    fixed_classes_summary = []
    for ev in class_events:
        if ev.start_datetime:
            ev_date = ev.start_datetime.date()
            if ev_date in daily_busy:
                start_t = ev.start_datetime.time()
                end_t = ev.end_datetime.time() if ev.end_datetime else (
                    (ev.start_datetime + timedelta(minutes=90)).time()
                )
                daily_busy[ev_date].append((start_t, end_t))
                fixed_classes_summary.append({
                    "title": ev.title,
                    "subject": ev.subject,
                    "date": ev_date.strftime("%Y-%m-%d"),
                    "start": start_t.strftime("%H:%M"),
                    "end": end_t.strftime("%H:%M"),
                    "location": ev.location
                })

    # 2. Compute free slots per day
    free_slots_by_day = []
    for d, busy_list in daily_busy.items():
        slots = compute_daily_free_slots(d, busy_list)
        if slots:
            free_slots_by_day.append({
                "date": d.strftime("%Y-%m-%d"),
                "day_name": d.strftime("%A"),
                "free_slots": slots
            })

    # 3. Query pending & needs_manual_review tasks and calculate priority scores
    pending_tasks_query = (
        db.query(models.Task)
        .filter(models.Task.status.in_(["pending", "needs_manual_review"]))
    )
    if user_id is not None:
        pending_tasks_query = pending_tasks_query.filter(
            (models.Task.user_id == user_id) | (models.Task.user_id == None)
        )
    pending_tasks = pending_tasks_query.all()

    tasks_summary = []
    for t in pending_tasks:
        p_score = calculate_task_priority(t, now, db=db)
        t.priority_score = p_score
        tasks_summary.append({
            "task_id": t.id,
            "title": t.title,
            "subject": t.subject,
            "type": t.type,
            "deadline": t.deadline.strftime("%Y-%m-%d %H:%M") if t.deadline else "No hard deadline",
            "weightage": t.weightage,
            "priority_score": p_score,
            "description": t.description
        })

    # Order by priority score descending
    tasks_summary.sort(key=lambda x: x["priority_score"], reverse=True)
    db.commit()

    return {
        "fixed_classes": fixed_classes_summary,
        "free_slots_by_day": free_slots_by_day,
        "tasks": tasks_summary
    }


def clean_model_json(text: str) -> str:
    """Strips markdown code blocks from model response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def generate_ai_schedule(db: Session, days_ahead: int = 7, user_id: Optional[int] = None) -> dict[str, Any]:
    """
    Generates an optimized schedule using Claude, Gemini, or an intelligent local heuristic scheduler.
    Fits pending tasks into computed free slots before deadlines, validates the plan,
    and inserts slots into 'scheduled_slots' table.
    """
    now = datetime.now(timezone.utc)
    context = get_schedule_context(db, days_ahead=days_ahead, user_id=user_id)
    pending_tasks = context["tasks"]

    if not pending_tasks:
        return {
            "slots_created": 0,
            "tasks_scheduled": 0,
            "scheduled_slots": [],
            "message": "No pending tasks found to schedule."
        }

    parsed_slots = None
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    groq_key = get_groq_api_key()

    system_prompt = (
        "You are an expert AI academic scheduler and study planner. "
        "Given a student's fixed class timetable, computed free time slots, and priority-ranked tasks, "
        "allocate each task into an appropriate, non-overlapping free time slot strictly before its deadline.\n"
        "RULES:\n"
        "1. Schedule tasks in order of priority score (higher score first).\n"
        "2. Only schedule slots within the provided free time gaps.\n"
        "3. Ensure the scheduled date and end time are strictly BEFORE the task deadline.\n"
        "4. Standard study/assignment chunks should typically be between 45 and 90 minutes.\n"
        "5. Do NOT create overlapping slots on the same day.\n"
        "6. Return ONLY a valid JSON array of objects with keys: task_id, scheduled_date, scheduled_start_time, scheduled_end_time.\n"
        "No conversational prose, no markdown code block wrappers (no ```json)."
    )

    user_prompt = f"""Fixed Timetable Classes:
{json.dumps(context["fixed_classes"], indent=2)}

Available Free Time Slots:
{json.dumps(context["free_slots_by_day"], indent=2)}

Pending Tasks (Ordered by Priority Score):
{json.dumps(pending_tasks, indent=2)}

Generate the schedule. Return ONLY the JSON array matching:
[
  {{
    "task_id": 1,
    "scheduled_date": "YYYY-MM-DD",
    "scheduled_start_time": "HH:MM",
    "scheduled_end_time": "HH:MM"
  }}
]"""

    # 1. Try Groq with DeepSeek-R1 Distill (multi-constraint reasoning model)
    if groq_key and not parsed_slots:
        try:
            raw_output = call_groq_chat(
                prompt=f"{system_prompt}\n\n{user_prompt}",
                model=REASONING_MODEL,
                temperature=0.0,
                custom_key=groq_key
            )
            cleaned_json = clean_groq_json_response(raw_output)
            parsed_slots = json.loads(cleaned_json)
        except Exception as e:
            logger.warning("Groq AI scheduler error: %s. Using fallback.", e)
            parsed_slots = None

    # 2. Try Anthropic Claude
    if anthropic_key and not parsed_slots:
        try:
            client = anthropic.Anthropic(api_key=anthropic_key)
            response = client.messages.create(
                model=MODEL_NAME,
                max_tokens=4096,
                temperature=0.0,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )
            raw_output = response.content[0].text
            parsed_slots = json.loads(clean_model_json(raw_output))
        except Exception:
            parsed_slots = None

    # 3. Intelligent Local Fallback Engine
    if not parsed_slots:
        parsed_slots = []
        free_days_list = context.get("free_slots_by_day", [])
        used_intervals: dict[str, list[tuple[int, int]]] = {}

        for task in sorted(pending_tasks, key=lambda t: t.get("priority_score", 0), reverse=True):
            task_id = task.get("task_id") or task.get("id")
            if not task_id:
                continue

            deadline_str = task.get("deadline")
            deadline_date = None
            if deadline_str and deadline_str != "No hard deadline":
                try:
                    deadline_date = datetime.strptime(deadline_str[:10], "%Y-%m-%d").date()
                except Exception:
                    pass

            scheduled = False
            for day_info in free_days_list:
                if scheduled:
                    break

                day_str = day_info.get("date")
                day_free = day_info.get("free_slots", [])
                try:
                    cur_date = datetime.strptime(day_str, "%Y-%m-%d").date()
                except Exception:
                    continue

                if deadline_date and cur_date > deadline_date:
                    continue

                for slot in day_free:
                    s_str = slot.get("start_time", "09:00")
                    e_str = slot.get("end_time", "11:00")
                    try:
                        s_h, s_m = map(int, s_str.split(":"))
                        e_h, e_m = map(int, e_str.split(":"))
                    except Exception:
                        continue
                    slot_start = s_h * 60 + s_m
                    slot_end = e_h * 60 + e_m

                    chunk_duration = 60
                    cand_start = slot_start
                    cand_end = slot_start + chunk_duration

                    if cand_end <= slot_end:
                        day_used = used_intervals.setdefault(day_str, [])
                        overlap = any(not (cand_end <= u_start or cand_start >= u_end) for u_start, u_end in day_used)
                        if not overlap:
                            day_used.append((cand_start, cand_end))
                            parsed_slots.append({
                                "task_id": task_id,
                                "scheduled_date": day_str,
                                "scheduled_start_time": f"{cand_start // 60:02d}:{cand_start % 60:02d}",
                                "scheduled_end_time": f"{cand_end // 60:02d}:{cand_end % 60:02d}"
                            })
                            scheduled = True
                            break


    if isinstance(parsed_slots, dict):
        for v in parsed_slots.values():
            if isinstance(v, list):
                parsed_slots = v
                break

    if not isinstance(parsed_slots, list):
        raise ValueError(f"Expected a JSON array of scheduled slots, got {type(parsed_slots).__name__}")

    # Strict validation of every slot returned by DeepSeek R1 / AI
    created_slots = []
    scheduled_task_ids = set()
    flagged_task_ids = set()
    accepted_intervals: list[tuple[datetime, datetime]] = []

    for item in parsed_slots:
        is_valid, task, failure_reason = validate_schedule_slot(
            slot_data=item,
            db=db,
            user_id=user_id,
            current_time=now,
            accepted_slots_intervals=accepted_intervals
        )

        if not is_valid:
            if task:
                task.status = "needs_manual_review"
                flagged_task_ids.add(task.id)
                logger.info(
                    "Task #%s ('%s') marked 'needs_manual_review' due to AI scheduling failure: %s",
                    task.id, task.title, failure_reason
                )
            continue

        # Extract values
        if isinstance(item, ScheduledSlotItem):
            s_date_val = item.scheduled_date
            s_start_val = item.scheduled_start_time
            s_end_val = item.scheduled_end_time
        else:
            s_date_val = str(item.get("scheduled_date", "")).strip()
            s_start_val = str(item.get("scheduled_start_time", "")).strip()
            s_end_val = str(item.get("scheduled_end_time", "")).strip()

        new_slot = models.ScheduledSlot(
            task_id=task.id,
            user_id=user_id,
            scheduled_date=s_date_val,
            start_time=s_start_val,
            end_time=s_end_val,
            status="active"
        )
        db.add(new_slot)
        task.status = "scheduled"
        scheduled_task_ids.add(task.id)
        created_slots.append((new_slot, task))

        s_d = datetime.strptime(s_date_val, "%Y-%m-%d").date()
        s_st = datetime.strptime(s_start_val, "%H:%M").time()
        s_et = datetime.strptime(s_end_val, "%H:%M").time()
        accepted_intervals.append((datetime.combine(s_d, s_st), datetime.combine(s_d, s_et)))

    db.commit()

    # Conflict Resolver Step: Check slots against events (fests, holidays, club events)
    from services.conflict_resolver import resolve_schedule_conflicts
    conflict_result = resolve_schedule_conflicts(db=db, days_ahead=days_ahead, user_id=user_id)

    results = []
    for slot_obj, task_obj in created_slots:
        db.refresh(slot_obj)
        results.append({
            "id": slot_obj.id,
            "task_id": slot_obj.task_id,
            "task_title": task_obj.title,
            "subject": task_obj.subject,
            "scheduled_date": slot_obj.scheduled_date,
            "start_time": slot_obj.start_time,
            "end_time": slot_obj.end_time,
            "status": slot_obj.status,
            "created_at": slot_obj.created_at
        })

    msg = f"Successfully scheduled {len(scheduled_task_ids)} task(s) into {len(results)} slot(s)."
    if flagged_task_ids:
        msg += f" {len(flagged_task_ids)} task(s) flagged for manual review."

    return {
        "slots_created": len(results),
        "tasks_scheduled": len(scheduled_task_ids),
        "scheduled_slots": results,
        "conflicts_resolved": conflict_result.get("conflicts_detected", 0),
        "flagged_tasks": list(flagged_task_ids),
        "message": msg
    }
