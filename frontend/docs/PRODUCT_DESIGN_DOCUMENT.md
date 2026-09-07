# LifeSync Product Design Document

**Everything in sync, nothing out of time.**  
*Version:* 1.0 — draft  
*Scope:* Marketing landing page, Home, Dashboard, and Calendar workspace screens  
*Source:* Figma file "Life Sync" — screens documented from current exported frames

---

## 1. Overview

LifeSync is an AI-powered student and professional life-management workspace. It replaces a passive calendar with an active system that ingests commitments (lectures, assignments, exams, habits, meetings), understands their priority and flexibility, and continuously arranges them into a daily schedule — then re-arranges that schedule as things change.

This document describes the current UI design as reflected in the Figma file: what each screen communicates, the components it's built from, and how those components map to underlying product concepts (tasks, events, priority, focus sessions) so design and engineering stay aligned as the backend is built out.

### 1.1 Product pillars reflected in the design
- **At a glance clarity** — every workspace screen opens with a compact metrics row (deadlines, routine %, streak, active timer) before any detail.
- **Priority-aware surfacing** — the single most urgent item (a due-today or overdue deadline) is always visually escalated with a red/coral card, regardless of which screen the user is on.
- **Focus as a first-class feature** — a persistent Pomodoro-style focus timer and "Active Focus Session" module appear across Home, Dashboard, and Calendar.
- **Calendar as the source of truth for time** — the Calendar screen is where scheduling, conflicts, and external calendar connections (Canvas, Google Workspace, Personal) are reconciled.
- **Routine and habit tracking sits alongside academic/work deadlines** rather than in a separate app section, reinforcing the "whole life" framing.

---

## 2. Visual design system

### 2.1 Color palette
| Swatch | Name | Hex (approx.) | Usage |
|---|---|---|---|
| 🟩 | **Deep forest green** | `#1B3B2E` | Sidebar background, hero banners, primary dark surfaces |
| 🟢 | **Working green** | `#1F5C3D` | Primary buttons, active nav item, progress rings, positive status |
| 🪢 | **Pale green tint** | `#E7F0EA` | Subtle section backgrounds, secondary chips |
| 🔴 | **Alert coral / red** | `#B23A3A` | Due-today and overdue deadline cards, critical badges |
| 🌸 | **Coral tint** | `#F6D9D3` | Background wash behind alert cards on light screens |
| 🟡 | **Amber** | `#D9A441` | Streak badges, "Top 5%" recognition tags, suggested/optional actions |
| ⚪ | **Neutral gray** | `#6B7280` | Secondary text, timestamps, metadata |
| 📄 | **Off-white surface** | `#F4F5F6` | App canvas background behind cards |

### 2.2 Typography
- A single clean sans-serif family is used throughout, with weight (not typeface change) doing most of the differentiation — regular for body/metadata, medium/semibold for headings, labels, and metric values.
- **Hero/landing headline**: large, bold, dark green-black, two-line with an underline accent on the emphasized word.
- **In-app headings** ("At a Glance", "Calendar & Daily Schedule"): medium weight, dark neutral, no all-caps.
- **Eyebrow/status labels** (`"DAILY WORKSPACE ACTIVE"`, `"DUE TODAY"`, `"ACADEMIC"`): small, all-caps, letter-spaced, used sparingly as pill badges rather than plain text.
- **Numeric emphasis**: large figures (41%, 5 days, timers) are set noticeably larger than their labels — the number is the content, the label is secondary.

### 2.3 Layout & spacing
- Persistent left sidebar (icon + label nav) on every authenticated screen; landing page uses a top nav bar instead.
- Three-zone in-app layout: `sidebar` $\rightarrow$ `primary content column` $\rightarrow$ `narrower right rail for secondary/contextual info` (mini calendar, connected calendars, next-48-hours list).
- Metric cards are grouped in a horizontal row of 3–4 equal-width cards at the top of every workspace screen — this row is the most consistent structural element across screens.
- Cards use soft rounded corners and light borders/shadows on white/light surfaces; status cards (deadline, overdue) use solid or tinted color fills instead of borders to escalate visually.

### 2.4 Core reusable components
- **Metric card**: label, large value, small trend/status line, optional progress bar or ring.
- **Deadline / task card**: color-escalated by urgency, contains a title, category badge, due time, and a checklist of milestones/subtasks with checkboxes.
- **Focus timer widget**: running clock display, current task label, Pause / Break / Complete controls.
- **Week strip**: 7-day horizontal date selector with a filled circle marking "today" and dots indicating days with events.
- **Routine/habit row**: icon, habit name, time + duration, tag (e.g. "Routine Habit"), and a checkmark action to log completion.
- **Collaborator/avatar stack**: overlapping circular avatars with a status dot, used for meetings and team collaboration.
- **Connected-calendar list item**: colored dot, calendar name, description, toggle checkbox.
- **Suggested-slot card**: a distinct, lighter-weight card style for AI-recommended (not yet committed) focus blocks, with an "Accept Slot" action.

---

## 3. Screens

### 3.1 Landing page (marketing)
- **Purpose**: convert visitors into trial users by pairing an emotional value proposition ("Synchronize Your Life, Work & Mind") with a literal, believable preview of the product mid-use.
- **Key sections**:
  - Top nav: logo, Sign In, primary "Get App" CTA, account icon.
  - Hero: social proof line (rating + user count), two-line headline with underline accent, supporting copy naming the three input types (deadlines, voice memos, routines), primary CTA ("Start Free Trial") with a no-friction sub-line, and institutional trust logos.
  - Live product preview panel: a framed "desktop app" window showing the assistant chat prompt, the At a Glance metrics, week strip, and a live due-today card with a running time tracker.
  - Closing conversion band: dark full-width section restating platform availability, the value prop as a question ("Ready to Find Your Daily Rhythm?"), download CTA, and app-store ratings.

### 3.2 Home
- **Purpose**: the day's landing screen. Answers "what needs my attention right now" before anything else — greeting and urgent-item count first, metrics second, the single most urgent deadline escalated at the bottom.
- **Key sections**:
  - Greeting banner (dark green `#1B3B2E`): personalized welcome ("Hello, Totok Michael"), a one-line summary of urgent items, and a row of quick-status pills.
  - At a Glance metrics: Deadlines (pending count + academic/work split + completion progress bar), Daily Routine (ring chart + next habit), Study Streak (days + peer percentile + today's logged time).
  - Weekly Schedule strip for quick day navigation.
  - Active Focus Session card: Pomodoro-labeled timer tied to the current task, with Pause / 5m Break / Complete actions.
  - A single routine row (e.g. Morning Yoga) shown inline as today's next habit.
  - Due-today deadline card (escalated color): task title, category, subtask checklist with progress, "Add subtask" and "Open Paper" actions.
  - Peak Cognitive Window tip: a personalized, AI-derived suggestion for when to schedule demanding work tomorrow.

### 3.3 Dashboard
- **Purpose**: a work-oriented, high-focus view — brings in an interactive Pomodoro study timer, a semester course syllabus & exam mastery tracker, and a queued list of the day's focus tasks in priority order.
- **Key sections**:
  - Same At a Glance metric family as Home, plus a persistent live time-tracker card in the top row.
  - Month/week date strip identical in pattern to Home's weekly schedule.
  - Today's Schedule & Routine: a clean breakdown combining habits (Morning Yoga) and dedicated spaced repetition study blocks.
  - Focus & Study Mode: live interactive Pomodoro timer (25m Focus, 5m Break, 50m Deep Work) with live progress bar and session tracker tied to highest-priority coursework.
  - Syllabus & Exam Mastery: course-by-course syllabus coverage bars, upcoming CAT/FAT exam countdowns, and instant 1-click spaced repetition review generators.
  - Escalated deadline card: same visual pattern as Home's, here marked with real-time urgency and an action tied to the milestone list.
  - Daily Focus Queue: an ordered list of upcoming focus tasks with per-task time estimates and queue-position labels (Next up / Standby / Queued), plus a running total and "Add Focus Task."

### 3.4 Calendar & Daily Schedule
- **Purpose**: the operational core of the product — a real timeline (not just a list) showing exactly how the day is filled, where the free gaps are, and where the AI is proposing to place new work.
- **Key sections**:
  - Header: Day / Week / Month view toggle, term label, active-slot count, "auto-synced with Canvas" indicator, Filter and Quick Event actions.
  - Metric row: Deadlines Tracker, Daily Routine, Study Momentum, and a live Focus Session timer.
  - Day timeline (the centerpiece): time-stamped rows from morning through evening, each rendering a different entity type distinctly — free/unscheduled buffer time, a completed routine block, a transit/logistics note, an escalated overdue-assignment block with a live "now" marker and subtask checklist, a break interval, a spaced-repetition study block, and a distinctly styled suggested focus block awaiting user acceptance.
  - Right rail: a standard month mini-calendar, a "Next 48 Hours" look-ahead list (academic deadlines, study sessions, and lab prep), and a Connected Calendars panel listing external sources (University Canvas, Google Workspace, Personal & Habits) each with a color and an on/off toggle.

---

## 4. Mapping UI to backend data

| UI element | Backend source | Mapping & Implementation |
|---|---|---|
| Deadlines metric | `tasks` table | Count active tasks, calculate academic vs other split |
| Daily Routine ring | Habit tracker | In-memory/local habit status with 41%-68% daily ring |
| Study Streak | Focus sessions & slots | Consecutive day streak counter & top percentile badge |
| Due-today / overdue deadline card | `tasks` + `scheduled_slots` | Filtered by deadline proximity, renders subtask checklist |
| Week strip / day timeline blocks | `events` (fixed) + `scheduled_slots` | REST API: `GET /api/schedule` and `GET /api/events` |
| Suggested Focus Block + Accept Slot | Output of AI scheduler (`proposed`) | Primary UI action calling `POST /api/schedule/generate` or committing slot |
| Focus & Study Timer | Active task & Local storage | Pomodoro countdown (25/5/50m), audio chime, streak tracking |
| Syllabus & Exam Mastery | Course syllabus & `tasks` table | Syllabus progress %, CAT/FAT countdowns & spaced-repetition exam planner |
| Connected Calendars | `source_upload_id` / source type | Canvas, Google Workspace, Personal sources |
