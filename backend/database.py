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
        
        # Helper to safely add column if missing
        def add_column_if_missing(table, col_name, col_type):
            if table in table_names:
                cols = [c["name"] for c in inspector.get_columns(table)]
                if col_name not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                    conn.commit()

        add_column_if_missing("uploads", "raw_text", "TEXT")
        add_column_if_missing("uploads", "error_message", "TEXT")
        add_column_if_missing("uploads", "user_id", "INTEGER REFERENCES users(id)")

        add_column_if_missing("tasks", "priority_score", "INTEGER DEFAULT 50")
        add_column_if_missing("tasks", "user_id", "INTEGER REFERENCES users(id)")

        add_column_if_missing("events", "weightage", "VARCHAR(50)")
        add_column_if_missing("events", "user_id", "INTEGER REFERENCES users(id)")

        add_column_if_missing("scheduled_slots", "slot_type", "VARCHAR(50) DEFAULT 'regular'")
        add_column_if_missing("scheduled_slots", "user_id", "INTEGER REFERENCES users(id)")

        add_column_if_missing("courses", "user_id", "INTEGER REFERENCES users(id)")
        add_column_if_missing("focus_sessions", "user_id", "INTEGER REFERENCES users(id)")

        add_column_if_missing("user_google_tokens", "access_token", "VARCHAR(500)")
        add_column_if_missing("user_google_tokens", "refresh_token", "VARCHAR(500)")
        add_column_if_missing("user_google_tokens", "token_uri", "VARCHAR(255)")
        add_column_if_missing("user_google_tokens", "client_id", "VARCHAR(255)")
        add_column_if_missing("user_google_tokens", "client_secret", "VARCHAR(255)")
        add_column_if_missing("user_google_tokens", "scopes", "VARCHAR(500)")
        add_column_if_missing("user_google_tokens", "expiry", "DATETIME")


try:
    ensure_db_schema()
except Exception as _e:
    pass


