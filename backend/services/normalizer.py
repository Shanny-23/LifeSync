from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Any
import re
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
    Uses dayfirst=False for ISO formats (YYYY-MM-DD), and dayfirst=True for DD.MM.YYYY.
    Returns None if parsing is impossible.
    """
    if not dt_str or not str(dt_str).strip():
        return None
    cleaned = str(dt_str).strip()
    try:
        if re.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}', cleaned):
            return dateutil.parser.parse(cleaned, fuzzy=True, dayfirst=False)
        return dateutil.parser.parse(cleaned, fuzzy=True, dayfirst=True)
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

    # Pre-parse raw document text for academic calendar items and dates if available
    calendar_lookup = []
    if upload.raw_text:
        try:
            from services.parser import parse_academic_calendar_text
            calendar_lookup = parse_academic_calendar_text(upload.raw_text)
        except Exception:
            calendar_lookup = []

    for ext_rec in extracted_records:
        items = ext_rec.data
        if isinstance(items, dict):
            for key in ["schedule", "events", "tasks", "items", "assignments", "modules", "topics", "exams", "holidays"]:
                if key in items and isinstance(items[key], list):
                    items = items[key]
                    break
            else:
                list_vals = [v for v in items.values() if isinstance(v, list)]
                if list_vals:
                    items = list_vals[0]
                else:
                    items = [items]
        elif not isinstance(items, list):
            items = []

        upload_type = ext_rec.type or upload.type

        for item in items:
            if not isinstance(item, dict):
                continue

            total_items += 1

            # -------------------------------------------------------------
            # Category 1: Timetable -> Events (class_session / holiday / exam / academic_event)
            # -------------------------------------------------------------
            if upload_type == "timetable":
                subject = str(item.get("subject", "General")).strip()
                day = str(item.get("day", "Monday")).strip()
                start_time = str(item.get("start_time", "") or "").strip()
                end_time = str(item.get("end_time", "") or "").strip()
                location = item.get("location")
                explicit_date = item.get("date") or item.get("start_date")
                explicit_end_date = item.get("end_date")
                explicit_type = item.get("type")

                # If date is not directly on item, check if subject matches any pre-parsed calendar item
                matched_cal = None
                if not explicit_date and calendar_lookup:
                    sub_clean = re.sub(r'[^a-zA-Z0-9]', '', subject).lower()
                    for cal in calendar_lookup:
                        cal_sub_clean = re.sub(r'[^a-zA-Z0-9]', '', cal["subject"]).lower()
                        if sub_clean and cal_sub_clean and (sub_clean in cal_sub_clean or cal_sub_clean in sub_clean):
                            matched_cal = cal
                            break

                if matched_cal:
                    explicit_date = matched_cal.get("date")
                    explicit_end_date = matched_cal.get("end_date")
                    if not explicit_type:
                        explicit_type = matched_cal.get("type")
                    if not start_time:
                        start_time = matched_cal.get("start_time", "09:00")
                    if not end_time:
                        end_time = matched_cal.get("end_time", "17:00")

                # If explicit date is found (e.g. from academic calendar circular)
                if explicit_date:
                    start_dt = parse_flexible_datetime(explicit_date)
                    if start_dt:
                        # Apply start time
                        s_time = time(9, 0)
                        if start_time:
                            try:
                                s_time = dateutil.parser.parse(start_time, fuzzy=True).time()
                            except Exception:
                                pass
                        start_dt = datetime.combine(start_dt.date(), s_time)

                        # Determine end_dt
                        if explicit_end_date:
                            end_dt_raw = parse_flexible_datetime(explicit_end_date)
                            end_date_val = end_dt_raw.date() if end_dt_raw else start_dt.date()
                        else:
                            end_date_val = start_dt.date()

                        e_time = time(17, 0)
                        if end_time:
                            try:
                                e_time = dateutil.parser.parse(end_time, fuzzy=True).time()
                            except Exception:
                                pass
                        end_dt = datetime.combine(end_date_val, e_time)

                        # Clean title (remove trailing ' Class' if present and sanitize OCR glitches)
                        clean_title = re.sub(r'\s+Class$', '', subject, flags=re.I).strip()
                        clean_title = clean_title.replace('\ufffd25', "'25").replace('\ufffd', '-').replace('\u2019', "'").strip()
                        clean_title = re.sub(r'Gravitas[^\w\s]*25', "Gravitas'25", clean_title)
                        clean_title = re.sub(r'Continuous Assessment Test.*?II', "Continuous Assessment Test - II", clean_title)
                        clean_title = re.sub(r'[\ufffd\x96\x97]', '-', clean_title)

                        # Determine event type
                        if explicit_type in {"holiday", "exam", "academic_event", "class_session"}:
                            ev_type = explicit_type
                        else:
                            t_low = clean_title.lower()
                            if any(w in t_low for w in ['(holiday)', 'holiday', 'no instructional day', 'vacation', 'recess', 'break', 'puja', 'pooja', 'jayanthi', 'deepavali', 'diwali']):
                                ev_type = 'holiday'
                            elif re.search(r'\b(cat\b|fat\b|exam|test|midterm|quiz|assessment)\b', t_low):
                                ev_type = 'exam'
                            elif any(w in t_low for w in ['registration', 'commencement', 'withdraw', 'add/drop', 'fee', 'gravitas', 'fest']):
                                ev_type = 'academic_event'
                            else:
                                ev_type = 'academic_event'

                        # Meaningful description
                        if ev_type == "holiday":
                            desc = f"Observed Academic Holiday ({day})"
                        elif ev_type == "exam":
                            desc = f"Academic Assessment / Examination ({day})"
                        else:
                            desc = f"Academic Milestone / Event on {day}"

                        title = clean_title
                    else:
                        start_dt = parse_timetable_datetime(day, start_time or "09:00")
                        end_dt = parse_timetable_datetime(day, end_time or "10:30")
                        title = f"{subject} Class" if not subject.endswith(" Class") else subject
                        ev_type = "class_session"
                        desc = f"Class session on {day} from {start_time} to {end_time}."
                else:
                    # Pure weekly recurring lecture slot
                    start_dt = parse_timetable_datetime(day, start_time or "09:00")
                    end_dt = parse_timetable_datetime(day, end_time or "10:30")
                    title = f"{subject} Class" if not subject.endswith(" Class") else subject
                    ev_type = "class_session"
                    desc = f"Class session on {day} from {start_time} to {end_time}."

                # Natural key dedupe: (title, start_datetime)
                existing_event_query = (
                    db.query(models.Event)
                    .filter(
                        models.Event.title == title,
                        models.Event.start_datetime == start_dt
                    )
                )
                if upload.user_id is not None:
                    existing_event_query = existing_event_query.filter(models.Event.user_id == upload.user_id)
                existing_event = existing_event_query.first()

                if existing_event:
                    existing_event.end_datetime = end_dt
                    existing_event.type = ev_type
                    existing_event.location = location
                    existing_event.description = desc
                    existing_event.source_upload_id = upload_id
                    existing_event.status = "scheduled"
                    events_updated += 1
                else:
                    new_event = models.Event(
                        user_id=upload.user_id,
                        source_upload_id=upload_id,
                        title=title,
                        type=ev_type,
                        start_datetime=start_dt,
                        end_datetime=end_dt,
                        subject=subject,
                        location=location,
                        description=desc,
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
                existing_event_query = (
                    db.query(models.Event)
                    .filter(
                        models.Event.title == title,
                        models.Event.start_datetime == start_dt,
                        models.Event.type == event_type
                    )
                )
                if upload.user_id is not None:
                    existing_event_query = existing_event_query.filter(models.Event.user_id == upload.user_id)
                existing_event = existing_event_query.first()

                if existing_event:
                    existing_event.end_datetime = end_dt
                    existing_event.description = description
                    existing_event.source_upload_id = upload_id
                    existing_event.status = "scheduled"
                    events_updated += 1
                else:
                    new_event = models.Event(
                        user_id=upload.user_id,
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
                existing_task_query = (
                    db.query(models.Task)
                    .filter(
                        models.Task.title == title,
                        models.Task.deadline == deadline_dt,
                        models.Task.subject == subject
                    )
                )
                if upload.user_id is not None:
                    existing_task_query = existing_task_query.filter(models.Task.user_id == upload.user_id)
                existing_task = existing_task_query.first()

                if existing_task:
                    existing_task.description = rubric_notes
                    existing_task.source_upload_id = upload_id
                    tasks_updated += 1
                else:
                    new_task = models.Task(
                        user_id=upload.user_id,
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
                existing_task_query = (
                    db.query(models.Task)
                    .filter(
                        models.Task.title == title,
                        models.Task.subject == subject
                    )
                )
                if upload.user_id is not None:
                    existing_task_query = existing_task_query.filter(models.Task.user_id == upload.user_id)
                existing_task = existing_task_query.first()

                if existing_task:
                    existing_task.weightage = weightage_str
                    existing_task.source_upload_id = upload_id
                    tasks_updated += 1
                else:
                    new_task = models.Task(
                        user_id=upload.user_id,
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
