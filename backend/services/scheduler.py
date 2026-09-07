import os
import json
import re
from datetime import datetime, date, time, timedelta, timezone
from typing import Any, Optional
from dotenv import load_dotenv
import anthropic
from pydantic import ValidationError
from sqlalchemy.orm import Session

import models
from schemas import ScheduledSlotItem

load_dotenv()

MODEL_NAME = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Default daily active scheduling window (08:00 to 22:00)
DAY_START_TIME = time(8, 0)
DAY_END_TIME = time(22, 0)
MIN_SLOT_MINUTES = 30


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


def get_schedule_context(db: Session, days_ahead: int = 7) -> dict[str, Any]:
    """
    Gathers fixed classes, computes free time gaps per day, and prepares pending tasks
    ordered by priority score.
    """
    now = datetime.now(timezone.utc)
    start_date = now.date()
    end_date = start_date + timedelta(days=days_ahead)

    # 1. Query fixed timetable classes & events in range
    class_events = (
        db.query(models.Event)
        .filter(
            models.Event.type.in_(["class", "class_session"]),
            models.Event.start_datetime >= datetime.combine(start_date, time(0, 0)),
            models.Event.start_datetime <= datetime.combine(end_date, time(23, 59))
        )
        .all()
    )

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

    # 3. Query pending tasks and calculate priority scores
    pending_tasks = (
        db.query(models.Task)
        .filter(models.Task.status == "pending")
        .all()
    )

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


def generate_ai_schedule(db: Session, days_ahead: int = 7) -> dict[str, Any]:
    """
    Generates an optimized schedule using Claude, Gemini, or an intelligent local heuristic scheduler.
    Fits pending tasks into computed free slots before deadlines, validates the plan,
    and inserts slots into 'scheduled_slots' table.
    """
    context = get_schedule_context(db, days_ahead=days_ahead)
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
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

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

    # 1. Try Anthropic Claude
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

    # 2. Try Google Gemini
    if gemini_key and not parsed_slots:
        try:
            from google import genai
            g_client = genai.Client(api_key=gemini_key)
            g_resp = g_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=f"{system_prompt}\n\n{user_prompt}",
            )
            raw_output = g_resp.text
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

    # Validate each slot with Pydantic
    validated_slots: list[ScheduledSlotItem] = []
    for item in parsed_slots:
        try:
            slot_item = ScheduledSlotItem.model_validate(item)
            validated_slots.append(slot_item)
        except ValidationError as v_err:
            raise ValueError(f"Validation failed for slot: {item}. Errors: {v_err.errors()}")

    # Persist validated slots in DB
    created_slots = []
    scheduled_task_ids = set()

    for vs in validated_slots:
        task = db.query(models.Task).filter(models.Task.id == vs.task_id).first()
        if not task:
            continue

        new_slot = models.ScheduledSlot(
            task_id=vs.task_id,
            scheduled_date=vs.scheduled_date,
            start_time=vs.scheduled_start_time,
            end_time=vs.scheduled_end_time,
            status="active"
        )
        db.add(new_slot)
        task.status = "scheduled"
        scheduled_task_ids.add(task.id)
        created_slots.append((new_slot, task))

    db.commit()

    # Conflict Resolver Step: Check slots against events (fests, holidays, club events)
    from services.conflict_resolver import resolve_schedule_conflicts
    conflict_result = resolve_schedule_conflicts(db=db, days_ahead=days_ahead)

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

    return {
        "slots_created": len(results),
        "tasks_scheduled": len(scheduled_task_ids),
        "scheduled_slots": results,
        "conflicts_resolved": conflict_result.get("conflicts_detected", 0),
        "message": f"Successfully scheduled {len(scheduled_task_ids)} task(s) into {len(results)} slot(s)."
    }
