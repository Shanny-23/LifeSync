import re
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session

import models


def parse_numeric_weightage(val: Any) -> Optional[float]:
    """Extracts a numeric float from strings like '25%', '30 points', '0.2', 15."""
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", val_str)
    if match:
        num = float(match.group(1))
        # If expressed as a 0-1 fraction (e.g. 0.25)
        if 0 < num < 1 and "%" not in val_str:
            num *= 100.0
        return min(max(num, 1.0), 100.0)
    return None


def resolve_task_weightage(task: models.Task, db: Session) -> float:
    """
    Resolves the weightage for a given task:
    1. Directly from task.weightage if present.
    2. Otherwise, looks up syllabus data linked by the same subject.
    3. Defaults to 20.0 if no syllabus weightage is available.
    """
    # 1. Direct task weightage
    direct_w = parse_numeric_weightage(task.weightage)
    if direct_w is not None:
        return direct_w

    if not task.subject:
        return 20.0

    # 2. Check normalized study topics from syllabus for the same subject
    syllabus_tasks = (
        db.query(models.Task)
        .filter(
            models.Task.subject == task.subject,
            models.Task.type == "study_topic",
            models.Task.weightage.isnot(None)
        )
        .all()
    )
    weights = [
        parse_numeric_weightage(st.weightage)
        for st in syllabus_tasks
        if parse_numeric_weightage(st.weightage) is not None
    ]
    if weights:
        # If task title matches a specific topic, prioritize that
        for st in syllabus_tasks:
            if st.title and task.title and (st.title.lower() in task.title.lower() or task.title.lower() in st.title.lower()):
                matched_w = parse_numeric_weightage(st.weightage)
                if matched_w:
                    return matched_w
        return sum(weights) / len(weights)

    # 3. Check raw extracted_data table for syllabus of that subject
    extracted_syllabus_records = (
        db.query(models.ExtractedData)
        .filter(models.ExtractedData.type == "syllabus")
        .all()
    )
    raw_weights = []
    for rec in extracted_syllabus_records:
        items = rec.data if isinstance(rec.data, list) else []
        for itm in items:
            if isinstance(itm, dict) and itm.get("subject") == task.subject:
                w = parse_numeric_weightage(itm.get("weightage"))
                if w is not None:
                    raw_weights.append(w)
    if raw_weights:
        return sum(raw_weights) / len(raw_weights)

    return 20.0  # Default baseline


def compute_deadline_proximity(deadline: Optional[datetime], ref_date: datetime) -> float:
    """
    Computes the deadline proximity factor on a [0, 100] scale.
    Scales up as the deadline approaches (inverse of days remaining).
    - Overdue or due today: 95 - 100.
    - Approaching smoothly via harmonic decay: 100 / (1 + 0.4 * days_remaining).
    - No deadline: baseline of 20.0.
    """
    if not deadline:
        return 20.0

    dl = deadline
    if dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    if ref_date.tzinfo is None:
        ref_date = ref_date.replace(tzinfo=timezone.utc)

    diff_seconds = (dl - ref_date).total_seconds()
    diff_days = diff_seconds / 86400.0

    if diff_days <= 0:
        # Overdue tasks are highest urgency
        return 100.0
    elif diff_days <= 1.0:
        # Due today / within 24 hours: scale smoothly from 90 to 100
        return 100.0 - (10.0 * diff_days)

    # Inverse scaling for upcoming days
    proximity = 90.0 / (1.0 + 0.35 * (diff_days - 1.0))
    return float(min(max(proximity, 5.0), 100.0))


def calculate_task_priority(
    task: models.Task,
    db: Session,
    ref_date: Optional[datetime] = None
) -> int:
    """
    Computes urgency_score = f(deadline_proximity, weightage).
    - deadline_proximity: scales up as deadline approaches (inverse of days remaining).
    - weightage: resolved from syllabus linked by subject.
    Returns integer priority score in range [1, 100].
    """
    if ref_date is None:
        ref_date = datetime.now(timezone.utc)

    # 1. Deadline proximity (0 - 100)
    proximity = compute_deadline_proximity(task.deadline, ref_date)

    # 2. Weightage from syllabus linked by subject (1 - 100)
    weightage = resolve_task_weightage(task, db)

    # 3. Composite urgency function: 65% proximity, 35% weightage
    # Extra type modifiers (assignments/exams carry slight additional importance)
    type_bonus = 0.0
    if task.type == "assignment":
        type_bonus = 5.0
    elif task.type == "exam_work":
        type_bonus = 10.0

    urgency_score = (0.65 * proximity) + (0.35 * weightage) + type_bonus
    final_score = int(round(min(max(urgency_score, 1.0), 100.0)))
    return final_score


def recalculate_all_priorities(
    db: Session,
    ref_date: Optional[datetime] = None,
    user_id: Optional[int] = None
) -> dict[str, Any]:
    """
    Recalculates priority_score for non-completed tasks in the database.
    Updates the database in place and returns summary statistics.
    """
    if ref_date is None:
        ref_date = datetime.now(timezone.utc)

    query = db.query(models.Task).filter(models.Task.status != "completed")
    if user_id is not None:
        query = query.filter((models.Task.user_id == user_id) | (models.Task.user_id == None))

    tasks = query.all()

    updated_records = []
    for task in tasks:
        new_score = calculate_task_priority(task, db, ref_date)
        task.priority_score = new_score
        updated_records.append({
            "task_id": task.id,
            "title": task.title,
            "subject": task.subject,
            "type": task.type,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "weightage": task.weightage,
            "priority_score": new_score,
            "status": task.status
        })

    db.commit()

    # Sort descending by priority score
    updated_records.sort(key=lambda x: x["priority_score"], reverse=True)
    highest_priority = updated_records[0] if updated_records else None

    return {
        "tasks_updated": len(updated_records),
        "highest_priority_task": highest_priority,
        "tasks": updated_records,
        "message": f"Successfully recalculated priority scores for {len(updated_records)} task(s)."
    }
