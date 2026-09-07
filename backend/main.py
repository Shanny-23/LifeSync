import os
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import Base, engine, get_db, SessionLocal, ensure_db_schema
import models
from schemas import (
    UploadResponse,
    UploadStatusResponse,
    UploadTypeEnum,
    ExtractedDataResponse,
    EventResponse,
    TaskResponse,
    NormalizationResponse,
    ScheduledSlotResponse,
    ScheduleGenerationResponse,
    PriorityRecalculationResponse,
    ConflictLogResponse,
    ConflictResolutionResult,
    ExamPlannerResponse
)
from services.parser import extract_text, ParserError
from services.extractor import extract_structured_data, ExtractionValidationError
from services.normalizer import normalize_upload_data
from services.scheduler import generate_ai_schedule
from services.priority import recalculate_all_priorities
from services.conflict_resolver import resolve_schedule_conflicts
from services.exam_planner import generate_exam_study_plan
from services.auth_service import get_current_user



# Load environment variables from .env file
load_dotenv()

# Define storage directory for uploads
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions for uploads (PDF and common image formats)
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


# App Lifespan context manager for startup / shutdown tasks
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables and dynamic migration columns are initialized
    ensure_db_schema()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    yield
    # Shutdown: Clean up resources if necessary



app = FastAPI(
    title="LifeSync Backend API",
    description="FastAPI service for LifeSync task & schedule synchronization",
    version="1.0.0",
    lifespan=lifespan
)

# Parse allowed CORS origins from environment variable
cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
)
origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
def read_root():
    """Root endpoint welcoming API consumers and linking to documentation."""
    return {
        "service": "LifeSync Backend API",
        "status": "online",
        "documentation": "/docs"
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint to verify that service is responsive."""
    return {
        "status": "healthy",
        "message": "LifeSync Backend API is operational"
    }


def process_upload_pipeline(upload_id: int):
    """
    Background worker that automatically chains parse -> extract -> normalize in one continuous flow.
    Transitions upload.status:
    'pending' -> 'parsed' -> 'extracted' -> 'normalized' -> 'done'
    If any stage fails, sets status to 'failed' and records error_message.
    """
    db = SessionLocal()
    try:
        record = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
        if not record:
            return

        # 1. Parse text from uploaded document
        full_path = BASE_DIR / record.filepath
        if not full_path.exists():
            record.status = "failed"
            record.error_message = f"Stored file for upload #{upload_id} does not exist at '{record.filepath}'."
            db.commit()
            return

        extracted_text = extract_text(str(full_path))
        record.raw_text = extracted_text
        record.status = "parsed"
        db.commit()

        # 2. Extract structured entities matching schema
        validated_items = extract_structured_data(
            upload_type=record.type,
            raw_text=record.raw_text
        )
        extracted_entry = models.ExtractedData(
            upload_id=record.id,
            type=record.type,
            data=validated_items
        )
        db.add(extracted_entry)
        record.status = "extracted"
        db.commit()

        # 3. Normalize into unified events or tasks tables
        normalize_upload_data(upload_id=record.id, db=db)
        record.status = "normalized"
        db.commit()

        # 4. Mark done
        record.status = "done"
        record.error_message = None
        db.commit()

    except Exception as exc:
        try:
            record = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
            if record:
                record.status = "failed"
                record.error_message = str(exc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Uploads"],
    summary="Upload reference documents (PDF or image) and trigger background pipeline"
)
async def upload_document(
    background_tasks: BackgroundTasks,
    type: UploadTypeEnum = Form(..., description="Document category type (timetable, syllabus, assignments, holiday_calendar, fest_schedule, club_calendar)"),
    file: UploadFile = File(..., description="PDF or image document"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Accepts file uploads (PDF/image) and a document type classification.
    Saves file to /backend/storage/uploads, creates an uploads table entry with status 'pending',
    and enqueues background processing: parse -> extract -> normalize -> done.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a valid filename."
        )

    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file format '{file_ext}'. "
                f"Accepted file formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )
        )

    # Generate a unique collision-free filename while keeping the original base name
    clean_stem = Path(file.filename).stem.replace(" ", "_")
    safe_filename = f"{uuid.uuid4().hex[:8]}_{clean_stem}{file_ext}"
    target_path = UPLOAD_DIR / safe_filename

    # Save uploaded file to disk
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not write file to storage: {str(exc)}"
        )
    finally:
        await file.close()

    # Relative path stored for portability across systems
    relative_filepath = f"storage/uploads/{safe_filename}"

    # Insert record into database
    upload_record = models.Upload(
        user_id=current_user.id,
        type=type.value,
        filename=file.filename,
        filepath=relative_filepath,
        status="pending"
    )

    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)

    # Automatically chain parse -> extract -> normalize in background
    background_tasks.add_task(process_upload_pipeline, upload_record.id)

    return UploadResponse(
        id=upload_record.id,
        type=upload_record.type,
        filename=upload_record.filename,
        filepath=upload_record.filepath,
        upload_timestamp=upload_record.upload_timestamp,
        status="pending",
        message="File uploaded successfully. Processing pipeline started in background."
    )


@app.get(
    "/api/upload/{upload_id}/status",
    response_model=UploadStatusResponse,
    tags=["Uploads"],
    summary="Poll status of an uploaded document through the background pipeline"
)
def get_upload_status(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns the processing status of an upload:
    'pending' -> 'parsed' -> 'extracted' -> 'normalized' -> 'done' (or 'failed' with error_message).
    """
    record = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload record with id {upload_id} not found."
        )

    stage_messages = {
        "pending": "Upload received, queued for processing.",
        "parsed": "Document text successfully extracted.",
        "extracted": "Structured entities extracted and validated.",
        "normalized": "Entities normalized into unified database tables.",
        "done": "Pipeline processing completed successfully.",
        "failed": f"Processing failed: {record.error_message or 'Unknown error'}"
    }

    return UploadStatusResponse(
        id=record.id,
        type=record.type,
        filename=record.filename,
        status=record.status,
        error_message=record.error_message,
        upload_timestamp=record.upload_timestamp,
        message=stage_messages.get(record.status, f"Status: {record.status}")
    )


@app.get(
    "/api/uploads",
    response_model=list[UploadResponse],
    tags=["Uploads"],
    summary="List all uploaded documents"
)
def list_uploads(
    type: UploadTypeEnum | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve all uploaded documents for current user, optionally filtered by type."""
    query = db.query(models.Upload).filter(models.Upload.user_id == current_user.id)
    if type:
        query = query.filter(models.Upload.type == type.value)
    return query.order_by(models.Upload.upload_timestamp.desc()).all()


@app.get(
    "/api/uploads/{upload_id}",
    response_model=UploadResponse,
    tags=["Uploads"],
    summary="Get single upload details by ID"
)
def get_upload_by_id(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve details for a specific upload by ID."""
    record = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found."
        )
    return record


@app.post(
    "/api/upload/{upload_id}/parse",
    response_model=UploadResponse,
    tags=["Uploads"],
    summary="Trigger OCR / PDF text extraction for an uploaded document"
)
def parse_upload_document(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Extracts raw text from an uploaded document (PDF via pdfplumber/pypdf or image via Tesseract OCR).
    Updates the upload record's raw_text column and sets status to 'parsed' (or 'failed' on error).
    """
    record = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload record with id {upload_id} not found."
        )

    full_path = BASE_DIR / record.filepath
    if not full_path.exists():
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stored file for upload #{upload_id} does not exist at '{record.filepath}'."
        )

    try:
        extracted_text = extract_text(str(full_path))
        record.raw_text = extracted_text
        record.status = "parsed"
        db.commit()
        db.refresh(record)

        return UploadResponse(
            id=record.id,
            type=record.type,
            filename=record.filename,
            filepath=record.filepath,
            upload_timestamp=record.upload_timestamp,
            status=record.status,
            raw_text=record.raw_text,
            message="Document text successfully extracted."
        )
    except ParserError as pe:
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Text extraction failed: {str(pe)}"
        )
    except Exception as exc:
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while extracting text: {str(exc)}"
        )


@app.post(
    "/api/upload/{upload_id}/extract",
    response_model=ExtractedDataResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Extraction"],
    summary="Extract structured entities using Claude (claude-sonnet-4-6)"
)
def extract_document_entities(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Extracts structured entities matching the upload type using Anthropic Claude (claude-sonnet-4-6).
    Validates output against Pydantic models per type and persists rows into the 'extracted_data' table.
    """
    record = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found."
        )

    if not record.raw_text or not record.raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload #{upload_id} has not been parsed yet. Please run POST /api/upload/{upload_id}/parse first."
        )

    try:
        validated_items = extract_structured_data(
            upload_type=record.type,
            raw_text=record.raw_text
        )

        extracted_entry = models.ExtractedData(
            upload_id=record.id,
            type=record.type,
            data=validated_items
        )
        db.add(extracted_entry)
        record.status = "extracted"
        db.commit()
        db.refresh(extracted_entry)

        return ExtractedDataResponse(
            id=extracted_entry.id,
            upload_id=extracted_entry.upload_id,
            type=extracted_entry.type,
            data=extracted_entry.data,
            created_at=extracted_entry.created_at,
            message="Data successfully extracted and validated by Claude."
        )
    except ExtractionValidationError as ev_err:
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error": "Structured JSON validation failed",
                "message": ev_err.message,
                "raw_output": ev_err.raw_output,
                "details": ev_err.details
            }
        )
    except RuntimeError as r_err:
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(r_err)
        )
    except Exception as exc:
        record.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI extraction encountered an unexpected error: {str(exc)}"
        )


@app.get(
    "/api/upload/{upload_id}/extracted",
    response_model=list[ExtractedDataResponse],
    tags=["Extraction"],
    summary="Get extracted records for an upload"
)
def get_extracted_data_for_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve all structured extraction entries associated with an upload."""
    upload = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found."
        )

    records = (
        db.query(models.ExtractedData)
        .filter(models.ExtractedData.upload_id == upload_id)
        .order_by(models.ExtractedData.created_at.desc())
        .all()
    )
    return records


@app.post(
    "/api/upload/{upload_id}/normalize",
    response_model=NormalizationResponse,
    tags=["Normalization"],
    summary="Normalize extracted items into unified events or tasks tables"
)
def normalize_document_data(
    upload_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Takes extracted JSON data from 'extracted_data' for a given upload_id,
    and normalizes into 'events' or 'tasks' table.
    Prevents duplicates on re-upload via natural key deduplication.
    """
    upload = db.query(models.Upload).filter(models.Upload.id == upload_id, models.Upload.user_id == current_user.id).first()
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found."
        )

    try:
        result = normalize_upload_data(upload_id=upload_id, db=db)
        return NormalizationResponse(**result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to normalize document data: {str(exc)}"
        )


# ==========================================
# Modular REST API Routers for Frontend Consumption
# ==========================================
from routers import schedule, tasks, events, google, auth, ai, focus, courses

app.include_router(schedule.router, prefix="/api/schedule")
app.include_router(tasks.router, prefix="/api/tasks")
app.include_router(events.router, prefix="/api/events")
app.include_router(google.router)
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(focus.router)
app.include_router(courses.router)




@app.post(
    "/api/exam-planner/generate/{task_id}",
    response_model=ExamPlannerResponse,
    tags=["Exam Planner"],
    summary="Generate spaced repetition study sessions leading up to an exam, with conflict resolution"
)
def generate_exam_study_plan_endpoint(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Given an exam task, generates multiple smaller study sessions leading up to the exam date
    using spaced repetition intervals (e.g. 7, 4, 2, 1 days before).
    Ensures sessions respect free time (no class overlaps), tags each slot with slot_type='study_session',
    and passes candidate sessions through the conflict resolver.
    """
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found."
        )

    try:
        results = generate_exam_study_plan(task_id=task_id, db=db)
        return ExamPlannerResponse(**results)
    except ValueError as v_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(v_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Exam study planner failed: {str(exc)}"
        )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
