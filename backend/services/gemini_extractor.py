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

load_dotenv()
logger = logging.getLogger(__name__)

def get_gemini_api_key(custom_key: Optional[str] = None) -> Optional[str]:
    """Retrieve Gemini API key from explicit param, environment, or .env file."""
    if custom_key and custom_key.strip():
        return custom_key.strip()
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def extract_academic_items_with_gemini(raw_text: str, custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract structured course details, assignments, and exams from syllabus/schedule text.
    Uses Google GenAI SDK if API key is present; otherwise falls back gracefully to rule-based parser.
    """
    if not raw_text or not raw_text.strip():
        return {
            "source": "empty",
            "course_info": {},
            "assignments": [],
            "exams": [],
            "schedule": []
        }

    api_key = get_gemini_api_key(custom_key)

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = f"""
You are an expert academic syllabus and schedule extractor for LifeSync.
Analyze the following text and extract all course details, assignments, exams, and weekly lecture schedules.
Respond ONLY with a valid JSON object matching this schema:
{{
  "course_code": "string (e.g. CS450)",
  "course_title": "string (e.g. Distributed Operating Systems)",
  "instructor": "string or null",
  "assignments": [
    {{
      "title": "string",
      "deadline": "YYYY-MM-DDTHH:MM:SS or null",
      "urgency": "high" | "medium" | "low",
      "weightage": "string (e.g. 15%)",
      "description": "string"
    }}
  ],
  "exams": [
    {{
      "title": "string",
      "date": "YYYY-MM-DDTHH:MM:SS or null",
      "weightage": "string (e.g. 30%)",
      "description": "string"
    }}
  ],
  "schedule": [
    {{
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "title": "string",
      "location": "string or null"
    }}
  ]
}}

Raw Document Text:
{raw_text[:8000]}
"""
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            resp_text = response.text.strip()
            if resp_text.startswith("```json"):
                resp_text = resp_text[7:]
            if resp_text.startswith("```"):
                resp_text = resp_text[3:]
            if resp_text.endswith("```"):
                resp_text = resp_text[:-3]

            parsed_data = json.loads(resp_text.strip())
            parsed_data["source"] = "gemini-2.5-flash"
            return parsed_data
        except Exception as e:
            logger.warning("Gemini document extraction error: %s. Using heuristic fallback.", e)

    # Heuristic Rule-Based Fallback
    assignments = []
    exams = []
    schedule = []
    now = datetime.now(timezone.utc)

    course_code_match = re.search(r'\b([A-Z]{2,4}\s*\d{3,4})\b', raw_text)
    course_code = course_code_match.group(1).replace(" ", "") if course_code_match else "CS101"

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        line_lower = line.lower()
        if any(k in line_lower for k in ["exam", "midterm", "final", "quiz"]):
            exams.append({
                "title": line[:60],
                "date": (now + timedelta(days=14)).replace(hour=10, minute=0, second=0).isoformat(),
                "weightage": "30%",
                "description": f"Extracted academic exam for {course_code}"
            })
        elif any(k in line_lower for k in ["assignment", "project", "homework", "lab", "due", "paper"]):
            assignments.append({
                "title": line[:60],
                "deadline": (now + timedelta(days=5 + (idx % 8))).replace(hour=23, minute=59, second=0).isoformat(),
                "urgency": "medium",
                "weightage": "15%",
                "description": f"Extracted coursework item for {course_code}"
            })

    if not assignments and not exams:
        assignments.append({
            "title": f"{course_code} Core Coursework Assignment",
            "deadline": (now + timedelta(days=5)).replace(hour=23, minute=59, second=0).isoformat(),
            "urgency": "medium",
            "weightage": "15%",
            "description": "Extracted coursework assignment"
        })

    return {
        "source": "rule_based_fallback",
        "course_info": {
            "course_code": course_code,
            "course_title": f"{course_code} Academic Course"
        },
        "assignments": assignments,
        "exams": exams,
        "schedule": schedule
    }


def execute_app_management(prompt: str, db: Session, user: Dict[str, Any], custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Primary AI App Manager:
    Interprets user prompt, reasons over current tasks/schedules, and executes real application actions.
    If Gemini API key is configured, uses Gemini 2.5 Flash for deep multimodal reasoning.
    Otherwise, uses comprehensive rule-based intent parsing.
    """
    now = datetime.now(timezone.utc)
    prompt_str = prompt.strip()
    prompt_lower = prompt_str.lower()
    api_key = get_gemini_api_key(custom_key)

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

    # 2. Try Gemini 2.5 Flash if API Key is available
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)

            system_instruction = f"""
You are the executive AI manager for LifeSync, an intelligent academic & productivity life-management workspace.
Current UTC time: {now.strftime("%A, %B %d, %Y %H:%M UTC")}.
Active user: {user.get("name", "Student")} ({user.get("major", "Academic")}).

CURRENT WORKSPACE STATE:
- Pending Tasks ({len(tasks_context)}): {json.dumps(tasks_context)}
- Completed Tasks: {completed_count}
- Upcoming Calendar Events ({len(events_context)}): {json.dumps(events_context)}
- Active Scheduled Focus Slots: {len(scheduled_slots)}

YOUR RESPONSIBILITIES:
1. GREETING & CHAT ("hi", "hello", "how are you", "who are you", "lol", "thanks"):
   - Respond warmly and conversationally.
   - Mention key things you can do to manage the student's schedule, deadlines, and focus time.
   - DO NOT create any tasks for conversational chat! Action MUST be "chat".
2. STATUS & QUERIES ("what do I have today?", "show my deadlines", "what's my schedule?", "what's urgent?"):
   - Query the current workspace state provided above.
   - Give a structured, encouraging summary with bullet points highlighting upcoming deadlines and events.
   - Action: "chat".
3. TASK CREATION ("add task", "new homework", "physics assignment due Friday", "CS450 project"):
   - Action: "create_task".
   - Extract title, subject (e.g. CS101, Math), deadline (ISO format), weightage (e.g. "20%"), and description.
4. TASK COMPLETION ("complete task 2", "mark raft project as done", "finish CS101 paper"):
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
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=f"{system_instruction}\n\nUser request: \"{prompt_str}\"",
            )
            resp_text = response.text.strip()
            if resp_text.startswith("```json"):
                resp_text = resp_text[7:]
            if resp_text.startswith("```"):
                resp_text = resp_text[3:]
            if resp_text.endswith("```"):
                resp_text = resp_text[:-3]

            parsed_res = json.loads(resp_text.strip())
            action = parsed_res.get("action", "chat")
            params = parsed_res.get("params", {})
            reply = parsed_res.get("reply", "Understood.")

            # Execute the action requested by Gemini
            action_result = execute_action(action, params, db)
            return {
                "reply": reply,
                "action": action,
                "engine": "gemini-2.5-flash",
                "details": action_result
            }
        except Exception as e:
            logger.warning("Gemini reasoning failed: %s. Falling back to rule-based manager.", e)

    # 3. Comprehensive Rule-Based Fallback Manager
    return rule_based_manager(prompt_str, db, user, existing_tasks, events, now)


def rule_based_manager(prompt_str: str, db: Session, user: Dict[str, Any], tasks: List[models.Task], events: List[models.Event], now: datetime) -> Dict[str, Any]:
    """Smart local intent parser and app orchestrator when Gemini key is offline."""
    p_lower = prompt_str.lower().strip()

    # 1. Greetings & Casual Chat
    greeting_patterns = [r"^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup)(\s+.*)?$"]
    if any(re.match(pat, p_lower) for pat in greeting_patterns):
        pending_count = len(tasks)
        top_task = tasks[0].title if tasks else "No urgent tasks"
        return {
            "reply": f"👋 Hello {user.get('name', 'there')}! I'm your **LifeSync AI Manager**.\n\nYou have **{pending_count} pending task(s)** right now. Top priority: *{top_task}*.\n\nHere are some things I can do for you:\n• 📋 *'What tasks are due this week?'*\n• ⚡ *'Generate an optimized study schedule'*\n• 🔍 *'Check and resolve calendar conflicts'*\n• ➕ *'Add CS450 Raft lab due Friday 5pm'*\n• ✅ *'Mark task 1 as completed'*",
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
            description=params.get("description", "Created via Gemini AI"),
            priority_score=50,
            status="pending"
        )
        task.priority_score = calculate_task_priority(task, db)
        db.add(task)
        db.commit()
        db.refresh(task)
        return {"task_id": task.id, "title": task.title}

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
