import os
import sys
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import models
from services.gemini_extractor import analyze_document_comprehensive

def test_holiday_extraction_and_commit():
    print("=== Testing LifeSync Holiday Extraction & Ingestion ===")

    sample_doc = """CS450: Distributed Systems (Fall 2026)
Instructor: Prof. Sarah Jenkins
Lectures: Monday and Wednesday 10:00 - 11:30 AM (Auditorium Hall B)

University Holidays and Recesses:
- Fall Break: Oct 12 - Oct 14, 2026 (Campus Closed)
- Thanksgiving Recess: Nov 26 - Nov 29, 2026 (No Classes)

Key Deadlines:
- Midterm Exam on Oct 21, 2026 at 10:00 AM
- Raft Consensus Assignment due Oct 28, 2026 at 23:59"""

    # 1. Test analyze_document_comprehensive extraction
    analysis = analyze_document_comprehensive(sample_doc)
    assert analysis is not None
    assert "holidays" in analysis, "Expected 'holidays' key in analysis output"
    print(f"Extracted {len(analysis['holidays'])} holiday(s):")
    for h in analysis["holidays"]:
        print(f"  - {h.get('name')} | Dates: {h.get('start_date')} to {h.get('end_date')} | Type: {h.get('type')}")
    assert len(analysis["holidays"]) >= 2, f"Expected at least 2 holidays, got {len(analysis['holidays'])}"

    # 2. Test committing holidays to DB via /api/ai/commit-extracted
    client = TestClient(app)
    login_res = client.get("/api/auth/google/login", follow_redirects=False)
    cookies = login_res.cookies

    payload = {
        "assignments": analysis["assignments"],
        "exams": analysis["exams"],
        "events": [],
        "holidays": analysis["holidays"]
    }

    commit_res = client.post("/api/ai/commit-extracted", json=payload, cookies=cookies)
    assert commit_res.status_code == 200, f"Commit failed: {commit_res.text}"
    data = commit_res.json()
    print(f"Commit response: {data}")
    assert data["status"] == "success"

    # 3. Verify in database
    db = SessionLocal()
    try:
        events = db.query(models.Event).filter(models.Event.type == "holiday").all()
        assert len(events) >= 2, f"Expected at least 2 holiday events in DB, found {len(events)}"
        print(f"Verified {len(events)} holiday event(s) in SQLite database:")
        for ev in events:
            print(f"  - Event ID {ev.id}: {ev.title} ({ev.start_datetime} to {ev.end_datetime}) [type={ev.type}]")
    finally:
        db.close()

    print("\n[ALL HOLIDAY EXTRACTION & INGESTION TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    test_holiday_extraction_and_commit()
