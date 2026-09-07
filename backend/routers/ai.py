from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, time, timedelta
import logging
import dateutil.parser

logger = logging.getLogger(__name__)

from database import get_db
import models
from models import Task, Event, Upload
from services.gemini_extractor import (
    extract_academic_items_with_gemini,
    analyze_document_comprehensive,
    execute_app_management
)
from services.groq_service import (
    get_groq_api_key,
    EXTRACTION_MODEL,
    REASONING_MODEL
)
from services.priority import calculate_task_priority
from services.auth_service import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

class CopilotRequest(BaseModel):
    prompt: str
    groq_key: Optional[str] = None
    gemini_key: Optional[str] = None

class SetKeyRequest(BaseModel):
    api_key: str

class ExtractPreviewRequest(BaseModel):
    text: Optional[str] = None
    upload_id: Optional[int] = None
    groq_key: Optional[str] = None
    gemini_key: Optional[str] = None

class CommitExtractedRequest(BaseModel):
    assignments: List[Dict[str, Any]] = []
    exams: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []
    holidays: List[Dict[str, Any]] = []
    sync_to_google_calendar: Optional[bool] = False

@router.get("/status")
async def get_ai_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Check if Groq API Key is configured and report AI operational models and mode."""
    key = get_groq_api_key()
    tasks_count = db.query(Task).filter(Task.user_id == current_user.id, Task.status != "completed").count()
    events_count = db.query(Event).filter(Event.user_id == current_user.id).count()
    return {
        "has_key": bool(key),
        "model": f"{EXTRACTION_MODEL} & {REASONING_MODEL}",
        "extraction_model": EXTRACTION_MODEL,
        "reasoning_model": REASONING_MODEL,
        "tasks_count": tasks_count,
        "events_count": events_count,
        "mode": "groq-live" if key else "rule-manager"
    }

@router.post("/set-key")
async def set_groq_api_key(payload: SetKeyRequest):
    """Save Groq API Key to runtime environment and .env file."""
    import os
    key = payload.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    os.environ["GROQ_API_KEY"] = key

    # Persist to .env
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            new_lines = []
            found = False
            for line in lines:
                if line.startswith("GROQ_API_KEY="):
                    new_lines.append(f"GROQ_API_KEY={key}\n")
                    found = True
                elif line.startswith("GEMINI_API_KEY="):
                    # Replace legacy key entry
                    new_lines.append(f"GROQ_API_KEY={key}\n")
                    found = True
                else:
                    new_lines.append(line)
            if not found:
                new_lines.append(f"GROQ_API_KEY={key}\n")
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except Exception as e:
            pass

    return {"status": "success", "message": "Groq API key configured successfully."}

@router.post("/copilot")
async def handle_copilot_command(
    payload: CopilotRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    LifeSync Natural Language Copilot & App Manager:
    Gathers live workspace context and executes intelligent actions via Groq DeepSeek-R1.
    """
    effective_key = payload.groq_key or payload.gemini_key
    result = execute_app_management(
        prompt=payload.prompt,
        db=db,
        user=current_user,
        custom_key=effective_key
    )
    return result



@router.post("/extract-preview")
async def preview_extraction(
    payload: ExtractPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Extract structured items from text or an existing upload job before committing.
    """
    raw_text = payload.text or ""
    
    if payload.upload_id:
        job = db.query(Upload).filter(Upload.id == payload.upload_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Upload job not found")
        # Read text from stored file or data if available
        if job.filepath:
            import os
            if os.path.exists(job.filepath):
                try:
                    from services.parser import extract_text
                    raw_text = extract_text(job.filepath)
                except Exception:
                    pass

    if not raw_text.strip():
        raw_text = "CS450 Distributed Systems: Midterm Exam on Oct 14, 2026. Raft Consensus Assignment due Oct 28, 2026. Lectures MWF 10:00-11:00 AM."

    effective_key = payload.groq_key or payload.gemini_key
    result = extract_academic_items_with_gemini(raw_text, custom_key=effective_key)
    return result


@router.post("/analyze-document")
async def analyze_document_endpoint(
    payload: ExtractPreviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Perform deep AI document intelligence on uploaded documents or raw syllabus text:
    Extracts course information, grading weights breakdown, workload estimation,
    syllabus roadmap, and direct structured entities for review and commit.
    """
    raw_text = payload.text or ""
    
    if payload.upload_id:
        job = db.query(Upload).filter(Upload.id == payload.upload_id, Upload.user_id == current_user.id).first()
        if not job:
            job = db.query(Upload).filter(Upload.id == payload.upload_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Upload job not found")
        if job.filepath:
            import os
            if os.path.exists(job.filepath):
                try:
                    from services.parser import extract_text
                    raw_text = extract_text(job.filepath)
                except Exception:
                    pass

    if not raw_text.strip():
        raw_text = "CS450 Distributed Systems: Midterm Exam on Oct 14, 2026. Raft Consensus Assignment due Oct 28, 2026. Lectures MWF 10:00-11:00 AM."

    effective_key = payload.groq_key or payload.gemini_key
    result = analyze_document_comprehensive(raw_text, custom_key=effective_key)
    return result


@router.post("/commit-extracted")
async def commit_extracted_items(
    payload: CommitExtractedRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Bulk commit reviewed academic items into Tasks and Events tables.
    Correctly maps recurring weekly class sessions, assignments, and exam events into the calendar.
    """
    now = datetime.now(timezone.utc)
    created_tasks = []
    created_events = []

    DAY_MAP = {
        "monday": 0, "mon": 0,
        "tuesday": 1, "tue": 1, "tues": 1,
        "wednesday": 2, "wed": 2,
        "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
        "friday": 4, "fri": 4,
        "saturday": 5, "sat": 5,
        "sunday": 6, "sun": 6
    }

    # 1. Commit assignments
    for item in payload.assignments:
        deadline_dt = None
        if item.get("deadline"):
            try:
                deadline_dt = datetime.fromisoformat(item["deadline"])
            except Exception:
                pass

        task = Task(
            user_id=current_user.id,
            title=item.get("title", "Coursework Item"),
            subject=item.get("subject", "Coursework"),
            type="assignment",
            deadline=deadline_dt,
            weightage=item.get("weightage", "10%"),
            description=item.get("description", ""),
            priority_score=50,
            status="pending"
        )
        task.priority_score = calculate_task_priority(task, db)
        db.add(task)
        created_tasks.append(task)

    # 2. Commit exams (as both priority Task and Calendar Event)
    for exam in payload.exams:
        exam_dt = None
        if exam.get("date"):
            try:
                exam_dt = dateutil.parser.parse(str(exam["date"]), dayfirst=True)
            except Exception:
                try:
                    exam_dt = datetime.fromisoformat(str(exam["date"]).replace("Z", ""))
                except Exception:
                    pass

        task = Task(
            user_id=current_user.id,
            title=exam.get("title", "Exam"),
            subject=exam.get("subject", "Exam Work"),
            type="exam_work",
            deadline=exam_dt,
            weightage=exam.get("weightage", "30%"),
            description=exam.get("description", ""),
            priority_score=75,
            status="pending"
        )
        task.priority_score = calculate_task_priority(task, db)
        db.add(task)
        created_tasks.append(task)

        # Also create a calendar Event so exams show on the user's schedule!
        if exam_dt:
            exam_event = Event(
                user_id=current_user.id,
                title=f"EXAM: {exam.get('title', 'Exam')}",
                type="exam",
                start_datetime=exam_dt,
                end_datetime=exam_dt + timedelta(hours=2),
                subject=exam.get("subject", "Exam Work"),
                location=exam.get("location") or "Academic Hall",
                description=exam.get("description", "Course Examination"),
                weightage=exam.get("weightage", "30%")
            )
            db.add(exam_event)
            created_events.append(exam_event)

    # 3. Commit calendar events / lecture timetable
    monday_current_week = now.date() - timedelta(days=now.weekday())

    for ev in payload.events:
        # Case A: Explicit date (or start_date) provided on the event
        concrete_date_str = ev.get("date") or ev.get("start_date")
        if concrete_date_str:
            try:
                base_dt = dateutil.parser.parse(str(concrete_date_str), dayfirst=True)
                base_d = base_dt.date()

                st_time = time(9, 0)
                if ev.get("start_time"):
                    try:
                        st_time = dateutil.parser.parse(str(ev["start_time"]), fuzzy=True).time()
                    except Exception:
                        pass
                elif base_dt.hour != 0 or base_dt.minute != 0:
                    st_time = base_dt.time()

                et_time = time(17, 0)
                if ev.get("end_time"):
                    try:
                        et_time = dateutil.parser.parse(str(ev["end_time"]), fuzzy=True).time()
                    except Exception:
                        pass

                end_base_d = base_d
                if ev.get("end_date"):
                    try:
                        end_base_d = dateutil.parser.parse(str(ev["end_date"]), dayfirst=True).date()
                    except Exception:
                        pass

                event = Event(
                    user_id=current_user.id,
                    title=ev.get("title") or ev.get("subject", "Academic Event"),
                    type=ev.get("type", "academic_event"),
                    start_datetime=datetime.combine(base_d, st_time),
                    end_datetime=datetime.combine(end_base_d, et_time),
                    subject=ev.get("subject"),
                    location=ev.get("location", ""),
                    description=ev.get("description", "")
                )
                db.add(event)
                created_events.append(event)
                continue
            except Exception as ev_dt_err:
                logger.warning("Error parsing concrete date event %s: %s", ev, ev_dt_err)

        # Case B: Direct ISO timestamps
        start_dt = None
        if ev.get("start_datetime"):
            try:
                start_dt = dateutil.parser.parse(str(ev["start_datetime"]), dayfirst=True)
            except Exception:
                pass
        end_dt = None
        if ev.get("end_datetime"):
            try:
                end_dt = dateutil.parser.parse(str(ev["end_datetime"]), dayfirst=True)
            except Exception:
                pass

        if start_dt and end_dt:
            event = Event(
                user_id=current_user.id,
                title=ev.get("title", "Class Session"),
                type=ev.get("type", "class_session"),
                start_datetime=start_dt,
                end_datetime=end_dt,
                subject=ev.get("subject"),
                location=ev.get("location", ""),
                description=ev.get("description", "")
            )
            db.add(event)
            created_events.append(event)
            continue

        # Case C: Timetable slot with day & times (only for recurring lecture slots with no concrete date)
        day_val = str(ev.get("day", "")).strip().lower()
        start_time_val = ev.get("start_time")
        end_time_val = ev.get("end_time")

        if day_val in DAY_MAP and start_time_val and end_time_val:
            try:
                sh, sm = map(int, str(start_time_val).split(":"))
                eh, em = map(int, str(end_time_val).split(":"))
                s_time = time(sh, sm)
                e_time = time(eh, em)
                target_weekday = DAY_MAP[day_val]

                # Project recurring class across the active weeks (e.g. 6 weeks forward)
                for w in range(6):
                    target_date = monday_current_week + timedelta(days=target_weekday + (w * 7))
                    slot_start = datetime.combine(target_date, s_time)
                    slot_end = datetime.combine(target_date, e_time)

                    class_event = Event(
                        user_id=current_user.id,
                        title=ev.get("title", "Lecture Session"),
                        type="class_session",
                        start_datetime=slot_start,
                        end_datetime=slot_end,
                        subject=ev.get("subject"),
                        location=ev.get("location", ""),
                        description=ev.get("description", "Weekly Course Timetable Slot")
                    )
                    db.add(class_event)
                    created_events.append(class_event)
            except Exception as parse_err:
                logger.warning("Error parsing timetable slot %s: %s", ev, parse_err)

    # 4. Commit academic calendar holidays & breaks
    for hol in getattr(payload, "holidays", []):
        start_dt = None
        end_dt = None
        date_str = hol.get("date") or hol.get("start_date") or hol.get("start_datetime")
        end_date_str = hol.get("end_date") or hol.get("end_datetime") or date_str

        if date_str:
            try:
                start_dt = dateutil.parser.parse(str(date_str), dayfirst=True)
                if start_dt.hour == 0 and start_dt.minute == 0:
                    start_dt = datetime.combine(start_dt.date(), time(0, 0, 0))
            except Exception:
                try:
                    start_dt = datetime.fromisoformat(str(date_str).replace("Z", ""))
                except Exception:
                    pass

        if end_date_str:
            try:
                end_dt = dateutil.parser.parse(str(end_date_str), dayfirst=True)
                if end_dt.hour == 0 and end_dt.minute == 0:
                    end_dt = datetime.combine(end_dt.date(), time(23, 59, 59))
            except Exception:
                try:
                    end_dt = datetime.fromisoformat(str(end_date_str).replace("Z", ""))
                except Exception:
                    pass

        if start_dt and not end_dt:
            end_dt = datetime.combine(start_dt.date(), time(23, 59, 59))

        if start_dt and end_dt:
            holiday_event = Event(
                user_id=current_user.id,
                title=hol.get("name") or hol.get("title") or "Academic Holiday",
                type="holiday",
                start_datetime=start_dt,
                end_datetime=end_dt,
                subject=hol.get("type") or "Holiday",
                location=hol.get("location") or "Campus",
                description=hol.get("description") or "Observed University Holiday / Recess"
            )
            db.add(holiday_event)
            created_events.append(holiday_event)

    db.commit()

    # Automatically run AI scheduler to fit study slots for newly committed tasks
    try:
        from services.scheduler import generate_ai_schedule
        generate_ai_schedule(db=db, days_ahead=7, user_id=current_user.id)
    except Exception as sched_err:
        logger.warning("Auto-scheduling after commit: %s", sched_err)

    # Optional Google Calendar Ingestion / Sync
    google_sync_result = None
    if getattr(payload, "sync_to_google_calendar", False):
        try:
            from services.google_service import get_google_credentials, bulk_sync_to_google_calendar
            creds = get_google_credentials(user_id=current_user.id, db=db)
            if creds:
                google_sync_result = bulk_sync_to_google_calendar(
                    creds=creds,
                    events=created_events,
                    tasks=created_tasks
                )
            else:
                google_sync_result = {
                    "success": False,
                    "not_connected": True,
                    "message": "Google account not connected yet. Please authenticate via /authorize to enable direct sync."
                }
        except Exception as g_err:
            logger.error("Failed to sync committed items to Google Calendar: %s", g_err)
            google_sync_result = {"success": False, "error": str(g_err)}

    message = f"Successfully integrated {len(created_tasks)} tasks and {len(created_events)} calendar event(s) into your schedule."
    if google_sync_result:
        if google_sync_result.get("success"):
            synced_n = google_sync_result.get("synced_count", 0)
            message += f" 📅 Synced {synced_n} item(s) directly into your Google Calendar!"
        elif google_sync_result.get("not_connected"):
            message += " (Connect Google Calendar via /authorize to sync to Google Calendar next time)."

    return {
        "status": "success",
        "committed_tasks": len(created_tasks),
        "committed_events": len(created_events),
        "google_sync": google_sync_result,
        "message": message
    }
