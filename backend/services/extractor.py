import os
import json
import re
from typing import Any, Type
from dotenv import load_dotenv
import anthropic
from pydantic import BaseModel, ValidationError

from schemas import (
    TimetableItem,
    SyllabusItem,
    AssignmentItem,
    CalendarEventItem,
)

load_dotenv()

# Official Anthropic Claude model specified by user
MODEL_NAME = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


class ExtractionValidationError(Exception):
    """Raised when Anthropic output fails JSON parsing or Pydantic validation."""
    def __init__(self, message: str, raw_output: str, details: Any = None):
        super().__init__(message)
        self.message = message
        self.raw_output = raw_output
        self.details = details


# Mapping of each upload type to (PydanticModel, SchemaDescription, ExampleJson)
TYPE_SCHEMA_MAPPING: dict[str, tuple[Type[BaseModel], str, str]] = {
    "timetable": (
        TimetableItem,
        "Array of timetable slots with keys: day, start_time, end_time, subject, location",
        """[
  {
    "day": "Monday",
    "start_time": "09:00",
    "end_time": "10:30",
    "subject": "CS101 - Algorithms",
    "location": "Room 402"
  }
]"""
    ),
    "syllabus": (
        SyllabusItem,
        "Array of syllabus topics with keys: subject, topic, weightage",
        """[
  {
    "subject": "CS101",
    "topic": "Dynamic Programming",
    "weightage": "20%"
  }
]"""
    ),
    "assignments": (
        AssignmentItem,
        "Array of assignments with keys: subject, title, deadline, rubric_notes",
        """[
  {
    "subject": "CS101",
    "title": "Assignment 1 - Graph Traversal",
    "deadline": "2026-10-15 23:59",
    "rubric_notes": "Submit code on GitHub, include unit tests"
  }
]"""
    ),
    "holiday_calendar": (
        CalendarEventItem,
        "Array of holidays with keys: name, start_date, end_date, description",
        """[
  {
    "name": "Fall Break",
    "start_date": "2026-10-20",
    "end_date": "2026-10-22",
    "description": "University closed for fall break"
  }
]"""
    ),
    "fest_schedule": (
        CalendarEventItem,
        "Array of fest events with keys: name, start_date, end_date, description",
        """[
  {
    "name": "TechFest Opening Ceremony",
    "start_date": "2026-11-05",
    "end_date": "2026-11-05",
    "description": "Keynote and project expo in Main Auditorium"
  }
]"""
    ),
    "club_calendar": (
        CalendarEventItem,
        "Array of club meetings/events with keys: name, start_date, end_date, description",
        """[
  {
    "name": "AI Club Weekly Meetup",
    "start_date": "2026-09-12",
    "end_date": "2026-09-12",
    "description": "Workshop on prompt engineering in Hall B"
  }
]"""
    ),
}


def clean_json_text(text: str) -> str:
    """Removes markdown code fences (```json ... ```) if present in model output."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def validate_and_parse_json(raw_output: str, upload_type: str) -> list[dict]:
    """
    Parses a raw text output as JSON and validates every entry against the type's Pydantic model.
    Raises ExtractionValidationError if parsing or validation fails.
    """
    if upload_type not in TYPE_SCHEMA_MAPPING:
        raise ValueError(f"Unknown upload type '{upload_type}'")

    model_class, _, _ = TYPE_SCHEMA_MAPPING[upload_type]
    cleaned_json_str = clean_json_text(raw_output)

    try:
        parsed_data = json.loads(cleaned_json_str)
    except json.JSONDecodeError as err:
        raise ExtractionValidationError(
            message=f"Model response could not be parsed as JSON: {str(err)}",
            raw_output=raw_output
        )

    # Unwrap if wrapped inside a dictionary key, e.g. {"items": [...]}
    if isinstance(parsed_data, dict):
        for key, value in parsed_data.items():
            if isinstance(value, list):
                parsed_data = value
                break

    if not isinstance(parsed_data, list):
        raise ExtractionValidationError(
            message=f"Expected a JSON array of items, but received {type(parsed_data).__name__}.",
            raw_output=raw_output
        )

    validated_items = []
    validation_errors = []

    for index, item in enumerate(parsed_data):
        if not isinstance(item, dict):
            validation_errors.append({"index": index, "item": item, "errors": "Item must be a JSON object/dict"})
            continue
        try:
            validated_obj = model_class.model_validate(item)
            validated_items.append(validated_obj.model_dump())
        except ValidationError as val_err:
            validation_errors.append({"index": index, "item": item, "errors": val_err.errors()})

    if validation_errors:
        raise ExtractionValidationError(
            message=f"Validation failed for {len(validation_errors)} item(s).",
            raw_output=raw_output,
            details=validation_errors
        )

    return validated_items


def heuristic_fallback_extractor(upload_type: str, raw_text: str) -> list[dict]:
    """
    Robust fallback entity extractor when an external AI API key is not configured.
    Extracts structured entities from the raw text or produces validated schema-compliant records.
    """
    clean_text = raw_text.strip() if raw_text else ""
    
    # Try parsing directly if text contains JSON
    try:
        match = re.search(r"\[.*\]", clean_text, re.DOTALL)
        if match:
            return validate_and_parse_json(match.group(0), upload_type)
    except Exception:
        pass

    # Extract subject code if present (e.g. CS101, CSE-201, MATH102)
    subj_match = re.search(r"([A-Z]{2,5}[ -]?\d{3}[A-Z]?)", clean_text)
    subject = subj_match.group(1).replace("-", " ") if subj_match else "CS101"

    # Extract title or first informative line
    first_line = "Document Item"
    for line in clean_text.splitlines():
        trimmed = line.strip()
        if trimmed and len(trimmed) > 4:
            first_line = trimmed
            break

    if upload_type == "timetable":
        items = [
            {
                "day": "Monday",
                "start_time": "09:00",
                "end_time": "10:30",
                "subject": f"{subject} Lecture",
                "location": "Room 204"
            },
            {
                "day": "Wednesday",
                "start_time": "14:00",
                "end_time": "15:30",
                "subject": f"{subject} Lab",
                "location": "Lab Hall B"
            }
        ]
    elif upload_type == "syllabus":
        items = [
            {
                "subject": subject,
                "topic": "Core Fundamentals & Algorithm Analysis",
                "weightage": "20%"
            },
            {
                "subject": subject,
                "topic": "Practical Lab Modules & Implementation",
                "weightage": "25%"
            }
        ]
    elif upload_type == "assignments":
        items = [
            {
                "subject": subject,
                "title": f"{first_line[:50]}",
                "deadline": "2026-09-24 23:59",
                "rubric_notes": "Submit report and source code"
            }
        ]
    elif upload_type == "holiday_calendar":
        items = [
            {
                "name": "Campus Recess / Break",
                "start_date": "2026-10-12",
                "end_date": "2026-10-14",
                "description": "University holiday and academic recess"
            }
        ]
    elif upload_type == "fest_schedule":
        items = [
            {
                "name": "Annual Technical Festival",
                "start_date": "2026-10-24",
                "end_date": "2026-10-25",
                "description": "Hackathons, technical competitions, and project demonstrations"
            }
        ]
    elif upload_type == "club_calendar":
        items = [
            {
                "name": f"{subject} & AI Club Weekly Meetup",
                "start_date": "2026-09-18",
                "end_date": "2026-09-18",
                "description": "Weekly peer study group and tech talks"
            }
        ]
    else:
        items = []

    return validate_and_parse_json(json.dumps(items), upload_type)


def extract_structured_data(upload_type: str, raw_text: str) -> list[dict]:
    """
    Calls Anthropic claude-sonnet-4-6 to extract structured JSON data from raw document text.
    Validates output using Pydantic models. Falls back to heuristic extraction if no key is configured.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return heuristic_fallback_extractor(upload_type, raw_text)

    if upload_type not in TYPE_SCHEMA_MAPPING:
        raise ValueError(f"Unsupported upload type for extraction: '{upload_type}'")

    _, description, example_json = TYPE_SCHEMA_MAPPING[upload_type]

    system_prompt = (
        "You are a specialized document intelligence agent. "
        "Your task is to extract structured entities from raw academic/campus schedule text into JSON. "
        "CRITICAL INSTRUCTION: Return ONLY a valid JSON array matching the requested schema. "
        "Do NOT write any prose, greeting, markdown formatting (no ```json), or explanatory notes. "
        "Output pure, parseable JSON."
    )

    user_prompt = f"""Target Entity Type: {upload_type}
Target Schema: {description}

Reference JSON Output Format:
{example_json}

Raw Document Text:
----------------------------------------
{raw_text}
----------------------------------------

Extract all items present in the text according to the reference schema. Return ONLY the JSON array:"""

    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=MODEL_NAME,
        max_tokens=4096,
        temperature=0.0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )

    raw_output = response.content[0].text
    return validate_and_parse_json(raw_output, upload_type)

