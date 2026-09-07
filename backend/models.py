import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    google_id = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    picture_url = Column(String(500), nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"


class UserGoogleToken(Base):
    __tablename__ = "user_google_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    tokens_json = Column(Text, nullable=True, default="{}")
    access_token = Column(String(500), nullable=True)
    refresh_token = Column(String(500), nullable=True)
    token_uri = Column(String(255), nullable=True)
    client_id = Column(String(255), nullable=True)
    client_secret = Column(String(255), nullable=True)
    scopes = Column(String(500), nullable=True)
    expiry = Column(DateTime, nullable=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = relationship("User", backref="google_token_record")

    def __repr__(self):
        return f"<UserGoogleToken(id={self.id}, user_id={self.user_id}, access_token={'yes' if self.access_token else 'no'})>"


class UploadType(str, enum.Enum):
    TIMETABLE = "timetable"
    SYLLABUS = "syllabus"
    ASSIGNMENTS = "assignments"
    HOLIDAY_CALENDAR = "holiday_calendar"
    FEST_SCHEDULE = "fest_schedule"
    CLUB_CALENDAR = "club_calendar"


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String(50), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    upload_timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    status = Column(String(50), default="pending", nullable=False)
    raw_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    user = relationship("User", backref="uploads")

    def __repr__(self):
        return f"<Upload(id={self.id}, user_id={self.user_id}, type='{self.type}', filename='{self.filename}', status='{self.status}')>"


class ExtractedData(Base):
    __tablename__ = "extracted_data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    data = Column(JSON, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    upload = relationship("Upload", backref="extracted_records")

    def __repr__(self):
        return f"<ExtractedData(id={self.id}, upload_id={self.upload_id}, type='{self.type}')>"


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # class_session, holiday, fest, club_event
    start_datetime = Column(DateTime, nullable=True, index=True)
    end_datetime = Column(DateTime, nullable=True)
    subject = Column(String(100), nullable=True, index=True)
    location = Column(String(255), nullable=True)
    weightage = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="scheduled", nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = relationship("User", backref="events")
    upload = relationship("Upload", backref="normalized_events")

    def __repr__(self):
        return f"<Event(id={self.id}, user_id={self.user_id}, title='{self.title}', type='{self.type}', start='{self.start_datetime}')>"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    source_upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # assignment, study_topic, exam_work
    deadline = Column(DateTime, nullable=True, index=True)
    subject = Column(String(100), nullable=True, index=True)
    weightage = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    priority_score = Column(Integer, default=50, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = relationship("User", backref="tasks")
    upload = relationship("Upload", backref="normalized_tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, user_id={self.user_id}, title='{self.title}', priority={self.priority_score}, deadline='{self.deadline}')>"


class ScheduledSlot(Base):
    __tablename__ = "scheduled_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(20), nullable=False)                  # HH:MM
    end_time = Column(String(20), nullable=False)                    # HH:MM
    status = Column(String(50), default="active", nullable=False)
    slot_type = Column(String(50), default="regular", nullable=False)  # regular, study_session
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = relationship("User", backref="scheduled_slots")
    task = relationship("Task", backref="scheduled_slots")

    def __repr__(self):
        return f"<ScheduledSlot(id={self.id}, user_id={self.user_id}, task_id={self.task_id}, date='{self.scheduled_date}', {self.start_time}-{self.end_time}, status='{self.status}')>"


class ConflictLog(Base):
    __tablename__ = "conflict_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slot_id = Column(Integer, ForeignKey("scheduled_slots.id", ondelete="SET NULL"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    conflicting_event_id = Column(Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    conflict_type = Column(String(50), nullable=False)  # overlap_fest, overlap_holiday, overlap_club_event
    original_date = Column(String(20), nullable=False)
    original_start_time = Column(String(20), nullable=False)
    original_end_time = Column(String(20), nullable=False)
    resolved_action = Column(String(50), nullable=False)  # rescheduled, removed_no_slot
    new_date = Column(String(20), nullable=True)
    new_start_time = Column(String(20), nullable=True)
    new_end_time = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    task = relationship("Task", backref="conflict_logs")
    conflicting_event = relationship("Event", backref="conflicts_caused")

    def __repr__(self):
        return f"<ConflictLog(id={self.id}, task_id={self.task_id}, action='{self.resolved_action}')>"


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    credits = Column(Integer, default=4, nullable=False)
    syllabus_covered_pct = Column(Integer, default=0, nullable=False)
    next_exam = Column(String(100), nullable=True)
    exam_date = Column(String(50), nullable=True)
    color = Column(String(20), default="#2563EB", nullable=False)
    semester = Column(String(50), default="Fall 2026", nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self):
        return f"<Course(id={self.id}, code='{self.code}', syllabus={self.syllabus_covered_pct}%)>"


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    mode = Column(String(50), default="POMODORO", nullable=False)  # POMODORO, DEEP_WORK, SHORT_BREAK
    duration_seconds = Column(Integer, default=1500, nullable=False)
    completed = Column(Boolean, default=True, nullable=False)
    target_name = Column(String(255), nullable=True)
    started_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    completed_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    task = relationship("Task", backref="focus_sessions")

    def __repr__(self):
        return f"<FocusSession(id={self.id}, mode='{self.mode}', duration={self.duration_seconds}s, completed={self.completed})>"
