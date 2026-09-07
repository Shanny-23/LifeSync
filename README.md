# LifeSync - AI-Powered Academic & Task Management

LifeSync is an intelligent full-stack academic assistant and schedule synchronization platform designed for students and educators. It automatically ingests schedules, syllabi, exam dates, and campus event calendars via OCR and Claude AI entity extraction, predicts deadline urgency, prevents collisions, and intelligently schedules study blocks into free periods.

---

## 🌟 Key Features

- **Automated Document Ingestion Pipeline**:
  - Drag-and-drop support for PDF academic timetables, exam schedules, and syllabus circulars.
  - Native digital text extraction (`pdfplumber`) and OCR fallback (`pytesseract`).
  - LLM entity normalization and natural-key deduplication.
- **Dynamic Urgency Scoring**:
  - Automatically calculates real-time priority scores based on deadline proximity and syllabus weightage.
- **AI-Powered Schedule Engine**:
  - Computes available gaps between classes and commitments.
  - Automatically places targeted study sessions and task slots into free windows.
- **Intelligent Conflict Resolution**:
  - Detects clashes between exams/tasks and campus fests or university holidays.
  - Automatically reschedules impacted sessions and maintains a transparent resolution audit log.
- **Spaced Repetition Exam Planner**:
  - Breaks major exams (e.g., CAT, FAT) into progressive, multi-day spaced review blocks.
- **Modern Responsive Dashboard**:
  - Full React + Vite UI with real-time stats, interactive calendar schedule views, and instant sync.

---

## 🏗 Architecture & Tech Stack

- **Frontend**:
  - React 18, Vite, Lucide Icons, Modern Responsive CSS
  - Port: `http://localhost:5173`
- **Backend**:
  - Python FastAPI, SQLAlchemy, SQLite (`lifesync.db`), Pydantic v2, Uvicorn
  - Port: `http://127.0.0.1:8000`
  - Docs: `http://127.0.0.1:8000/docs`
- **AI & Processing**:
  - Anthropic Claude Sonnet for entity extraction & scheduling optimization
  - `pdfplumber`, `pypdf`, `pytesseract` for multi-modal document extraction

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env   # Update your ANTHROPIC_API_KEY if using AI features
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** to access the application.

---

## 🧪 Testing

Run backend tests:
```powershell
cd backend
pytest -v
```

---

## 📄 License
MIT License.
