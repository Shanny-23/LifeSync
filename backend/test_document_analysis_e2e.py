import os
import json
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
import models
from services.extractor import extract_structured_data
from services.gemini_extractor import analyze_document_comprehensive

def test_document_analysis_and_commit():
    print("=== LifeSync Document Intelligence & Analysis E2E Tests ===")
    
    # 1. Test extractor.py directly with Groq
    print("\n1. Testing services/extractor.py with Groq AI...")
    assignment_doc = """CS301 Algorithms:
Assignment 1 - Divide and Conquer due 2026-10-10 23:59. Rubric: Full asymptotic analysis and unit tests.
Assignment 2 - Dynamic Programming due 2026-10-24 23:59. Rubric: Optimal memoization proofs."""
    
    extracted_assignments = extract_structured_data("assignments", assignment_doc)
    assert len(extracted_assignments) >= 1
    assert "CS301" in extracted_assignments[0]["subject"]
    assert "due" in extracted_assignments[0]["deadline"] or "2026" in extracted_assignments[0]["deadline"]
    print(f"   [PASS] extract_structured_data successfully parsed {len(extracted_assignments)} assignment items:")
    for a in extracted_assignments:
        print(f"          - {a.get('subject')}: {a.get('title')} (Due: {a.get('deadline')})")

    # 2. Test analyze_document_comprehensive
    print("\n2. Testing services/gemini_extractor.py analyze_document_comprehensive...")
    sample_syllabus = """CS450: Distributed Operating Systems (Fall 2026)
Instructor: Prof. Sarah Jenkins
Lectures: Monday and Wednesday 10:00 - 11:30 AM (Auditorium Hall B)
Lab Sessions: Friday 14:00 - 16:00 (Systems Lab 204)

Grading Distribution:
- Programming Labs (4 Major Labs): 30%
- Midterm Examination: 30%
- Final Distributed Project: 40%

Key Deadlines & Milestones:
- Lab 1: Multithreaded RPC Framework due Sep 28, 2026 at 23:59
- Lab 2: Raft Consensus State Machine due Oct 18, 2026 at 23:59
- Midterm Exam on Oct 21, 2026 at 10:00 AM
- Final Project Submission due Dec 02, 2026 at 23:59"""

    analysis = analyze_document_comprehensive(sample_syllabus)
    assert analysis is not None
    assert "course_info" in analysis
    assert "workload_analysis" in analysis
    assert "grading_breakdown" in analysis
    assert "syllabus_roadmap" in analysis
    assert "assignments" in analysis
    assert "exams" in analysis
    assert "schedule" in analysis

    print(f"   [PASS] Engine: {analysis.get('source')}")
    print(f"   [PASS] Course Info: {analysis['course_info']}")
    print(f"   [PASS] Workload: ~{analysis['workload_analysis'].get('estimated_weekly_hours')} hrs/wk | Intensity: {analysis['workload_analysis'].get('intensity_level')}")
    print(f"   [PASS] Grading Breakdown items: {len(analysis['grading_breakdown'])}")
    print(f"   [PASS] Assignments detected: {len(analysis['assignments'])}")
    print(f"   [PASS] Exams detected: {len(analysis['exams'])}")
    print(f"   [PASS] Lecture/Lab slots detected: {len(analysis['schedule'])}")
    print(f"   [PASS] Recommendations: {len(analysis.get('recommendations', []))}")

    # 3. Test HTTP /api/ai/analyze-document endpoint
    print("\n3. Testing FastAPI /api/ai/analyze-document endpoint...")
    client = TestClient(app)
    
    # Authenticate via demo endpoint or cookie
    login_res = client.get("/api/auth/google/login", follow_redirects=False)
    cookies = login_res.cookies

    res = client.post(
        "/api/ai/analyze-document",
        json={"text": sample_syllabus},
        cookies=cookies
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    api_analysis = res.json()
    assert "course_info" in api_analysis
    assert len(api_analysis["assignments"]) > 0
    print("   [PASS] POST /api/ai/analyze-document returned valid structured document intelligence")

    # 4. Test HTTP /api/ai/commit-extracted endpoint
    print("\n4. Testing /api/ai/commit-extracted and database persistence...")
    commit_payload = {
        "assignments": api_analysis["assignments"][:2],
        "exams": api_analysis["exams"][:1],
        "events": [
            {
                "title": f"{api_analysis['course_info'].get('course_code', 'CS450')} Lecture Session",
                "start_datetime": "2026-09-14T10:00:00",
                "end_datetime": "2026-09-14T11:30:00",
                "location": "Auditorium Hall B"
            }
        ]
    }

    commit_res = client.post(
        "/api/ai/commit-extracted",
        json=commit_payload,
        cookies=cookies
    )
    assert commit_res.status_code == 200, f"Expected 200, got {commit_res.status_code}: {commit_res.text}"
    commit_data = commit_res.json()
    assert commit_data["status"] == "success"
    assert commit_data["committed_tasks"] >= 3
    assert commit_data["committed_events"] >= 1
    print(f"   [PASS] Ingestion confirmed: {commit_data['committed_tasks']} tasks, {commit_data['committed_events']} events committed.")

    # 5. Verify directly in SQLite Database
    print("\n5. Verifying persistent database records...")
    db = SessionLocal()
    try:
        tasks = db.query(models.Task).filter(models.Task.title.like("%Lab 1%") | models.Task.title.like("%Midterm%")).all()
        assert len(tasks) > 0
        print(f"   [PASS] Found {len(tasks)} newly ingested task(s) directly in SQLite database:")
        for t in tasks:
            print(f"          - ID: {t.id} | {t.title} | Priority: {t.priority_score} | Status: {t.status}")
    finally:
        db.close()

    print("\n=== ALL DOCUMENT ANALYSIS E2E TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_document_analysis_and_commit()
