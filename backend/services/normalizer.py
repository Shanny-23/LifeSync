from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Any
import dateutil.parser
from sqlalchemy.orm import Session

import models

WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6
}


def parse_flexible_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """
    Parses arbitrary date/datetime strings (ISO, US, human-readable) into a datetime object.
    Returns None if parsing is impossible.
    """
    if not dt_str or not str(dt_str).strip():
        return None
    cleaned = str(dt_str).strip()
    try:
        return dateutil.parser.parse(cleaned, fuzzy=True)
    except Exception:
        return None


def parse_timetable_datetime(day_str: str, time_str: str, base_date: Optional[date] = None) -> Optional[datetime]:
    """
    Converts a recurring weekday string (e.g. 'Monday') and time (e.g. '09:30 AM')
    into a concrete upcoming datetime anchored to the current week.
    """
    if base_date is None:
        base_date = datetime.now(timezone.utc).date()

    clean_day = day_str.strip().lower()
    target_weekday = None
    for name, code in WEEKDAYS.items():
        if clean_day.startswith(name):
            target_weekday = code
            break

    current_weekday = base_date.weekday()
    if target_weekday is not None:
        diff = (target_weekday - current_weekday) % 7
        target_date = base_date + timedelta(days=diff)
    else:
        target_date = base_date

    try:
        t_parsed = dateutil.parser.parse(time_str.strip(), fuzzy=True)
        t_val = t_parsed.time()
    except Exception:
        t_val = time(9, 0)

    return datetime.combine(target_date, t_val)


def normalize_upload_data(upload_id: int, db: Session) -> dict[str, Any]:
    """
    Takes extracted JSON data from 'extracted_data' for a given upload_id,
    and inserts/upserts into the normalized 'events' or 'tasks' table.
    
    Deduplication / Natural keys:
    - Events: (title, start_datetime, subject)
    - Tasks: (title, deadline, subject)
    
    Prevents duplicates on re-upload and updates the upload status to 'normalized'.
    """
    upload = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
    if not upload:
        raise ValueError(f"Upload record with id {upload_id} not found.")

    extracted_records = (
        db.query(models.ExtractedData)
        .filter(models.ExtractedData.upload_id == upload_id)
        .all()
    )

    if not extracted_records:
        raise ValueError(f"No extracted data found for upload #{upload_id}. Run AI extraction first.")

    events_inserted = 0
    events_updated = 0
    tasks_inserted = 0
    tasks_updated = 0
    total_items = 0

    for ext_rec in extracted_records:
        items = ext_rec.data
        if not isinstance(items, list):
            items = [items] if isinstance(items, dict) else []

        upload_type = ext_rec.type or upload.type

        for item in items:
            if not isinstance(item, dict):
                continue

            total_items += 1

            # -------------------------------------------------------------
            # Category 1: Timetable -> Events (class_session)
            # -------------------------------------------------------------
            if upload_type == "timetable":
                subject = item.get("subject", "General")
                day = item.get("day", "Monday")
                start_time = item.get("start_time", "09:00")
                end_time = item.get("end_time", "10:30")
                location = item.get("location")

                start_dt = parse_timetable_datetime(day, start_time)
                end_dt = parse_timetable_datetime(day, end_time)
                title = f"{subject} Class"

                # Natural key dedupe: (title, start_datetime, subject)
                existing_event = (
                    db.query(models.Event)
                    .filter(
                        models.Event.title == title,
                        models.Event.start_datetime == start_dt,
                        models.Event.subject == subject
                    )
                    .first()
                )

                if existing_event:
                    existing_event.end_datetime = end_dt
                    existing_event.location = location
                    existing_event.source_upload_id = upload_id
                    existing_event.status = "scheduled"
                    events_updated += 1
                else:
                    new_event = models.Event(
                        source_upload_id=upload_id,
                        title=title,
                        type="class_session",
                        start_datetime=start_dt,
                        end_datetime=end_dt,
                        subject=subject,
                        location=location,
                        description=f"Class session on {day} from {start_time} to {end_time}.",
                        status="scheduled"
                    )
                    db.add(new_event)
                    events_inserted += 1

            # -------------------------------------------------------------
            # Category 2: Calendars -> Events (holiday, fest, club_event)
            # -------------------------------------------------------------
            elif upload_type in {"holiday_calendar", "fest_schedule", "club_calendar"}:
                event_type_map = {
                    "holiday_calendar": "holiday",
                    "fest_schedule": "fest",
                    "club_calendar": "club_event"
                }
                event_type = event_type_map.get(upload_type, "event")
                title = item.get("name", "Campus Event")
                description = item.get("description")
                start_dt = parse_flexible_datetime(item.get("start_date"))
                end_dt = parse_flexible_datetime(item.get("end_date"))

                # Natural key dedupe: (title, start_datetime, type)
                existing_event = (
                    db.query(models.Event)
                    .filter(
                        models.Event.title == title,
                        models.Event.start_datetime == start_dt,
                        models.Event.type == event_type
                    )
                    .first()
                )

                if existing_event:
                    existing_event.end_datetime = end_dt
                    existing_event.description = description
                    existing_event.source_upload_id = upload_id
                    existing_event.status = "scheduled"
                    events_updated += 1
                else:
                    new_event = models.Event(
                        source_upload_id=upload_id,
                        title=title,
                        type=event_type,
                        start_datetime=start_dt,
                        end_datetime=end_dt,
                        subject=None,
                        location=None,
                        description=description,
                        status="scheduled"
                    )
                    db.add(new_event)
                    events_inserted += 1

            # -------------------------------------------------------------
            # Category 3: Assignments -> Tasks (assignment)
            # -------------------------------------------------------------
            elif upload_type == "assignments":
                title = item.get("title", "Assignment")
                subject = item.get("subject")
                deadline_dt = parse_flexible_datetime(item.get("deadline"))
                rubric_notes = item.get("rubric_notes")

                # Natural key dedupe: (title, deadline, subject)
                existing_task = (
                    db.query(models.Task)
                    .filter(
                        models.Task.title == title,
                        models.Task.deadline == deadline_dt,
                        models.Task.subject == subject
                    )
                    .first()
                )

                if existing_task:
                    existing_task.description = rubric_notes
                    existing_task.source_upload_id = upload_id
                    tasks_updated += 1
                else:
                    new_task = models.Task(
                        source_upload_id=upload_id,
                        title=title,
                        type="assignment",
                        deadline=deadline_dt,
                        subject=subject,
                        weightage=None,
                        description=rubric_notes,
                        status="pending"
                    )
                    db.add(new_task)
                    tasks_inserted += 1

            # -------------------------------------------------------------
            # Category 4: Syllabus -> Tasks (study_topic)
            # -------------------------------------------------------------
            elif upload_type == "syllabus":
                topic = item.get("topic", "Topic")
                subject = item.get("subject")
                weightage = item.get("weightage")
                title = f"Study: {topic}"

                weightage_str = str(weightage) if weightage is not None else None

                # Natural key dedupe: (title, subject)
                existing_task = (
                    db.query(models.Task)
                    .filter(
                        models.Task.title == title,
                        models.Task.subject == subject
                    )
                    .first()
                )

                if existing_task:
                    existing_task.weightage = weightage_str
                    existing_task.source_upload_id = upload_id
                    tasks_updated += 1
                else:
                    new_task = models.Task(
                        source_upload_id=upload_id,
                        title=title,
                        type="study_topic",
                        deadline=None,
                        subject=subject,
                        weightage=weightage_str,
                        description=f"Syllabus topic '{topic}' for course {subject} with weightage {weightage_str}.",
                        status="pending"
                    )
                    db.add(new_task)
                    tasks_inserted += 1

    # Update upload status to normalized
    upload.status = "normalized"
    db.commit()

    return {
        "upload_id": upload_id,
        "type": upload.type,
        "events_inserted": events_inserted,
        "events_updated": events_updated,
        "tasks_inserted": tasks_inserted,
        "tasks_updated": tasks_updated,
        "total_processed": total_items,
        "message": f"Successfully normalized {total_items} item(s) from upload #{upload_id}."
    }
