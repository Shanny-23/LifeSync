import pytest
from datetime import datetime, time
from services.parser import parse_academic_calendar_text
from services.normalizer import parse_flexible_datetime

SAMPLE_CIRCULAR_TEXT = """
VIT Vellore Institute of Technology
Fall Semester 2025–26 Academic Calendar
04.06.2025 Wednesday | Course wish list registration by students
09.06.2025 to 20.06.2025 | Monday to Friday Course allocation and scheduling by Schools
28.06.2025 Saturday Course registration by students
09.07.2025 Wednesday | Commencement of Fall Semester 2025-26
15.08.2025 Friday Independence Day (Holiday)
17.08.2025 to 23.08.2025 | Sunday to Saturday Continuous Assessment Test -1
27.08.2025 Wednesday | Vinayakar Chathurthi (Holiday)
01.10.2025 Wednesday | Ayutha Pooja (Holiday)
02.10.2025 Thursday Gandhi Jayanthi (Holiday)
05.10.2025 to 11.10.2025 | Sunday to Saturday Continuous Assessment Test - II
18.10.2025 to 26.10.2025 | Saturday to Sunday Deepavali (Holiday)
10.11.2025 to 14.11.2025 | Monday to Friday Final Assessment Test (FAT) for laboratory courses/ components
17.11.2025 to 04.12.2025 | Monday to Thursday Commencement of Final Assessment Test (FAT) for theory courses
21.12.2025 to 04.01.2026 | Sunday to Sunday Winter Vacation for the students (Tentative)
"""


def test_parse_flexible_datetime_iso_vs_dayfirst():
    # ISO strings should retain month and day correctly
    dt1 = parse_flexible_datetime("2025-10-02")
    assert dt1.year == 2025
    assert dt1.month == 10
    assert dt1.day == 2

    # DD.MM.YYYY should parse with day first
    dt2 = parse_flexible_datetime("02.10.2025")
    assert dt2.year == 2025
    assert dt2.month == 10
    assert dt2.day == 2

    dt3 = parse_flexible_datetime("04.06.2025")
    assert dt3.year == 2025
    assert dt3.month == 6
    assert dt3.day == 4


def test_academic_calendar_parser_exact_dates_and_types():
    items = parse_academic_calendar_text(SAMPLE_CIRCULAR_TEXT)
    assert len(items) >= 14

    by_title = {it["subject"]: it for it in items}

    # Verify registration milestone
    reg = by_title.get("Course wish list registration by students")
    assert reg is not None
    assert reg["date"] == "2025-06-04"
    assert reg["day"] == "Wednesday"
    assert reg["type"] == "academic_event"

    # Verify date range milestone
    alloc = by_title.get("Course allocation and scheduling by Schools")
    assert alloc is not None
    assert alloc["date"] == "2025-06-09"
    assert alloc["end_date"] == "2025-06-20"
    assert alloc["type"] == "academic_event"

    # Verify Independence Day holiday
    indep = by_title.get("Independence Day (Holiday)")
    assert indep is not None
    assert indep["date"] == "2025-08-15"
    assert indep["type"] == "holiday"

    # Verify CAT-1 exam
    cat1 = by_title.get("Continuous Assessment Test -1")
    assert cat1 is not None
    assert cat1["date"] == "2025-08-17"
    assert cat1["end_date"] == "2025-08-23"
    assert cat1["type"] == "exam"

    # Verify Vinayakar Chathurthi holiday
    vinayakar = by_title.get("Vinayakar Chathurthi (Holiday)")
    assert vinayakar is not None
    assert vinayakar["date"] == "2025-08-27"
    assert vinayakar["type"] == "holiday"

    # Verify Ayutha Pooja holiday
    ayutha = by_title.get("Ayutha Pooja (Holiday)")
    assert ayutha is not None
    assert ayutha["date"] == "2025-10-01"
    assert ayutha["type"] == "holiday"

    # Verify Gandhi Jayanthi holiday
    gandhi = by_title.get("Gandhi Jayanthi (Holiday)")
    assert gandhi is not None
    assert gandhi["date"] == "2025-10-02"
    assert gandhi["type"] == "holiday"

    # Verify Deepavali holiday range
    deepavali = by_title.get("Deepavali (Holiday)")
    assert deepavali is not None
    assert deepavali["date"] == "2025-10-18"
    assert deepavali["end_date"] == "2025-10-26"
    assert deepavali["type"] == "holiday"

    # Verify FAT exams
    fat = by_title.get("Final Assessment Test (FAT) for laboratory courses/ components")
    assert fat is not None
    assert fat["date"] == "2025-11-10"
    assert fat["end_date"] == "2025-11-14"
    assert fat["type"] == "exam"


def test_items_not_collapsed_to_same_wednesday():
    items = parse_academic_calendar_text(SAMPLE_CIRCULAR_TEXT)
    wednesday_items = [it for it in items if it["day"] == "Wednesday"]
    assert len(wednesday_items) >= 3

    dates = {it["date"] for it in wednesday_items}
    # Each Wednesday item MUST have a distinct date (June 4, July 9, Aug 27, Oct 1), NOT the same day!
    assert len(dates) == len(wednesday_items)
    assert "2025-06-04" in dates
    assert "2025-07-09" in dates
    assert "2025-08-27" in dates
    assert "2025-10-01" in dates
