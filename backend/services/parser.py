import os
import shutil
from pathlib import Path
from typing import Optional
from PIL import Image

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


class ParserError(Exception):
    """Custom exception raised when document extraction fails."""
    pass


def get_tesseract_command() -> Optional[str]:
    """
    Locates the Tesseract executable path on the system.
    Checks environment variables, system PATH, and standard Windows install directories.
    """
    # 1. User-configured environment variable
    custom_cmd = os.getenv("TESSERACT_CMD")
    if custom_cmd and os.path.exists(custom_cmd):
        return custom_cmd

    # 2. Check system PATH
    which_tesseract = shutil.which("tesseract")
    if which_tesseract:
        return which_tesseract

    # 3. Common Windows installation locations
    common_windows_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%ProgramW6432%\Tesseract-OCR\tesseract.exe"),
    ]

    for path in common_windows_paths:
        if os.path.exists(path):
            return path

    return None


def is_tesseract_available() -> bool:
    """Returns True if the Tesseract binary is located and usable."""
    return get_tesseract_command() is not None


def extract_text_from_pdf(filepath: str) -> str:
    """
    Extracts text from a PDF document.
    1. Primary: Uses pdfplumber to parse text layout.
    2. Fallback: Uses pypdf if pdfplumber yields no text.
    3. Scanned PDF fallback: Uses Tesseract OCR per-page image if available.
    """
    file_path = Path(filepath)
    if not file_path.exists():
        raise ParserError(f"File not found at '{filepath}'")

    extracted_pages = []

    # 1. Primary extraction with pdfplumber
    if pdfplumber:
        try:
            with pdfplumber.open(file_path) as pdf:
                for idx, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        extracted_pages.append(f"--- Page {idx + 1} ---\n{page_text.strip()}")
        except Exception as e:
            # Fall back to pypdf if pdfplumber encounters a structural issue
            pass

    # 2. Fallback extraction with pypdf
    if not extracted_pages and pypdf:
        try:
            reader = pypdf.PdfReader(str(file_path))
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    extracted_pages.append(f"--- Page {idx + 1} ---\n{page_text.strip()}")
        except Exception as e:
            pass

    # 3. Fallback for scanned PDF without text layer: OCR via Tesseract if installed
    if not extracted_pages and pdfplumber and pytesseract and is_tesseract_available():
        tess_cmd = get_tesseract_command()
        pytesseract.pytesseract.tesseract_cmd = tess_cmd
        tess_dir = os.path.dirname(tess_cmd)
        tessdata_dir = os.path.join(tess_dir, "tessdata")
        if os.path.exists(tessdata_dir) and "TESSDATA_PREFIX" not in os.environ:
            os.environ["TESSDATA_PREFIX"] = tessdata_dir
        try:
            with pdfplumber.open(file_path) as pdf:
                for idx, page in enumerate(pdf.pages):
                    # Render page to PIL image at 200 DPI for OCR
                    pil_img = page.to_image(resolution=200).original
                    ocr_text = pytesseract.image_to_string(pil_img)
                    if ocr_text and ocr_text.strip():
                        extracted_pages.append(f"--- Page {idx + 1} (OCR) ---\n{ocr_text.strip()}")
        except Exception as e:
            pass

    if not extracted_pages:
        # If still empty, determine if it was a scanned document
        if not is_tesseract_available():
            raise ParserError(
                "PDF contains no extractable digital text layer (it may be a scanned PDF). "
                "Optical Character Recognition (OCR) requires Tesseract OCR installed on the system. "
                "Install on Windows using: winget install UB-Mannheim.TesseractOCR"
            )
        else:
            return "[No text detected in PDF]"

    return "\n\n".join(extracted_pages)


def extract_text_from_image(filepath: str) -> str:
    """
    Extracts text from an image document using Pillow and pytesseract.
    Raises a clear ParserError if Tesseract OCR is not installed.
    """
    file_path = Path(filepath)
    if not file_path.exists():
        raise ParserError(f"File not found at '{filepath}'")

    if not pytesseract:
        raise ParserError("pytesseract library is not installed.")

    tess_cmd = get_tesseract_command()
    if not tess_cmd:
        raise ParserError(
            "Tesseract OCR is not installed or not found in system PATH. "
            "To parse image files, install Tesseract OCR on Windows with: "
            "'winget install UB-Mannheim.TesseractOCR', then restart the server."
        )

    pytesseract.pytesseract.tesseract_cmd = tess_cmd
    tess_dir = os.path.dirname(tess_cmd)
    tessdata_dir = os.path.join(tess_dir, "tessdata")
    if os.path.exists(tessdata_dir) and "TESSDATA_PREFIX" not in os.environ:
        os.environ["TESSDATA_PREFIX"] = tessdata_dir

    try:
        with Image.open(file_path) as img:
            text = pytesseract.image_to_string(img)
            trimmed = text.strip()
            return trimmed if trimmed else "[No text detected in image]"
    except Exception as exc:
        raise ParserError(f"Image OCR failed: {str(exc)}")


def extract_text(filepath: str) -> str:
    """
    Unified entry point to extract text from a PDF or image file based on extension.
    """
    ext = Path(filepath).suffix.lower()

    if ext == ".pdf":
        return extract_text_from_pdf(filepath)
    elif ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}:
        return extract_text_from_image(filepath)
    else:
        raise ParserError(f"Unsupported file type for text extraction: '{ext}'")


def parse_academic_calendar_text(raw_text: str) -> list[dict]:
    """
    Extracts dated academic events, holidays, exams, and milestones from text containing
    patterns like '04.06.2025 Wednesday | Course wish list registration by students'
    or '09.06.2025 to 20.06.2025 | Monday to Friday Course allocation and scheduling by Schools'.
    """
    if not raw_text or not raw_text.strip():
        return []

    import re
    import dateutil.parser

    cleaned = raw_text.replace('{', '').replace('|', ' ')
    # Normalize line breaks between multi-line date ranges:
    cleaned = re.sub(
        r'(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+to\s*(?:\|\s*)?(?:[A-Za-z]+\s+to\s*)?\n\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})',
        r'\1 to \2',
        cleaned
    )

    DATE_PAT = r'(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:\s+to\s+(\d{1,2}[./-]\d{1,2}[./-]\d{4}))?'
    WEEKDAY_PAT = r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)'

    results = []
    seen = set()

    for line in cleaned.splitlines():
        line = line.strip()
        if not line or 'VIT/VLR' in line or 'attendance' in line.lower():
            continue

        m = re.search(DATE_PAT, line)
        if not m:
            continue

        raw_start = m.group(1)
        raw_end = m.group(2)

        try:
            start_dt_obj = dateutil.parser.parse(raw_start, dayfirst=True)
            iso_start = start_dt_obj.strftime('%Y-%m-%d')
        except Exception:
            continue

        iso_end = None
        if raw_end:
            try:
                end_dt_obj = dateutil.parser.parse(raw_end, dayfirst=True)
                iso_end = end_dt_obj.strftime('%Y-%m-%d')
            except Exception:
                pass

        day_match = re.search(WEEKDAY_PAT, line, re.I)
        day_str = day_match.group(1).capitalize() if day_match else start_dt_obj.strftime('%A')

        remainder = line[m.end():].strip()
        cleaned_title = re.sub(
            r'^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|to|\s|\|)+',
            '',
            remainder,
            flags=re.I
        ).strip()
        cleaned_title = re.sub(r'^[–—\-:\s|]+', '', cleaned_title).strip()
        cleaned_title = cleaned_title.replace('\u2019', "'").replace('\u2018', "'").replace('\ufffd', '-').strip()

        if not cleaned_title or len(cleaned_title) < 3 or cleaned_title.startswith('(Friday)'):
            continue

        t_low = cleaned_title.lower()
        if any(w in t_low for w in ['(holiday)', 'holiday', 'no instructional day', 'vacation', 'recess', 'break', 'puja', 'pooja', 'jayanthi', 'deepavali', 'diwali']):
            ev_type = 'holiday'
        elif re.search(r'\b(cat\b|fat\b|exam|test|midterm|quiz|assessment|assessment test)\b', t_low):
            ev_type = 'exam'
        elif any(w in t_low for w in ['registration', 'commencement', 'withdraw', 'add/drop', 'fee', 'gravitas', 'fest', 'allocation', 'instructional day']):
            ev_type = 'academic_event'
        else:
            ev_type = 'academic_event'

        key = (iso_start, cleaned_title)
        if key in seen:
            continue
        seen.add(key)

        results.append({
            'day': day_str,
            'start_time': '09:00',
            'end_time': '17:00',
            'subject': cleaned_title,
            'location': None,
            'date': iso_start,
            'end_date': iso_end,
            'type': ev_type
        })

    return results
