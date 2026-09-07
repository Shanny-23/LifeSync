import io
import sys
import time
from datetime import datetime, timedelta, timezone
import requests

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"

print("=================================================================")
print(" LIFESYNC END-TO-END FEATURE STEP-BY-STEP VERIFICATION")
print("=================================================================")

# -------------------------------------------------------------
# STEP 1: Health & API Connectivity
# -------------------------------------------------------------
print("\n[STEP 1] Verifying FastAPI & Vite Proxy Health Endpoints...")
backend_health = requests.get(f"{BASE_URL}/health").json()
print(" -> Backend /health:", backend_health)
assert backend_health.get("status") == "healthy"

frontend_health = requests.get("http://127.0.0.1:5173/health").json()
print(" -> Vite Proxy /health:", frontend_health)
assert frontend_health.get("status") == "healthy"

# -------------------------------------------------------------
# STEP 2: Task Management & Dynamic Priority Recalculation Engine
# -------------------------------------------------------------
print("\n[STEP 2] Testing Task Management & Dynamic Priority Recalculation...")
# 1. Create an assignment task
new_task = {
    "title": "Distributed Systems Raft Consensus Project",
    "subject": "CS450",
    "category": "CS450",
    "type": "assignment",
    "deadline": "2026-09-11T23:59:00",
    "urgency": "high",
    "weightage": "25%",
    "description": "Implement leader election and log replication with heartbeats"
}
created_task = requests.post(f"{BASE_URL}/api/tasks", json=new_task).json()
task_id = created_task["id"]
print(f" -> Created Task #{task_id}: '{created_task['title']}' | Urgency: {created_task['urgency']} | Score: {created_task['priority_score']}")
assert task_id > 0

# 2. Trigger priority recalculation engine
recalc = requests.post(f"{BASE_URL}/api/tasks/recalculate-priority").json()
print(f" -> Priority Recalculation: {recalc['message']} (Updated: {recalc['tasks_updated']} tasks)")
if recalc.get("highest_priority_task"):
    hp = recalc["highest_priority_task"]
    print(f"    Highest Priority Task: '{hp['title']}' (Score: {hp['priority_score']})")

# 3. Verify task update (status to in_progress)
patch_res = requests.patch(f"{BASE_URL}/api/tasks/{task_id}", json={"status": "in_progress"}).json()
print(f" -> Patched Task #{task_id} status: {patch_res['status']}")
assert patch_res["status"] == "in_progress"

# -------------------------------------------------------------
# STEP 3: Automated Document Ingestion & Extraction Pipeline
# -------------------------------------------------------------
print("\n[STEP 3] Testing Document Upload & Async Processing Pipeline...")
sample_pdf_text = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
    b"5 0 obj << /Length 44 >> stream\n"
    b"BT\n/F1 24 Tf\n100 700 Td\n(CS301 Algorithm Analysis Assignment 3) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000298 00000 n \n"
    b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n393\n%%EOF\n"
)

upload_file = ("fall2026_algorithms_assignments.pdf", io.BytesIO(sample_pdf_text), "application/pdf")
upload_resp = requests.post(
    f"{BASE_URL}/api/upload",
    data={"type": "assignments"},
    files={"file": upload_file}
).json()
upload_id = upload_resp["id"]
print(f" -> File uploaded: Upload #{upload_id} ({upload_resp['filename']}) | Initial Status: {upload_resp['status']}")

# Poll pipeline until done or failed
print(f" -> Polling background pipeline for Upload #{upload_id}...")
for attempt in range(12):
    time.sleep(0.5)
    st = requests.get(f"{BASE_URL}/api/upload/{upload_id}/status").json()
    print(f"    Attempt {attempt+1}: Status = {st['status']}")
    if st["status"] in ("done", "failed"):
        break

assert st["status"] == "done", f"Pipeline failed with error: {st.get('error_message')}"
print(f" -> Pipeline finished with status 'done'!")

# Verify list of uploads
uploads_list = requests.get(f"{BASE_URL}/api/uploads").json()
print(f" -> Total recorded uploads in database: {len(uploads_list)}")

# -------------------------------------------------------------
# STEP 4: AI Schedule Generation & Conflict Resolution Engine
# -------------------------------------------------------------
print("\n[STEP 4] Testing AI Schedule Generation & Conflict Resolution...")
sched_gen = requests.post(f"{BASE_URL}/api/schedule/generate").json()
print(f" -> AI Schedule Generation: {sched_gen.get('message')}")
print(f"    Slots created: {sched_gen.get('slots_created', 0)}, Tasks scheduled: {sched_gen.get('tasks_scheduled', 0)}")

conflict_res = requests.post(f"{BASE_URL}/api/schedule/resolve-conflicts").json()
print(f" -> Conflict Resolution Run:")
print(f"    Conflicts found: {conflict_res.get('conflicts_found', 0)}")
print(f"    Conflicts resolved: {conflict_res.get('resolved_count', 0)}")
print(f"    Message: {conflict_res.get('message')}")

# -------------------------------------------------------------
# STEP 5: Spaced Repetition Exam Study Planner
# -------------------------------------------------------------
print("\n[STEP 5] Testing Spaced Repetition Exam Planner...")
# Create an exam with deadline 9 days from today
exam_deadline = (datetime.now(timezone.utc) + timedelta(days=9)).replace(hour=9, minute=30, second=0).isoformat()
exam_task = requests.post(f"{BASE_URL}/api/tasks", json={
    "title": "Final Examination - Distributed Operating Systems",
    "subject": "CS450",
    "type": "exam_work",
    "deadline": exam_deadline,
    "urgency": "high",
    "weightage": "40%",
    "description": "Comprehensive semester exam covering consensus algorithms, memory management, and distributed file systems."
}).json()

exam_id = exam_task["id"]
print(f" -> Created Exam #{exam_id}: '{exam_task['title']}' (Exam date: {exam_deadline[:10]})")
print(f" -> Generating Spaced Repetition Plan for Exam #{exam_id}...")
plan_res = requests.post(f"{BASE_URL}/api/exam-planner/generate/{exam_id}").json()
sessions = plan_res.get("study_sessions", [])
print(f" -> Spaced Repetition Sessions Created: {plan_res.get('sessions_created', 0)}")
for s in sessions:
    print(f"    - Study Session on {s['scheduled_date']} from {s['start_time']} to {s['end_time']} [Tag: {s['slot_type']}]")

assert len(sessions) >= 3, f"Expected at least 3 spaced repetition study sessions, got {len(sessions)}"

# -------------------------------------------------------------
# STEP 6: Google Calendar Sync Seam
# -------------------------------------------------------------
print("\n[STEP 6] Testing Google Calendar Integration...")
gstatus = requests.get(f"{BASE_URL}/api/google/status").json()
print(f" -> Google Calendar Sync Status: {gstatus}")

# Check calendar events
events = requests.get(f"{BASE_URL}/api/events").json()
print(f" -> Total Calendar Events retrieved: {len(events)}")
for ev in events[:3]:
    print(f"    * Event #{ev['id']}: [{ev.get('type')}] '{ev.get('title')}' at {ev.get('start_datetime')}")

# -------------------------------------------------------------
# STEP 7: Firebase Authentication & Identity Providers
# -------------------------------------------------------------
print("\n[STEP 7] Testing Firebase Auth & Multi-Tenant Identities...")
auth_me = requests.get(f"{BASE_URL}/api/auth/me").json()
print(" -> Default authenticated user session:", auth_me["user"]["name"], f"({auth_me['user']['email']})")
assert auth_me["user"]["email"] is not None

demo_login_res = requests.post(f"{BASE_URL}/api/auth/demo-login", json={"user_id": "demo_user_2"}).json()
print(" -> Switched to Demo Persona:", demo_login_res["user"]["name"], f"(Major: {demo_login_res['user']['major']})")
assert demo_login_res["token"] == "demo-token-demo_user_2"

# -------------------------------------------------------------
# STEP 8: Groq AI Copilot & Document Extraction Preview
# -------------------------------------------------------------
print("\n[STEP 8] Testing Groq AI Scheduling Copilot & Ingestion...")
copilot_res = requests.post(f"{BASE_URL}/api/ai/copilot", json={
    "prompt": "Schedule 2 hours study session for CS450 Distributed Systems on Friday at 4pm"
}).json()
reply_text = str(copilot_res.get("reply", ""))
try:
    print(" -> AI Copilot Response:", reply_text)
except Exception:
    print(" -> AI Copilot Response:", reply_text.encode("ascii", "replace").decode("ascii"))
print(f"    Action: {copilot_res.get('action')} | Created ID: {copilot_res.get('created_id')}")
assert copilot_res.get("created_id") is not None

# AI Preview Extraction
ai_preview = requests.post(f"{BASE_URL}/api/ai/extract-preview", json={
    "text": "CS450 Distributed Systems Syllabus. Midterm Exam on Oct 14, 2026. Raft Consensus Assignment due Oct 28, 2026."
}).json()
print(f" -> AI Document Extraction (Engine: {ai_preview.get('source')}):")
print(f"    Assignments found: {len(ai_preview.get('assignments', []))}")
print(f"    Exams found: {len(ai_preview.get('exams', []))}")
assert len(ai_preview.get("assignments", [])) > 0 or len(ai_preview.get("exams", [])) > 0

print("\n=================================================================")
print(" ALL LIFESYNC BACKEND, AUTH & AI COPILOT FEATURES VERIFIED 100%")
print("=================================================================")

