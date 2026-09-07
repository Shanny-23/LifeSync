import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models
from services.extractor import (
    validate_and_parse_json,
    clean_json_text,
    ExtractionValidationError,
)


def run_extractor_tests():
    print("=== Running Extractor Service & API Tests ===")

    # -------------------------------------------------------------
    # 1. Unit Tests for validate_and_parse_json()
    # -------------------------------------------------------------
    print("\n--- 1. Testing Schema Validation Logic ---")

    # 1a. Timetable validation
    valid_timetable_json = """[
        {"day": "Monday", "start_time": "09:00", "end_time": "10:30", "subject": "CS101", "location": "Hall 1"},
        {"day": "Tuesday", "start_time": "11:00", "end_time": "12:30", "subject": "CS102", "location": "Lab 2"}
    ]"""
    tt_items = validate_and_parse_json(valid_timetable_json, "timetable")
    assert len(tt_items) == 2
    assert tt_items[0]["subject"] == "CS101"
    print(" Timetable schema validation passed.")

    # 1b. Syllabus validation
    valid_syllabus_json = """[
        {"subject": "CS101", "topic": "Sorting Algorithms", "weightage": "15%"},
        {"subject": "CS101", "topic": "Graph Search", "weightage": 20}
    ]"""
    syl_items = validate_and_parse_json(valid_syllabus_json, "syllabus")
    assert len(syl_items) == 2
    print(" Syllabus schema validation passed.")

    # 1c. Assignments validation
    valid_assignments_json = """[
        {"subject": "CS101", "title": "Homework 1", "deadline": "2026-09-30", "rubric_notes": "Late penalty 10%"}
    ]"""
    asgn_items = validate_and_parse_json(valid_assignments_json, "assignments")
    assert len(asgn_items) == 1
    assert asgn_items[0]["title"] == "Homework 1"
    print(" Assignments schema validation passed.")

    # 1d. Calendar validation (holiday_calendar, fest_schedule, club_calendar)
    valid_calendar_json = """[
        {"name": "Diwali", "start_date": "2026-11-01", "end_date": "2026-11-03", "description": "Festival of lights"}
    ]"""
    cal_items = validate_and_parse_json(valid_calendar_json, "holiday_calendar")
    assert len(cal_items) == 1
    assert cal_items[0]["name"] == "Diwali"
    print(" Holiday/Fest/Club Calendar schema validation passed.")

    # 1e. Markdown Codeblock cleanup
    markdown_wrapped = """```json
    [
        {"day": "Wednesday", "start_time": "14:00", "end_time": "15:30", "subject": "Math", "location": "Room 10"}
    ]
    ```"""
    cleaned_items = validate_and_parse_json(markdown_wrapped, "timetable")
    assert len(cleaned_items) == 1
    print(" Markdown codeblock wrapper stripping passed.")

    # 1f. Malformed JSON handling
    try:
        validate_and_parse_json("This is not JSON at all!", "timetable")
        assert False, "Should have raised ExtractionValidationError"
    except ExtractionValidationError as err:
        assert "could not be parsed as JSON" in err.message
        assert err.raw_output == "This is not JSON at all!"
        print(" Malformed JSON gracefully raised ExtractionValidationError with raw_output.")

    # 1g. Schema violation handling (missing required field 'day')
    invalid_schema_json = """[{"start_time": "09:00", "end_time": "10:00", "subject": "CS"}]"""
    try:
        validate_and_parse_json(invalid_schema_json, "timetable")
        assert False, "Should have raised ExtractionValidationError"
    except ExtractionValidationError as err:
        assert "Validation failed" in err.message
        assert err.details is not None
        print(" Schema violation gracefully captured field error and raw_output.")

    # -------------------------------------------------------------
    # 2. Database & API Route Tests
    # -------------------------------------------------------------
    print("\n--- 2. Testing API Endpoints & DB Integration ---")

    with TestClient(app) as client:
        # 2a. Verify extracted_data table exists
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert "extracted_data" in tables, f"Expected 'extracted_data' table in {tables}"
        print(" Table 'extracted_data' exists in SQLite database.")

        # 2b. Test non-existent upload_id
        resp_404 = client.post("/api/upload/999999/extract")
        assert resp_404.status_code == 404
        print(" Non-existent upload_id returns 404.")

        # 2c. Create a test upload record in DB with no raw_text
        db = SessionLocal()
        test_upload = models.Upload(
            type="timetable",
            filename="sample_timetable.pdf",
            filepath="storage/uploads/test_timetable.pdf",
            status="pending",
            raw_text=None
        )
        db.add(test_upload)
        db.commit()
        db.refresh(test_upload)
        upload_id = test_upload.id
        db.close()

        # 2d. Attempt extraction when raw_text is missing
        resp_no_text = client.post(f"/api/upload/{upload_id}/extract")
        assert resp_no_text.status_code == 400
        print(f" Missing raw_text rejected with 400: '{resp_no_text.json()['detail']}'")

        # 2e. Update record with raw_text
        db = SessionLocal()
        rec = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
        rec.raw_text = "Monday 09:00 - 10:30 CS101 Algorithms Room 402\nTuesday 11:00 - 12:30 CS102 Systems Lab 1"
        rec.status = "parsed"
        db.commit()
        db.close()

        # 2f. Test Mocked Successful Claude Extraction (claude-sonnet-4-6)
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text=json.dumps([
                {"day": "Monday", "start_time": "09:00", "end_time": "10:30", "subject": "CS101 Algorithms", "location": "Room 402"},
                {"day": "Tuesday", "start_time": "11:00", "end_time": "12:30", "subject": "CS102 Systems", "location": "Lab 1"}
            ]))
        ]

        with patch("anthropic.Anthropic") as MockAnthropic, \
             patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-ant-test-key-12345"}):
            instance = MockAnthropic.return_value
            instance.messages.create.return_value = mock_response

            extract_resp = client.post(f"/api/upload/{upload_id}/extract")
            assert extract_resp.status_code == 201, f"Expected 201, got {extract_resp.status_code}: {extract_resp.text}"
            extract_data = extract_resp.json()
            print(f" POST /api/upload/{upload_id}/extract -> 201 Created!")
            print(f"  Extracted ID: {extract_data['id']}, Upload ID: {extract_data['upload_id']}")
            print(f"  Items count: {len(extract_data['data'])}")
            assert len(extract_data["data"]) == 2
            assert extract_data["data"][0]["subject"] == "CS101 Algorithms"

            # Check upload status updated in DB
            db = SessionLocal()
            updated_upload = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
            assert updated_upload.status == "extracted"
            print(" Upload record status transitioned to 'extracted'.")

            # Check extracted_data table directly
            saved_entry = db.query(models.ExtractedData).filter(models.ExtractedData.upload_id == upload_id).first()
            assert saved_entry is not None
            assert len(saved_entry.data) == 2
            print(" Direct DB query confirmed structured rows saved into 'extracted_data' table.")
            db.close()

        # 2g. Test GET /api/upload/{upload_id}/extracted
        get_extracted_resp = client.get(f"/api/upload/{upload_id}/extracted")
        assert get_extracted_resp.status_code == 200
        items_list = get_extracted_resp.json()
        assert len(items_list) >= 1
        print(" GET /api/upload/{upload_id}/extracted verified.")

        # 2h. Test Failed Model Validation -> 422 with raw_output included
        mock_bad_response = MagicMock()
        mock_bad_response.content = [
            MagicMock(text="Sorry, I cannot process this document because it is unclear.")
        ]

        with patch("anthropic.Anthropic") as MockAnthropic, \
             patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-ant-test-key-12345"}):
            instance = MockAnthropic.return_value
            instance.messages.create.return_value = mock_bad_response

            bad_extract_resp = client.post(f"/api/upload/{upload_id}/extract")
            assert bad_extract_resp.status_code == 422
            error_body = bad_extract_resp.json()
            print(f" Failed model output rejected with HTTP 422:")
            print(f"  Error message: {error_body['detail']['message']}")
            print(f"  Raw output returned for debugging: '{error_body['detail']['raw_output']}'")
            assert "raw_output" in error_body["detail"]
            assert error_body["detail"]["raw_output"] == "Sorry, I cannot process this document because it is unclear."

            # DB status updated to failed
            db = SessionLocal()
            failed_upload = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
            assert failed_upload.status == "failed"
            print(" Upload status set to 'failed' on validation failure.")
            db.close()

    print("\n ALL EXTRACTOR TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_extractor_tests()
