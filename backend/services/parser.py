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
