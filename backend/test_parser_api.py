import io
import os
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from main import app
from database import engine, SessionLocal
import models

# Minimal valid PDF containing digital text
SAMPLE_PDF_BYTES = b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 44 >> stream
BT
/F1 24 Tf
100 700 Td
(CS101 Fall 2026 Timetable) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000298 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
393
%%EOF"""

def get_sample_png_bytes() -> bytes:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (300, 80), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((10, 30), "Math 101 Syllabus", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def run_parser_tests():
    print("=== Running Parser / OCR API Tests ===")

    with TestClient(app) as client:
        # 1. Verify schema column migration
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("uploads")]
        print(f"Columns in 'uploads' table: {columns}")
        assert "raw_text" in columns, "Column 'raw_text' should exist in 'uploads' table"
        print(" Column 'raw_text' successfully migrated into 'uploads' table.")

        # 2. Upload a PDF document
        upload_resp = client.post(
            "/api/upload",
            data={"type": "timetable"},
            files={"file": ("timetable.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")}
        )
        assert upload_resp.status_code == 201
        upload_data = upload_resp.json()
        upload_id = upload_data["id"]
        print(f" Uploaded PDF with ID #{upload_id}, status='{upload_data['status']}'")
        assert upload_data["status"] == "pending"

        # 3. Trigger POST /api/upload/{upload_id}/parse on the PDF
        parse_resp = client.post(f"/api/upload/{upload_id}/parse")
        print(f"POST /api/upload/{upload_id}/parse -> HTTP {parse_resp.status_code}")
        assert parse_resp.status_code == 200, f"Expected 200, got: {parse_resp.text}"
        parse_data = parse_resp.json()
        print(f"Parsed Response status: {parse_data['status']}")
        print(f"Extracted raw text preview:\n{parse_data['raw_text']}")
        assert parse_data["status"] == "parsed"
        assert "CS101 Fall 2026 Timetable" in parse_data["raw_text"]
        print(" PDF extraction verified successfully via pdfplumber/pypdf!")

        # 4. Verify in DB directly
        db = SessionLocal()
        try:
            db_record = db.query(models.Upload).filter(models.Upload.id == upload_id).first()
            assert db_record is not None
            assert db_record.status == "parsed"
            assert "CS101 Fall 2026 Timetable" in db_record.raw_text
            print(" Direct DB verification confirmed status='parsed' and raw_text stored.")
        finally:
            db.close()

        # 5. Test Non-existent upload_id error handling
        bad_resp = client.post("/api/upload/999999/parse")
        assert bad_resp.status_code == 404
        print(" Non-existent upload_id returns 404 Not Found.")

        # 6. Test Image upload and OCR error handling (when Tesseract binary not installed)
        img_upload_resp = client.post(
            "/api/upload",
            data={"type": "syllabus"},
            files={"file": ("syllabus.png", io.BytesIO(get_sample_png_bytes()), "image/png")}
        )
        assert img_upload_resp.status_code == 201
        img_id = img_upload_resp.json()["id"]

        img_parse_resp = client.post(f"/api/upload/{img_id}/parse")
        print(f"POST /api/upload/{img_id}/parse -> HTTP {img_parse_resp.status_code}")
        if img_parse_resp.status_code == 200:
            parsed_data = img_parse_resp.json()
            print(f" Tesseract OCR successfully parsed image! raw_text='{parsed_data['raw_text']}'")
            assert "Math 101" in parsed_data["raw_text"] or "Syllabus" in parsed_data["raw_text"]
            db = SessionLocal()
            try:
                rec = db.query(models.Upload).filter(models.Upload.id == img_id).first()
                assert rec.status == "parsed"
                print(" DB record status accurately updated to 'parsed'.")
            finally:
                db.close()
        elif img_parse_resp.status_code == 422:
            detail = img_parse_resp.json()["detail"]
            print(f" Graceful Tesseract guidance returned: {detail}")
            assert "Tesseract" in detail

    print("\n ALL PARSER / OCR TESTS COMPLETED SUCCESSFULLY!")


def test_parser():
    run_parser_tests()


if __name__ == "__main__":
    run_parser_tests()
