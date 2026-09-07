from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, time, timedelta
import logging

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
                exam_dt = datetime.fromisoformat(exam["date"])
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
        # Case A: Direct ISO timestamps
        start_dt = None
        if ev.get("start_datetime"):
            try:
                start_dt = datetime.fromisoformat(ev["start_datetime"])
            except Exception:
                pass
        end_dt = None
        if ev.get("end_datetime"):
            try:
                end_dt = datetime.fromisoformat(ev["end_datetime"])
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

        # Case B: Timetable slot with day & times (e.g. day="Monday", start_time="10:00", end_time="11:30")
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

    db.commit()

    # Automatically run AI scheduler to fit study slots for newly committed tasks
    try:
        from services.scheduler import generate_ai_schedule
        generate_ai_schedule(db=db, days_ahead=7, user_id=current_user.id)
    except Exception as sched_err:
        logger.warning("Auto-scheduling after commit: %s", sched_err)

    return {
        "status": "success",
        "committed_tasks": len(created_tasks),
        "committed_events": len(created_events),
        "message": f"Successfully integrated {len(created_tasks)} tasks and {len(created_events)} calendar event(s) into your schedule."
    }
