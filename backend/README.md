# LifeSync - Python FastAPI Backend

FastAPI service for LifeSync task & schedule synchronization, featuring AI document extraction (Claude), natural-key deduplication, dynamic priority scoring, AI schedule generation, automated conflict resolution, spaced repetition exam study planning, and automated background ingestion pipelines.

## Project Structure

```
backend/
├── .env                    # Local environment configuration (API keys, ports)
├── .env.example            # Template for environment variables
├── requirements.txt        # Python dependencies
├── database.py             # SQLAlchemy engine, session maker, and schema migration
├── models.py               # Models: uploads, extracted_data, events, tasks, scheduled_slots, conflict_log
├── schemas.py              # Pydantic request/response schemas & frontend compatibility models
├── main.py                 # FastAPI application, background tasks pipeline & router mounts
├── routers/
│   ├── __init__.py
│   ├── schedule.py         # GET /api/schedule, GET /conflicts, POST /generate, POST /resolve-conflicts
│   ├── tasks.py            # GET /api/tasks, GET /{id}, POST /recalculate-priority
│   └── events.py           # GET /api/events, GET /{id}
├── services/
│   ├── __init__.py
│   ├── parser.py           # PDF extraction (pdfplumber/pypdf) & image OCR (pytesseract/Pillow)
│   ├── extractor.py        # Claude Sonnet entity extraction & Pydantic validation
│   ├── normalizer.py       # Deduplication & normalization into unified events/tasks tables
│   ├── priority.py         # Urgency calculator (deadline proximity + syllabus weightage)
│   ├── scheduler.py        # Free gap finder & Claude AI scheduling engine
│   ├── conflict_resolver.py# Collision detection against campus fests/holidays & dynamic rescheduling
│   └── exam_planner.py     # Spaced repetition study planner for exams (CAT/FAT)
├── tests/
│   ├── __init__.py
│   ├── fixtures/           # Test fixtures (sample_timetable.pdf)
│   └── test_pipeline.py    # Pytest end-to-end background pipeline integration test
├── storage/
│   └── uploads/            # Local disk storage for uploaded PDFs and images
└── README.md               # Documentation
```

## Setup & Running

### 1. Create and Activate a Virtual Environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Edit `.env` (or copy from `.env.example`):
GROQ_API_KEY=your_groq_api_key_here
GROQ_EXTRACTION_MODEL=llama-3.3-70b-versatile
GROQ_REASONING_MODEL=deepseek-r1-distill-llama-70b
DATABASE_URL=sqlite:///./lifesync.db
PORT=8000
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

### 4. Tesseract OCR (Optional for Image OCR)

For image OCR (`.png`, `.jpg`, `.jpeg`, `.webp`), Tesseract OCR is supported. Digital text PDFs work natively via `pdfplumber`/`pypdf`.

### 5. Run the Development Server

```powershell
uvicorn main:app --reload --port 8000
```

- API Base: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health Check: `GET http://localhost:8000/health`

## Key API Endpoints

### Automated Background Ingestion
- `POST /api/upload`: Upload file and automatically launch background pipeline (`parse` → `extract` → `normalize` → `done`).
- `GET /api/upload/{upload_id}/status`: Poll processing progress (`pending` → `parsed` → `extracted` → `normalized` → `done` or `failed`).

### Frontend REST API Layer
- `GET /api/schedule`: List active slots with joined task and event details. Supports `?from=YYYY-MM-DD&to=YYYY-MM-DD`, `?status=`, and `?slot_type=regular|study_session`.
- `GET /api/tasks`: List tasks with `priority_score`, `urgency` (`low`, `medium`, `high`), `status`, `completed`, and linked `scheduled_slots`. Supports `?category=`, `?urgency=`, and `?search=`.
- `GET /api/events`: List campus and academic events. Supports `?type=`, `?subject=`, and date range filters.

### AI Engines & Schedulers
- `POST /api/schedule/generate`: Claude AI scheduling into computed free slots.
- `POST /api/schedule/resolve-conflicts`: Resolves slot overlaps with campus fests/holidays and logs to `conflict_log`.
- `GET /api/schedule/conflicts`: Retrieves conflict resolution audit trail.
- `POST /api/tasks/recalculate-priority`: Recalculates urgency scores based on deadline proximity and syllabus weightage.
- `POST /api/exam-planner/generate/{task_id}`: Generates spaced repetition study sessions for exams.

## Running Tests

Run the full pytest integration test suite:
```powershell
pytest -v
```




