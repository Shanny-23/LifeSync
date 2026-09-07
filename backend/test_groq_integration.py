import json
from fastapi.testclient import TestClient
from main import app
from services.groq_service import (
    clean_groq_json_response,
    EXTRACTION_MODEL,
    REASONING_MODEL,
    get_groq_api_key
)
from services.gemini_extractor import (
    extract_academic_items_with_gemini,
    execute_app_management
)

def test_models_split():
    print("1. Checking Groq model assignments...")
    assert EXTRACTION_MODEL == "openai/gpt-oss-120b"
    assert REASONING_MODEL == "openai/gpt-oss-120b"
    print("   [PASS] EXTRACTION_MODEL:", EXTRACTION_MODEL)
    print("   [PASS] REASONING_MODEL:", REASONING_MODEL)


def test_clean_groq_json_response():
    print("\n2. Checking clean_groq_json_response helper...")
    # Test A: Plain JSON
    plain = '{"key": "value"}'
    assert json.loads(clean_groq_json_response(plain)) == {"key": "value"}
    print("   [PASS] Plain JSON parsed successfully")

    # Test B: Fenced JSON
    fenced = '```json\n{"course_code": "CS450", "course_title": "Distributed Systems"}\n```'
    parsed_fenced = json.loads(clean_groq_json_response(fenced))
    assert parsed_fenced["course_code"] == "CS450"
    print("   [PASS] Fenced ```json codeblock parsed successfully")

    # Test C: DeepSeek-R1 <think> reasoning tags before JSON
    deepseek_thought = """<think>
The student wants to add a new project for CS450 due next week.
Let's assign action 'create_task'.
</think>
```json
{
  "reply": "Added task CS450 Raft Project.",
  "action": "create_task",
  "params": {
    "title": "CS450 Raft Project",
    "subject": "CS450"
  }
}
```"""
    parsed_thought = json.loads(clean_groq_json_response(deepseek_thought))
    assert parsed_thought["action"] == "create_task"
    assert parsed_thought["params"]["title"] == "CS450 Raft Project"
    print("   [PASS] DeepSeek-R1 <think> tags stripped and final JSON block extracted")

    # Test D: DeepSeek-R1 raw conversational reasoning without fences
    conversational = """Here is my reasoning for this query:
First, check deadlines. Then return the JSON.
{"reply": "Everything is on track.", "action": "chat", "params": {}}
Let me know if you need anything else!"""
    parsed_conv = json.loads(clean_groq_json_response(conversational))
    assert parsed_conv["action"] == "chat"
    assert parsed_conv["reply"] == "Everything is on track."
    print("   [PASS] Conversational prefix/suffix stripped to extract JSON block")


def test_api_status_and_preview():
    print("\n3. Testing FastAPI endpoints with TestClient...")
    client = TestClient(app)

    # Login to get session
    login_res = client.get("/api/auth/google/login", follow_redirects=False)
    cookies = login_res.cookies

    # GET /api/ai/status
    status_res = client.get("/api/ai/status", cookies=cookies)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "openai/gpt-oss-120b" in status_data["model"]
    print("   [PASS] /api/ai/status reports Groq models:", status_data["model"], "| mode:", status_data["mode"])

    # POST /api/ai/extract-preview
    sample_text = "CS450 Distributed Operating Systems: Final Exam on Dec 12, 2026. Raft Assignment due Nov 05, 2026."
    preview_res = client.post("/api/ai/extract-preview", json={"text": sample_text}, cookies=cookies)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert "course_info" in preview_data
    assert "assignments" in preview_data
    assert "exams" in preview_data
    print("   [PASS] /api/ai/extract-preview returned structured schema:", preview_data.get("course_info"))

    # POST /api/ai/copilot
    copilot_res = client.post("/api/ai/copilot", json={"prompt": "what are my deadlines?"}, cookies=cookies)
    assert copilot_res.status_code == 200
    copilot_data = copilot_res.json()
    assert "reply" in copilot_data
    assert "action" in copilot_data
    print("   [PASS] /api/ai/copilot returned action:", copilot_data["action"], "| engine:", copilot_data.get("engine"))


if __name__ == "__main__":
    test_models_split()
    test_clean_groq_json_response()
    test_api_status_and_preview()
    print("\nALL GROQ INTEGRATION TESTS PASSED SUCCESSFULLY! [PASS]")
