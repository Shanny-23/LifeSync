import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Use isolated test database so production lifesync.db is never cleared by tests
os.environ["DATABASE_URL"] = "sqlite:///./test_lifesync.db"

from database import ensure_db_schema, SessionLocal
import models

ensure_db_schema()

# Seed default test user if needed
db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == "test_google_oauth@example.com").first()
    if not user:
        user = models.User(
            google_id="test-sub-123456",
            email="test_google_oauth@example.com",
            name="Test OAuth User",
            picture_url="https://example.com/avatar.png"
        )
        db.add(user)
        db.commit()
finally:
    db.close()
