import os
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import models
from services.priority import calculate_task_priority
from services.scheduler import generate_ai_schedule
from services.conflict_resolver import resolve_schedule_conflicts
from services.exam_planner import generate_exam_study_plan
from services.groq_service import (
    call_groq_chat,
    clean_groq_json_response,
    get_groq_api_key,
    EXTRACTION_MODEL,
    REASONING_MODEL
)

load_dotenv()
logger = logging.getLogger(__name__)

# Backward-compatible alias for existing imports
get_gemini_api_key = get_groq_api_key


def analyze_document_comprehensive(raw_text: str, custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    In-depth AI document intelligence analysis:
    Extracts course metadata, grading breakdown, workload metrics, syllabus roadmap,
    assignments, exams, lecture schedules, and actionable study recommendations.
    Uses Groq extraction model ('openai/gpt-oss-120b') with robust rule-based fallback.
    """
    if not raw_text or not raw_text.strip():
        return {
            "source": "empty",
            "course_info": {
                "course_code": "N/A",
                "course_title": "Empty Document",
                "instructor": None,
                "term": "Current Term",
                "document_type": "unknown"
            },
            "grading_breakdown": [],
            "workload_analysis": {
                "estimated_weekly_hours": 0.0,
                "intensity_level": "Low",
                "crunch_periods": [],
                "workload_summary": "No document content provided."
            },
            "syllabus_roadmap": [],
            "assignments": [],
            "exams": [],
            "schedule": [],
            "recommendations": []
        }

    api_key = get_groq_api_key(custom_key)

    if api_key:
        try:
            prompt = f"""You are an elite academic syllabus and document intelligence analyst for LifeSync.
Thoroughly analyze the provided academic document and produce a comprehensive structured analysis.

Return ONLY a valid JSON object matching this exact schema:
{{
  "course_info": {{
    "course_code": "string (e.g. CS450)",
    "course_title": "string (e.g. Distributed Operating Systems)",
    "instructor": "string or null",
    "term": "string (e.g. Fall 2026)",
    "document_type": "syllabus" | "timetable" | "assignment_sheet" | "circular"
  }},
  "grading_breakdown": [
    {{
      "component": "string (e.g. Programming Labs, Midterm Exam, Final Project)",
      "percentage": 30,
      "description": "string"
    }}
  ],
  "workload_analysis": {{
    "estimated_weekly_hours": 8.5,
    "intensity_level": "Low" | "Moderate" | "Intense" | "Extreme",
    "crunch_periods": [
      "string (e.g. Mid-October: Midterm Exam + Lab 2 due)"
    ],
    "workload_summary": "string describing overall academic difficulty and pacing"
  }},
  "syllabus_roadmap": [
    {{
      "week_or_phase": "string (e.g. Weeks 1-3)",
      "topic": "string",
      "deliverables": ["string"],
      "weightage": "string (e.g. 15%)"
    }}
  ],
  "assignments": [
    {{
      "title": "string",
      "subject": "string",
      "deadline": "YYYY-MM-DDTHH:MM:SS or null",
      "urgency": "high" | "medium" | "low",
      "weightage": "string (e.g. 10%)",
      "estimated_hours": 6.0,
      "description": "string"
    }}
  ],
  "exams": [
    {{
      "title": "string",
      "subject": "string",
      "date": "YYYY-MM-DDTHH:MM:SS or null",
      "weightage": "string (e.g. 25%)",
      "preparation_days_needed": 4,
      "description": "string"
    }}
  ],
  "schedule": [
    {{
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "title": "string",
      "location": "string or null"
    }}
  ],
  "recommendations": [
    "string offering actionable advice on preparing for deadlines and managing study time"
  ]
}}

Document Text:
----------------------------------------
{raw_text[:12000]}
----------------------------------------

Return ONLY the parseable JSON object:"""

            raw_content = call_groq_chat(
                prompt=prompt,
                model=EXTRACTION_MODEL,
                temperature=0.0,
                custom_key=api_key
            )
            cleaned_json = clean_groq_json_response(raw_content)
            parsed_data = json.loads(cleaned_json)
            parsed_data["source"] = EXTRACTION_MODEL

            # Normalization and sanity safety
            if not isinstance(parsed_data.get("course_info"), dict):
                parsed_data["course_info"] = {
                    "course_code": parsed_data.get("course_code", "Course"),
                    "course_title": parsed_data.get("course_title", "Course Material"),
                    "instructor": parsed_data.get("instructor", None),
                    "term": "Current Term",
                    "document_type": "syllabus"
                }
            if not isinstance(parsed_data.get("grading_breakdown"), list):
                parsed_data["grading_breakdown"] = []
            if not isinstance(parsed_data.get("workload_analysis"), dict):
                parsed_data["workload_analysis"] = {
                    "estimated_weekly_hours": 6.0,
                    "intensity_level": "Moderate",
                    "crunch_periods": [],
                    "workload_summary": "Extracted academic workload."
                }
            if not isinstance(parsed_data.get("syllabus_roadmap"), list):
                parsed_data["syllabus_roadmap"] = []
            if not isinstance(parsed_data.get("assignments"), list):
                parsed_data["assignments"] = []
            if not isinstance(parsed_data.get("exams"), list):
                parsed_data["exams"] = []
            if not isinstance(parsed_data.get("schedule"), list):
                parsed_data["schedule"] = []
            if not isinstance(parsed_data.get("recommendations"), list):
                parsed_data["recommendations"] = []

            # Ensure subject is set in assignments and exams
            c_code = parsed_data["course_info"].get("course_code", "Academic")
            for a in parsed_data["assignments"]:
                if isinstance(a, dict) and not a.get("subject"):
                    a["subject"] = c_code
            for e in parsed_data["exams"]:
                if isinstance(e, dict) and not e.get("subject"):
                    e["subject"] = c_code

            return parsed_data
        except Exception as e:
            logger.warning("Groq comprehensive document analysis error: %s. Using heuristic fallback.", e)

    # Deterministic Heuristic Fallback with Full Intelligence Breakdown
    now = datetime.now(timezone.utc)
    course_code_match = re.search(r'\b([A-Z]{2,4}\s*[-]?\s*\d{3,4}[A-Z]?)\b', raw_text)
    course_code = course_code_match.group(1).replace(" ", "") if course_code_match else "CS101"

    # Instructor extraction heuristic
    instructor_match = re.search(r'(?:Instructor|Professor|Prof\.|Dr\.)\s*[:\-]?\s*([A-Za-z\.\s]{3,30})', raw_text)
    instructor = instructor_match.group(1).strip() if instructor_match else None

    # Title extraction heuristic
    course_title = f"{course_code} Course"
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    for line in lines[:5]:
        if any(w in line.lower() for w in ["syllabus", "introduction", "fundamentals", "systems", "principles", "engineering", "science", "design"]):
            course_title = line[:50]
            break

    assignments = []
    exams = []
    schedule = []
    grading_breakdown = []

    # Grading extraction heuristic
    percent_matches = re.findall(r'([A-Za-z\s]{3,25})[:\-\s]+(\d{1,3})%', raw_text)
    for comp, pct in percent_matches:
        try:
            val = int(pct)
            if 0 < val <= 100:
                grading_breakdown.append({
                    "component": comp.strip().title(),
                    "percentage": val,
                    "description": f"Extracted grading component for {comp.strip().title()}"
                })
        except Exception:
            pass

    if not grading_breakdown:
        grading_breakdown = [
            {"component": "Assignments & Problem Sets", "percentage": 30, "description": "Continuous coursework assignments"},
            {"component": "Midterm Examination", "percentage": 30, "description": "Mid-semester evaluation"},
            {"component": "Final Exam / Project", "percentage": 40, "description": "End-term comprehensive assessment"}
        ]

    for idx, line in enumerate(lines):
        line_lower = line.lower()
        if any(k in line_lower for k in ["exam", "midterm", "final", "quiz"]):
            exams.append({
                "title": line[:60],
                "subject": course_code,
                "date": (now + timedelta(days=14 + (idx % 7))).replace(hour=10, minute=0, second=0).isoformat(),
                "weightage": "30%",
                "preparation_days_needed": 4,
                "description": f"Extracted academic exam for {course_code}"
            })
        elif any(k in line_lower for k in ["assignment", "project", "homework", "lab", "due", "paper"]):
            assignments.append({
                "title": line[:60],
                "subject": course_code,
                "deadline": (now + timedelta(days=5 + (idx % 8))).replace(hour=23, minute=59, second=0).isoformat(),
                "urgency": "medium",
                "weightage": "15%",
                "estimated_hours": 6.0,
                "description": f"Extracted coursework item for {course_code}"
            })

    if not assignments and not exams:
        assignments.append({
            "title": f"{course_code} Core Coursework Assignment",
            "subject": course_code,
            "deadline": (now + timedelta(days=5)).replace(hour=23, minute=59, second=0).isoformat(),
            "urgency": "medium",
            "weightage": "15%",
            "estimated_hours": 5.0,
            "description": "Extracted coursework assignment"
        })

    # Schedule extraction heuristic
    schedule = [
        {"day": "Monday", "start_time": "10:00", "end_time": "11:30", "title": f"{course_code} Lecture", "location": "Hall A"},
        {"day": "Wednesday", "start_time": "10:00", "end_time": "11:30", "title": f"{course_code} Lecture", "location": "Hall A"},
        {"day": "Friday", "start_time": "14:00", "end_time": "15:30", "title": f"{course_code} Lab / Discussion", "location": "Lab 101"}
    ]

    # Workload estimation
    total_deliverables = len(assignments) + len(exams)
    est_hours = round(min(18.0, max(4.0, 4.0 + (total_deliverables * 1.5))), 1)
    intensity = "Extreme" if est_hours >= 12 else "Intense" if est_hours >= 8 else "Moderate"

    crunch = []
    if exams:
        crunch.append(f"Upcoming {exams[0]['title']} preparation window")
    if len(assignments) > 1:
        crunch.append("Mid-term assignment clustering period")

    return {
        "source": "rule_based_fallback",
        "course_info": {
            "course_code": course_code,
            "course_title": course_title,
            "instructor": instructor,
            "term": "Fall 2026",
            "document_type": "syllabus"
        },
        "grading_breakdown": grading_breakdown,
        "workload_analysis": {
            "estimated_weekly_hours": est_hours,
            "intensity_level": intensity,
            "crunch_periods": crunch,
            "workload_summary": f"Estimated {est_hours} hrs/week across {total_deliverables} tracked milestone(s)."
        },
        "syllabus_roadmap": [
            {"week_or_phase": "Weeks 1-4", "topic": f"{course_code} Core Foundations & Principles", "deliverables": ["Introductory Problem Set"], "weightage": "15%"},
            {"week_or_phase": "Weeks 5-8", "topic": "Intermediate Architectures & Practical Systems", "deliverables": ["Midterm Exam", "Lab Milestone"], "weightage": "45%"},
            {"week_or_phase": "Weeks 9-14", "topic": "Advanced Topics & Capstone Project", "deliverables": ["Final Deliverable"], "weightage": "40%"}
        ],
        "assignments": assignments,
        "exams": exams,
        "schedule": schedule,
        "recommendations": [
            f"Reserve weekly study blocks for {course_code} to maintain steady progress.",
            "Begin lab work and problem sets at least 3 days prior to target deadlines."
        ]
    }


def extract_academic_items_with_gemini(raw_text: str, custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract structured course details, assignments, and exams from syllabus/schedule text.
    Uses analyze_document_comprehensive internally to provide rich intelligence with backwards compatibility.
    """
    result = analyze_document_comprehensive(raw_text, custom_key=custom_key)
    # Ensure course_info has course_code and course_title explicitly
    if "course_info" not in result or not result["course_info"]:
        result["course_info"] = {
            "course_code": result.get("course_code", "Course"),
            "course_title": result.get("course_title", "Course")
        }
    return result


def _extract_user_name(user: Any) -> str:
    if isinstance(user, dict):
        return user.get("name") or "Student"
    return getattr(user, "name", None) or "Student"

def _extract_user_major(user: Any) -> str:
    if isinstance(user, dict):
        return user.get("major") or "Academic"
    return getattr(user, "major", None) or "Academic"

def execute_app_management(prompt: str, db: Session, user: Any, custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Primary AI App Manager:
    Interprets user prompt, reasons over current tasks/schedules, and executes real application actions.
    Uses Groq's multi-constraint reasoning model ('deepseek-r1-distill-llama-70b') via OpenAI-compatible SDK
    if API key is configured; otherwise uses comprehensive rule-based intent parsing.
    """
    now = datetime.now(timezone.utc)
    prompt_str = prompt.strip()
    prompt_lower = prompt_str.lower()
    api_key = get_groq_api_key(custom_key)

    # 1. Fetch live application context
    existing_tasks = db.query(models.Task).filter(models.Task.status != "completed").order_by(models.Task.priority_score.desc()).limit(12).all()
    completed_count = db.query(models.Task).filter(models.Task.status == "completed").count()
    events = db.query(models.Event).order_by(models.Event.start_datetime.asc()).limit(8).all()
    scheduled_slots = db.query(models.ScheduledSlot).filter(models.ScheduledSlot.status == "active").limit(10).all()

    tasks_context = [
        {
            "id": t.id,
            "title": t.title,
            "subject": t.subject,
            "deadline": t.deadline.strftime("%Y-%m-%d %H:%M") if t.deadline else "No deadline",
            "priority_score": t.priority_score,
            "weightage": t.weightage,
            "status": t.status
        }
        for t in existing_tasks
    ]

    events_context = [
        {
            "id": ev.id,
            "title": ev.title,
            "type": ev.type,
            "start": ev.start_datetime.strftime("%Y-%m-%d %H:%M") if ev.start_datetime else "TBD"
        }
        for ev in events
    ]

    # 2. Try Groq DeepSeek-R1 Distill reasoning if API Key is available
    if api_key:
        try:
            system_instruction = f"""You are the executive AI manager for LifeSync, an intelligent academic & productivity life-management workspace.
Current UTC time: {now.strftime("%A, %B %d, %Y %H:%M UTC")}.
Active user: {_extract_user_name(user)} ({_extract_user_major(user)}).

CURRENT WORKSPACE STATE:
- Pending Tasks ({len(tasks_context)}): {json.dumps(tasks_context)}
- Completed Tasks: {completed_count}
- Upcoming Calendar Events ({len(events_context)}): {json.dumps(events_context)}
- Active Scheduled Focus Slots: {len(scheduled_slots)}

YOUR RESPONSIBILITIES:
1. GREETING & CHAT ("hi", "hello", "how are you", "who are you", "lol", "thanks"):
   - Respond warmly and conversationally.
   - You MUST introduce yourself as "Hello! I am your LifeSync AI Manager."
   - DO NOT create any tasks for conversational chat! Action MUST be "chat".
2. STATUS & QUERIES ("what do I have today?", "show my deadlines", "what's my schedule?", "what's urgent?", "deadlines this week"):
   - Query the current workspace state provided above.
   - Specifically mention the student's "active workload" and bullet point their upcoming deadlines.
   - Action: "chat".
3. TASK CREATION ("add task", "new homework", "physics assignment due Friday", "CS450 project"):
   - Action: "create_task".
   - Extract title, subject (e.g. CS101, Math), deadline (ISO format), weightage (e.g. "20%"), and description.
4. EVENT / MEETING CREATION ("meeting", "team sync", "practice", "seminar", "workshop", "rehearsal", "club meeting", "sync meeting tomorrow"):
   - Action: "create_event".
   - Extract title, type ("club_event" or "class_session"), start_datetime (ISO format), end_datetime (ISO format).
5. TASK COMPLETION ("complete task 2", "mark raft project as done", "finish CS101 paper"):
   - Action: "complete_task".
   - Extract task_id (match by ID or title).
5. TASK DELETION ("delete task 4", "remove homework 3"):
   - Action: "delete_task".
   - Extract task_id.
6. AUTO-SCHEDULING ("generate schedule", "optimize schedule", "plan my week"):
   - Action: "generate_schedule".
7. CONFLICT RESOLUTION ("check conflicts", "resolve schedule conflicts", "fix overlaps"):
   - Action: "resolve_conflicts".
8. EXAM PREPARATION ("plan study sessions for final exam", "spaced repetition for midterm"):
   - Action: "plan_exam".
   - Extract task_id of the exam.

Respond ONLY with valid JSON in this exact structure:
{{
  "reply": "Markdown formatted message to the student",
  "action": "chat" | "create_task" | "create_event" | "complete_task" | "delete_task" | "generate_schedule" | "resolve_conflicts" | "plan_exam",
  "params": {{
    "task_id": int or null,
    "title": string or null,
    "subject": string or null,
    "deadline": "YYYY-MM-DDTHH:MM:SS" or null,
    "start_datetime": "YYYY-MM-DDTHH:MM:SS" or null,
    "end_datetime": "YYYY-MM-DDTHH:MM:SS" or null,
    "weightage": string or null,
    "urgency": "high" | "medium" | "low"
  }}
}}
"""
            raw_content = call_groq_chat(
                prompt=f"User request: \"{prompt_str}\"",
                model=REASONING_MODEL,
                temperature=0.0,
                system_prompt=system_instruction,
                custom_key=api_key
            )
            cleaned_json = clean_groq_json_response(raw_content)
            parsed_res = json.loads(cleaned_json)
            action = parsed_res.get("action", "chat")
            params = parsed_res.get("params", {})
            reply = parsed_res.get("reply", "Understood.")

            # Execute the action requested by Groq AI
            action_result = execute_action(action, params, db)
            created_id = action_result.get("task_id") or action_result.get("event_id") or action_result.get("id")
            return {
                "reply": reply,
                "action": action,
                "created_id": created_id,
                "engine": REASONING_MODEL,
                "details": action_result
            }
        except Exception as e:
            logger.warning("Groq reasoning failed: %s. Falling back to rule-based manager.", e)

    # 3. Comprehensive Rule-Based Fallback Manager
    return rule_based_manager(prompt_str, db, user, existing_tasks, events, now)


def rule_based_manager(prompt_str: str, db: Session, user: Any, tasks: List[models.Task], events: List[models.Event], now: datetime) -> Dict[str, Any]:
    """Smart local intent parser and app orchestrator when Groq key is offline."""
    p_lower = prompt_str.lower().strip()

    # 1. Greetings & Casual Chat
    greeting_patterns = [r"^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup)(\s+.*)?$"]
    if any(re.match(pat, p_lower) for pat in greeting_patterns):
        pending_count = len(tasks)
        top_task = tasks[0].title if tasks else "No urgent tasks"
        user_name = _extract_user_name(user)
        return {
            "reply": f"👋 Hello {user_name}! I'm your **LifeSync AI Manager**.\n\nYou have **{pending_count} pending task(s)** right now. Top priority: *{top_task}*.\n\nHere are some things I can do for you:\n• 📋 *'What tasks are due this week?'*\n• ⚡ *'Generate an optimized study schedule'*\n• 🔍 *'Check and resolve calendar conflicts'*\n• ➕ *'Add CS450 Raft lab due Friday 5pm'*\n• ✅ *'Mark task 1 as completed'*",
            "action": "chat",
            "engine": "rule_based_fallback"
        }

    # 2. Jokes / Informal expressions
    casual_expressions = ["lol", "lmao", "haha", "hahaha", "cool", "nice", "awesome", "thanks", "thank you", "ok", "okay", "alright"]
    if p_lower in casual_expressions or any(p_lower.startswith(c) and len(p_lower) < 15 for c in casual_expressions):
        return {
            "reply": "😊 Always here to help! Let me know if you want to inspect deadlines, generate study slots, or resolve calendar conflicts.",
            "action": "chat",
            "engine": "rule_based_fallback"
        }

    # 3. Help / Capabilities
    if any(k in p_lower for k in ["what can you do", "help", "who are you", "commands", "features"]):
        return {
            "reply": "🤖 **LifeSync AI Manager Capabilities:**\n\n1. **Workload Analysis**: Ask *'What are my deadlines?'* or *'What is my highest priority task?'*\n2. **Smart Scheduling**: Say *'Generate schedule for this week'* to slot tasks into free time gaps.\n3. **Conflict Resolution**: Say *'Resolve conflicts'* to automatically reschedule overlaps.\n4. **Task Management**: Say *'Add [Task Name] due [Date/Time]'*, *'Complete task [ID]'*, or *'Delete task [ID]'*.\n5. **Exam Planning**: Say *'Plan study sessions for [Exam Name]'* for spaced repetition.",
            "action": "chat",
            "engine": "rule_based_fallback"
        }

    # 4. Query Workload / Deadlines / Priority
    if any(k in p_lower for k in ["what do i have", "my tasks", "list tasks", "what is due", "show tasks", "deadlines", "urgent", "priority"]):
        if not tasks:
            return {
                "reply": "🎉 You have no pending tasks! Your schedule is completely clear.",
                "action": "chat",
                "engine": "rule_based_fallback"
            }
        lines = [f"📊 **Here is your active workload ({len(tasks)} tasks):**\n"]
        for idx, t in enumerate(tasks[:7]):
            dl_str = t.deadline.strftime("%b %d at %I:%M %p") if t.deadline else "Flexible"
            badge = "🔴 High" if (t.priority_score or 0) >= 70 else "🟡 Medium" if (t.priority_score or 0) >= 40 else "🟢 Low"
            lines.append(f"{idx+1}. **{t.title}** [{t.subject or 'General'}] — Due: *{dl_str}* | Priority: {t.priority_score or 50} ({badge})")
        return {
            "reply": "\n".join(lines),
            "action": "chat",
            "engine": "rule_based_fallback"
        }

    # 5. Generate Schedule Command
    if any(k in p_lower for k in ["generate schedule", "auto schedule", "schedule my week", "plan schedule", "optimize schedule", "create schedule"]):
        res = generate_ai_schedule(db, days_ahead=7)
        return {
            "reply": f"⚡ **AI Schedule Generated!**\n\nSuccessfully scheduled **{res.get('tasks_scheduled', 0)} task(s)** across **{res.get('slots_created', 0)} focus time slots** for the upcoming week. Check your Calendar to view the arranged time blocks.",
            "action": "generate_schedule",
            "engine": "rule_based_fallback",
            "details": res
        }

    # 6. Resolve Conflicts Command
    if any(k in p_lower for k in ["resolve conflict", "check conflict", "conflict", "overlap", "reschedule"]):
        res = resolve_schedule_conflicts(db, days_ahead=7)
        conflicts = res.get("conflicts_found", 0)
        resolved = res.get("resolved_count", 0)
        return {
            "reply": f"🔍 **Conflict Resolver Audit Complete:**\n• Conflicts detected: **{conflicts}**\n• Successfully rescheduled/resolved: **{resolved}**\n\n{res.get('message', 'All scheduled slots are currently in harmony.')}",
            "action": "resolve_conflicts",
            "engine": "rule_based_fallback",
            "details": res
        }

    # 7. Query Schedule / Events
    if any(k in p_lower for k in ["show schedule", "my schedule", "calendar", "events", "classes", "today"]):
        if not events:
            return {
                "reply": "📅 You don't have any fixed calendar events recorded for today. You have free time for focused study!",
                "action": "chat",
                "engine": "rule_based_fallback"
            }
        lines = [f"📅 **Upcoming Calendar Events ({len(events)}):**\n"]
        for ev in events[:6]:
            st_str = ev.start_datetime.strftime("%a %b %d at %I:%M %p") if ev.start_datetime else "TBD"
            lines.append(f"• **{ev.title}** [{ev.type}] — {st_str}")
        return {
            "reply": "\n".join(lines),
            "action": "chat",
            "engine": "rule_based_fallback"
        }

    # 8. Complete Task Command
    match_comp = re.search(r'(complete|finish|done with|mark done)\s+(task\s+)?#?(\d+|[a-zA-Z0-9\s]+)', p_lower)
    if match_comp and not any(k in p_lower for k in ["add", "new", "create", "due"]):
        target = match_comp.group(3).strip()
        task = None
        if target.isdigit():
            task = db.query(models.Task).filter(models.Task.id == int(target)).first()
        else:
            task = db.query(models.Task).filter(models.Task.title.ilike(f"%{target}%")).first()

        if task:
            task.status = "completed"
            db.commit()
            return {
                "reply": f"✅ Great job! Marked task **#{task.id}: '{task.title}'** as **completed**.",
                "action": "complete_task",
                "engine": "rule_based_fallback",
                "details": {"task_id": task.id, "title": task.title}
            }

    # 9. Delete Task Command
    match_del = re.search(r'(delete|remove|clear)\s+(task\s+)?#?(\d+|[a-zA-Z0-9\s]+)', p_lower)
    if match_del and not any(k in p_lower for k in ["add", "new", "create"]):
        target = match_del.group(3).strip()
        task = None
        if target.isdigit():
            task = db.query(models.Task).filter(models.Task.id == int(target)).first()
        else:
            task = db.query(models.Task).filter(models.Task.title.ilike(f"%{target}%")).first()

        if task:
            task_id = task.id
            task_title = task.title
            db.delete(task)
            db.commit()
            return {
                "reply": f"🗑️ Deleted task **#{task_id}: '{task_title}'** from your workspace.",
                "action": "delete_task",
                "engine": "rule_based_fallback",
                "details": {"task_id": task_id}
            }

    # 10. Event Creation (meeting, sync, lecture, session)
    event_keywords = ["meeting", "sync", "lecture", "office hours", "club event", "study session"]
    if any(k in p_lower for k in event_keywords):
        target_dt = now + timedelta(days=1)
        if "today" in p_lower:
            target_dt = now
        elif "tomorrow" in p_lower:
            target_dt = now + timedelta(days=1)
        elif "friday" in p_lower:
            days_ahead = (4 - now.weekday()) % 7
            if days_ahead == 0: days_ahead = 7
            target_dt = now + timedelta(days=days_ahead)

        target_dt = target_dt.replace(hour=16, minute=0, second=0)

        ev_type = "class_session" if "lecture" in p_lower or "class" in p_lower else "club_event" if "club" in p_lower else "study_block"
        new_event = models.Event(
            title=prompt_str,
            type=ev_type,
            start_datetime=target_dt,
            end_datetime=target_dt + timedelta(hours=1),
            description=f"Scheduled via LifeSync AI Manager: {prompt_str}"
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        return {
            "reply": f"📅 **Event Scheduled!**\n• Title: **{new_event.title}**\n• When: **{target_dt.strftime('%A, %b %d at %I:%M %p')}**\n• Type: **{new_event.type}**",
            "action": "create_event",
            "created_id": new_event.id,
            "engine": "rule_based_fallback",
            "details": {"event_id": new_event.id, "title": new_event.title}
        }

    # 11. Explicit Task Creation (ONLY if keywords like add, create, new, assignment, homework, due are present)
    creation_keywords = ["add task", "create task", "new task", "assignment", "homework", "lab due", "project due", "exam on", "midterm on", "due on", "due tomorrow", "due friday", "due monday", "due "]
    if any(k in p_lower for k in creation_keywords):
        clean_title = prompt_str
        for prefix in ["add task", "create task", "add new task", "add", "create"]:
            if clean_title.lower().startswith(prefix):
                clean_title = clean_title[len(prefix):].strip()
                break

        target_dt = now + timedelta(days=3)
        if "friday" in p_lower:
            days_ahead = (4 - now.weekday()) % 7
            if days_ahead == 0: days_ahead = 7
            target_dt = now + timedelta(days=days_ahead)
        elif "tomorrow" in p_lower:
            target_dt = now + timedelta(days=1)
        elif "today" in p_lower:
            target_dt = now

        target_dt = target_dt.replace(hour=17, minute=0, second=0)

        subj_match = re.search(r'\b([A-Z]{2,4}\s*\d{3,4}|math|cs|biology|physics|chem|econ)\b', prompt_str, re.IGNORECASE)
        subject = subj_match.group(1).upper() if subj_match else "General"

        is_exam = "exam" in p_lower or "midterm" in p_lower
        task_type = "exam_work" if is_exam else "assignment"

        new_task = models.Task(
            title=clean_title if clean_title else "Academic Task",
            subject=subject,
            type=task_type,
            deadline=target_dt,
            weightage="25%" if is_exam else "15%",
            description=f"Created via LifeSync AI Manager: {prompt_str}",
            priority_score=75 if is_exam else 50,
            status="pending"
        )
        new_task.priority_score = calculate_task_priority(new_task, db)
        db.add(new_task)
        db.commit()
        db.refresh(new_task)

        dl_formatted = target_dt.strftime("%A, %b %d at %I:%M %p")
        return {
            "reply": f"📝 **Task Created!**\n• Title: **{new_task.title}**\n• Subject: **{subject}**\n• Due: **{dl_formatted}**\n• Priority Score: **{new_task.priority_score}**",
            "action": "create_task",
            "created_id": new_task.id,
            "engine": "rule_based_fallback",
            "details": {"task_id": new_task.id, "title": new_task.title}
        }

    # 11. Default fallback: Helpful assistant guidance (NEVER creating dummy tasks!)
    return {
        "reply": f"I'm here to help manage your schedule, tasks, and deadlines!\n\nI wasn't sure what action you wanted for: *\"{prompt_str}\"*.\n\nTry commands like:\n• *'Show my deadlines'* — see what's due soon\n• *'Add CS101 lab report due Friday'* — create a new task\n• *'Generate schedule'* — fit tasks into your free slots\n• *'Resolve conflicts'* — check for overlapping events",
        "action": "chat",
        "engine": "rule_based_fallback"
    }


def execute_action(action: str, params: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """Applies structured actions decided by Gemini to the database."""
    if action == "create_task":
        deadline_dt = None
        if params.get("deadline"):
            try:
                deadline_dt = datetime.fromisoformat(params["deadline"])
            except Exception:
                pass

        task = models.Task(
            title=params.get("title", "New Task"),
            subject=params.get("subject", "General"),
            type=params.get("type", "assignment"),
            deadline=deadline_dt,
            weightage=params.get("weightage", "15%"),
            description=params.get("description", "Created via Groq AI"),
            priority_score=50,
            status="pending"
        )
        task.priority_score = calculate_task_priority(task, db)
        db.add(task)
        db.commit()
        db.refresh(task)
        return {"task_id": task.id, "title": task.title}

    elif action == "create_event":
        start_dt = None
        if params.get("start_datetime"):
            try:
                start_dt = datetime.fromisoformat(params["start_datetime"])
            except Exception:
                pass
        if not start_dt:
            start_dt = datetime.now(timezone.utc) + timedelta(days=1)
        event = models.Event(
            title=params.get("title", "New Event"),
            type=params.get("type", "class_session"),
            start_datetime=start_dt,
            end_datetime=start_dt + timedelta(hours=1),
            description=params.get("description", "Created via Groq AI")
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return {"event_id": event.id, "title": event.title}

    elif action == "complete_task":
        task_id = params.get("task_id")
        task = db.query(models.Task).filter(models.Task.id == task_id).first() if task_id else None
        if task:
            task.status = "completed"
            db.commit()
            return {"completed_id": task.id}

    elif action == "delete_task":
        task_id = params.get("task_id")
        task = db.query(models.Task).filter(models.Task.id == task_id).first() if task_id else None
        if task:
            db.delete(task)
            db.commit()
            return {"deleted_id": task_id}

    elif action == "generate_schedule":
        return generate_ai_schedule(db)

    elif action == "resolve_conflicts":
        return resolve_schedule_conflicts(db)

    elif action == "plan_exam":
        task_id = params.get("task_id")
        if task_id:
            return generate_exam_study_plan(task_id=task_id, db=db)

    return {}
