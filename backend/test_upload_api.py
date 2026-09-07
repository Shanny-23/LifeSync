import os
import io
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models

VALID_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
    b"5 0 obj << /Length 44 >> stream\n"
    b"BT\n/F1 24 Tf\n100 700 Td\n(CS101 Fall 2026 Timetable) Tj\nET\n"
    b"endstream\nendobj\n"
    b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000298 00000 n \n"
    b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n393\n%%EOF\n"
)


def run_tests():
    print("=== Running Upload API Tests ===")

    # 2. Test Client setup with lifespan
    with TestClient(app) as client:
        # 1. Verify tables in database
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"Database tables found: {tables}")
        assert "uploads" in tables, f"Expected 'uploads' table in {tables}"
        print(" Table 'uploads' exists in SQLite database.")

        # 3. Test valid upload: Timetable PDF
        pdf_content = VALID_PDF_BYTES
        response = client.post(
            "/api/upload",
            data={"type": "timetable"},
            files={"file": ("fall_2026_timetable.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        print(f"POST /api/upload (timetable PDF) -> HTTP {response.status_code}")
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"Response: {data}")
        assert data["id"] > 0
        assert data["type"] == "timetable"
        assert data["filename"] == "fall_2026_timetable.pdf"
        assert data["status"] == "pending"
        assert "filepath" in data
        assert os.path.exists(data["filepath"]), f"Uploaded file not found at {data['filepath']}"
        print(" Timetable PDF successfully saved to disk and recorded in DB.")

        # 4. Test valid upload: Syllabus PNG
        img_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        response = client.post(
            "/api/upload",
            data={"type": "syllabus"},
            files={"file": ("cse101_syllabus.png", io.BytesIO(img_content), "image/png")}
        )
        print(f"POST /api/upload (syllabus PNG) -> HTTP {response.status_code}")
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data2 = response.json()
        assert data2["id"] > data["id"]
        assert data2["type"] == "syllabus"
        print(" Syllabus PNG successfully uploaded and recorded.")

        # 5. Test all 6 types
        valid_types = [
            "timetable",
            "syllabus",
            "assignments",
            "holiday_calendar",
            "fest_schedule",
            "club_calendar"
        ]
        for t in valid_types:
            resp = client.post(
                "/api/upload",
                data={"type": t},
                files={"file": (f"{t}_doc.pdf", io.BytesIO(pdf_content), "application/pdf")}
            )
            assert resp.status_code == 201, f"Failed for type {t}: {resp.text}"
        print(f" All 6 upload types verified: {valid_types}")

        # 6. Test invalid type
        resp_invalid_type = client.post(
            "/api/upload",
            data={"type": "invalid_type_name"},
            files={"file": ("doc.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )
        print(f"POST /api/upload (invalid type) -> HTTP {resp_invalid_type.status_code}")
        assert resp_invalid_type.status_code == 422, f"Expected 422, got {resp_invalid_type.status_code}"
        print(" Invalid type correctly rejected with HTTP 422.")

        # 7. Test unsupported file extension
        resp_invalid_file = client.post(
            "/api/upload",
            data={"type": "assignments"},
            files={"file": ("malicious.exe", io.BytesIO(b"executable"), "application/x-msdownload")}
        )
        print(f"POST /api/upload (invalid extension) -> HTTP {resp_invalid_file.status_code}")
        assert resp_invalid_file.status_code == 400, f"Expected 400, got {resp_invalid_file.status_code}"
        print(" Invalid file extension correctly rejected with HTTP 400.")

        # 8. Test list uploads
        resp_list = client.get("/api/uploads")
        assert resp_list.status_code == 200
        uploads_list = resp_list.json()
        print(f"Total uploaded records in DB: {len(uploads_list)}")
        assert len(uploads_list) >= 8

        # 9. Verify in database session directly
        db = SessionLocal()
        try:
            db_records = db.query(models.Upload).all()
            print(f"Direct DB query confirmed {len(db_records)} records in 'uploads' table.")
            for r in db_records[:3]:
                print(f"  - Record #{r.id}: type={r.type}, file={r.filename}, path={r.filepath}, status={r.status}")
        finally:
            db.close()

        print("\n ALL TESTS PASSED SUCCESSFULLY!")

def test_upload():
    run_tests()


if __name__ == "__main__":
    run_tests()
