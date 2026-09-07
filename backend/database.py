import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables
load_dotenv()

# Database connection URL (defaults to SQLite local database file)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lifesync.db")

# SQLite requires 'check_same_thread: False' to allow multiple threads to interact with the database.
# For other databases (PostgreSQL, MySQL), connect_args remains empty.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# SQLAlchemy Engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=os.getenv("SQL_ECHO", "False").lower() in ("true", "1")
)

# Session factory for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative Base for models
Base = declarative_base()


def get_db():
    """
    Dependency that yields an independent database session per request
    and automatically closes the session upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_db_schema():
    """Ensures all tables and dynamic migration columns exist across environments."""
    from sqlalchemy import inspect, text
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        if "uploads" in table_names:
            columns = [col["name"] for col in inspector.get_columns("uploads")]
            if "raw_text" not in columns:
                conn.execute(text("ALTER TABLE uploads ADD COLUMN raw_text TEXT"))
                conn.commit()
            if "error_message" not in columns:
                conn.execute(text("ALTER TABLE uploads ADD COLUMN error_message TEXT"))
                conn.commit()
        if "tasks" in table_names:
            columns = [col["name"] for col in inspector.get_columns("tasks")]
            if "priority_score" not in columns:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN priority_score INTEGER DEFAULT 50"))
                conn.commit()
        if "events" in table_names:
            columns = [col["name"] for col in inspector.get_columns("events")]
            if "weightage" not in columns:
                conn.execute(text("ALTER TABLE events ADD COLUMN weightage VARCHAR(50)"))
                conn.commit()
        if "scheduled_slots" in table_names:
            columns = [col["name"] for col in inspector.get_columns("scheduled_slots")]
            if "slot_type" not in columns:
                conn.execute(text("ALTER TABLE scheduled_slots ADD COLUMN slot_type VARCHAR(50) DEFAULT 'regular'"))
                conn.commit()

