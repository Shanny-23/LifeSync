import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_auth_me_default():
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert data["user"]["email"] == "alex.morgan@university.edu"

def test_auth_demo_users_list():
    response = client.get("/api/auth/demo-users")
    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert len(data["users"]) >= 2
    uids = [u["uid"] for u in data["users"]]
    assert "demo_user_1" in uids
    assert "demo_user_2" in uids

def test_auth_demo_login():
    response = client.post("/api/auth/demo-login", json={"user_id": "demo_user_2"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["token"] == "demo-token-demo_user_2"
    assert data["user"]["name"] == "Sarah Chen"

def test_auth_verify_token():
    response = client.post("/api/auth/verify", json={"token": "demo-token-demo_user_2"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["user"]["email"] == "sarah.chen@university.edu"

def test_ai_copilot_create_task():
    prompt = "Finish CS450 Raft consensus lab report due Friday at 5pm with high urgency"
    response = client.post("/api/ai/copilot", json={"prompt": prompt})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["action"] == "create_task"
    assert data["created_id"] is not None

def test_ai_copilot_create_event():
    prompt = "Robotics team weekly sync meeting tomorrow 4pm"
    response = client.post("/api/ai/copilot", json={"prompt": prompt})
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["action"] == "create_event"
    assert data["created_id"] is not None

def test_ai_copilot_greetings_no_task():
    # Verify 'hi' does NOT create dummy tasks
    response = client.post("/api/ai/copilot", json={"prompt": "hi"})
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "chat"
    assert "LifeSync AI Manager" in data["reply"] or "Hello" in data["reply"]
    assert data.get("created_id") is None

    # Verify 'lol' does NOT create dummy tasks
    res_lol = client.post("/api/ai/copilot", json={"prompt": "lol"})
    assert res_lol.status_code == 200
    data_lol = res_lol.json()
    assert data_lol["action"] == "chat"
    assert data_lol.get("created_id") is None

def test_ai_copilot_query_workload():
    response = client.post("/api/ai/copilot", json={"prompt": "What are my deadlines this week?"})
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "chat"
    assert "active workload" in data["reply"] or "workload" in data["reply"].lower()

def test_ai_extract_preview():
    text = "CS301 Algorithm Analysis: Midterm 1 on Oct 12, 2026. Homework 4 due Oct 19, 2026."
    response = client.post("/api/ai/extract-preview", json={"text": text})
    assert response.status_code == 200
    data = response.json()
    assert "assignments" in data
    assert "exams" in data
    assert len(data["assignments"]) > 0 or len(data["exams"]) > 0

def test_ai_commit_extracted():
    payload = {
        "assignments": [
            {
                "title": "Machine Learning Lab 3: Convolutional Networks",
                "subject": "CS380",
                "category": "Academic",
                "deadline": "2026-09-25T23:59:00",
                "urgency": "medium",
                "weightage": "15%",
                "description": "Implement PyTorch CNN architecture"
            }
        ],
        "exams": [
            {
                "title": "CS380 Midterm Exam",
                "date": "2026-10-05T09:30:00",
                "weightage": "30%",
                "description": "Midterm test on classification & optimization"
            }
        ],
        "events": []
    }
    response = client.post("/api/ai/commit-extracted", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["committed_tasks"] == 2
