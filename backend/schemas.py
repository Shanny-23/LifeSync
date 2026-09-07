from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UploadTypeEnum(str, Enum):
    timetable = "timetable"
    syllabus = "syllabus"
    assignments = "assignments"
    holiday_calendar = "holiday_calendar"
    fest_schedule = "fest_schedule"
    club_calendar = "club_calendar"


class UploadResponse(BaseModel):
    id: int = Field(..., description="Unique ID of the uploaded record")
    type: str = Field(..., description="Category/source type of the upload")
    filename: str = Field(..., description="Original filename of the uploaded file")
    filepath: str = Field(..., description="Relative storage path where file is saved")
    upload_timestamp: datetime = Field(..., description="Timestamp of when the upload occurred")
    status: str = Field(..., description="Current processing status (e.g. pending, parsed, extracted, normalized, done, failed)")
    raw_text: Optional[str] = Field(default=None, description="Extracted raw text from PDF/image")
    error_message: Optional[str] = Field(default=None, description="Error message if processing failed")
    message: str = Field(default="File uploaded successfully", description="Status message")

    model_config = ConfigDict(from_attributes=True)


class UploadStatusResponse(BaseModel):
    id: int = Field(..., description="Unique ID of the uploaded record")
    type: str = Field(..., description="Category/source type of the upload")
    filename: str = Field(..., description="Original filename")
    status: str = Field(..., description="Current status: pending, parsed, extracted, normalized, done, or failed")
    error_message: Optional[str] = Field(default=None, description="Error message if status is failed")
    upload_timestamp: datetime = Field(..., description="Timestamp of when the upload occurred")
    message: Optional[str] = Field(default=None, description="Detailed stage or progress message")

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Extraction Validation Models per Source Type
# ==========================================

class TimetableItem(BaseModel):
    day: str = Field(..., description="Day of the week (e.g., Monday, Tue)")
    start_time: Optional[str] = Field(default="", description="Start time (e.g. 09:00 AM or 09:00)")
    end_time: Optional[str] = Field(default="", description="End time (e.g. 10:30 AM or 10:30)")
    subject: str = Field(..., description="Subject, course name, event title, or milestone")
    location: Optional[str] = Field(default=None, description="Room number, lab, or hall")
    date: Optional[str] = Field(default=None, description="Specific date if mentioned in document, e.g. YYYY-MM-DD or DD.MM.YYYY")
    end_date: Optional[str] = Field(default=None, description="Specific end date if date range, e.g. YYYY-MM-DD or DD.MM.YYYY")
    type: Optional[str] = Field(default=None, description="Event type: holiday, exam, academic_event, class_session")


class SyllabusItem(BaseModel):
    subject: str = Field(..., description="Course name or subject code")
    topic: str = Field(..., description="Topic or unit module name")
    weightage: Optional[str | int | float] = Field(default=None, description="Marks, percentage, or credit weightage")


class AssignmentItem(BaseModel):
    subject: str = Field(..., description="Course or subject name")
    title: str = Field(..., description="Assignment title or deliverable name")
    deadline: str = Field(..., description="Due date/time")
    rubric_notes: Optional[str] = Field(default=None, description="Instructions, grading criteria, or guidelines")


class CalendarEventItem(BaseModel):
    name: str = Field(..., description="Event, festival, holiday, or club meeting name")
    start_date: str = Field(..., description="Start date (e.g., YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="End date (if multi-day event)")
    description: Optional[str] = Field(default=None, description="Event description or notes")


class ExtractedDataResponse(BaseModel):
    id: int = Field(..., description="Unique ID of the extracted data record")
    upload_id: int = Field(..., description="Foreign key to the uploads record")
    type: str = Field(..., description="Type of extracted data")
    data: list[dict] = Field(..., description="Validated structured items")
    created_at: datetime = Field(..., description="Extraction timestamp")
    message: str = Field(default="Data extracted and validated successfully", description="Status message")

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Normalized Data Store Schemas (Events & Tasks)
# ==========================================

class EventResponse(BaseModel):
    id: int
    source_upload_id: Optional[int] = None
    title: str
    type: str
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    subject: Optional[str] = None
    location: Optional[str] = None
    weightage: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskResponse(BaseModel):
    id: int
    source_upload_id: Optional[int] = None
    title: str
    type: str
    deadline: Optional[datetime] = None
    subject: Optional[str] = None
    weightage: Optional[str] = None
    description: Optional[str] = None
    priority_score: Optional[int] = 50
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NormalizationResponse(BaseModel):
    upload_id: int
    type: str
    events_inserted: int = 0
    events_updated: int = 0
    tasks_inserted: int = 0
    tasks_updated: int = 0
    total_processed: int = 0
    message: str = "Normalization completed successfully."


class TaskPriorityItem(BaseModel):
    task_id: int
    title: str
    subject: Optional[str] = None
    type: str
    deadline: Optional[str] = None
    weightage: Optional[str] = None
    priority_score: int
    status: str


class PriorityRecalculationResponse(BaseModel):
    tasks_updated: int
    highest_priority_task: Optional[TaskPriorityItem] = None
    tasks: list[TaskPriorityItem] = []
    message: str = "Priority scores recalculated successfully."


# ==========================================
# AI Scheduling Schemas
# ==========================================

class ScheduledSlotItem(BaseModel):
    task_id: int = Field(..., description="ID of the task to be scheduled")
    scheduled_date: str = Field(..., description="Date formatted as YYYY-MM-DD")
    scheduled_start_time: str = Field(..., description="Start time formatted as HH:MM")
    scheduled_end_time: str = Field(..., description="End time formatted as HH:MM")


class ScheduledSlotResponse(BaseModel):
    id: int
    task_id: int
    task_title: Optional[str] = None
    subject: Optional[str] = None
    scheduled_date: str
    start_time: str
    end_time: str
    status: str
    slot_type: Optional[str] = "regular"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExamPlannerResponse(BaseModel):
    task_id: int
    exam_title: str
    subject: Optional[str] = None
    exam_date: str
    intervals_planned: list[int]
    sessions_created: int
    conflicts_resolved: int = 0
    study_sessions: list[ScheduledSlotResponse] = []
    message: str = "Exam study plan generated successfully."


class ScheduleGenerationResponse(BaseModel):
    slots_created: int
    tasks_scheduled: int
    scheduled_slots: list[ScheduledSlotResponse]
    conflicts_resolved: int = 0
    flagged_tasks: list[int] = []
    message: str = "AI schedule generated successfully."


# ==========================================
# Conflict Resolver Schemas
# ==========================================

class ConflictLogResponse(BaseModel):
    id: int
    slot_id: Optional[int] = None
    task_id: int
    conflicting_event_id: Optional[int] = None
    conflict_type: str
    original_date: str
    original_start_time: str
    original_end_time: str
    resolved_action: str
    new_date: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConflictResolutionResult(BaseModel):
    conflicts_detected: int
    conflicts_rescheduled: int
    conflicts_removed: int
    conflict_logs: list[ConflictLogResponse] = []
    message: str = "Conflict resolution completed successfully."


# ==========================================
# Frontend Consumable REST API Models
# ==========================================

class FrontendSlotDetail(BaseModel):
    id: int
    task_id: int
    task_title: Optional[str] = None
    task: Optional[str] = None          # Frontend compatibility alias
    subject: Optional[str] = None
    category: Optional[str] = None      # Frontend compatibility alias
    scheduled_date: str
    start_time: str
    end_time: str
    scheduledSlot: Optional[str] = None # e.g. '2026-09-08 12:00 - 13:00'
    status: str
    slot_type: str = "regular"          # 'regular' or 'study_session'
    priority_score: Optional[int] = None
    urgency: Optional[str] = "medium"   # 'low' | 'medium' | 'high'
    deadline: Optional[datetime] = None
    event_id: Optional[int] = None      # Optional linked event ID
    event_title: Optional[str] = None   # Optional linked event title
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FrontendTaskDetail(BaseModel):
    id: int
    title: str
    task: str                           # Frontend compatibility alias
    subject: Optional[str] = None
    category: Optional[str] = None      # Frontend compatibility alias
    type: str
    deadline: Optional[datetime] = None
    deadline_formatted: Optional[str] = None # 'YYYY-MM-DD HH:MM'
    weightage: Optional[str] = None
    description: Optional[str] = None
    priority_score: int = 50
    urgency: str = "medium"             # 'low' | 'medium' | 'high'
    status: str
    completed: bool = False             # Frontend compatibility boolean
    scheduledSlot: Optional[str] = None # Primary slot string for frontend table view
    scheduled_slots: list[FrontendSlotDetail] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FrontendEventDetail(BaseModel):
    id: int
    source_upload_id: Optional[int] = None
    title: str
    name: str                           # Frontend compatibility alias
    type: str
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    subject: Optional[str] = None
    category: Optional[str] = None      # Frontend compatibility alias
    location: Optional[str] = None
    weightage: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Courses & Syllabus Schemas
# ==========================================

class CourseBase(BaseModel):
    code: str
    name: str
    credits: int = 4
    syllabus_covered_pct: int = 0
    next_exam: Optional[str] = None
    exam_date: Optional[str] = None
    color: str = "#2563EB"
    semester: str = "Fall 2026"


class CourseCreate(CourseBase):
    pass


class CourseSyllabusUpdate(BaseModel):
    syllabus_covered_pct: int


class CourseResponse(CourseBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Focus Sessions Schemas
# ==========================================

class FocusSessionCreate(BaseModel):
    task_id: Optional[int] = None
    mode: str = "POMODORO"              # 'POMODORO', 'DEEP_WORK', 'SHORT_BREAK'
    duration_seconds: int = 1500
    completed: bool = True
    target_name: Optional[str] = None


class FocusSessionResponse(BaseModel):
    id: int
    task_id: Optional[int] = None
    mode: str
    duration_seconds: int
    completed: bool
    target_name: Optional[str] = None
    started_at: datetime
    completed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FocusStatsResponse(BaseModel):
    today_sessions_count: int
    today_focus_seconds: int
    today_focus_minutes: int
    streak_days: int
    recent_sessions: list[FocusSessionResponse] = []





