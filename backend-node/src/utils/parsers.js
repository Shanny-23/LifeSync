const { normalizeUrgency, inferUrgency } = require('./urgency');

/**
 * Formats start and end dates/times into "YYYY-MM-DD HH:MM - HH:MM"
 * Handles Date objects, ISO strings, or objects with dateTime/date (like Google Calendar API)
 */
function formatSlot(startDate, endDate) {
  if (!startDate) return null;

  const start = new Date(startDate.dateTime || startDate.date || startDate);
  if (isNaN(start.getTime())) return null;

  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = start.getFullYear();
  const mm = pad(start.getMonth() + 1);
  const dd = pad(start.getDate());
  const startH = pad(start.getHours());
  const startM = pad(start.getMinutes());

  if (!endDate) {
    return `${yyyy}-${mm}-${dd} ${startH}:${startM}`;
  }

  const end = new Date(endDate.dateTime || endDate.date || endDate);
  if (isNaN(end.getTime())) {
    return `${yyyy}-${mm}-${dd} ${startH}:${startM}`;
  }

  const endH = pad(end.getHours());
  const endM = pad(end.getMinutes());

  return `${yyyy}-${mm}-${dd} ${startH}:${startM} - ${endH}:${endM}`;
}

/**
 * Parses a slot string formatted as "YYYY-MM-DD HH:MM - HH:MM" into { start: Date, end: Date }
 */
function parseSlot(slotStr) {
  if (!slotStr || typeof slotStr !== 'string') return null;
  const parts = slotStr.split(' - ');
  if (parts.length < 2) return null;

  const startPart = parts[0].trim(); // "YYYY-MM-DD HH:MM"
  const endPart = parts[1].trim();   // "HH:MM" or "YYYY-MM-DD HH:MM"

  const startMatch = startPart.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!startMatch) return null;

  const dateStr = startMatch[1];
  const startHour = parseInt(startMatch[2], 10);
  const startMin = parseInt(startMatch[3], 10);

  const start = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);

  let end;
  const endMatch = endPart.match(/^(\d{1,2}):(\d{2})$/);
  if (endMatch) {
    const endHour = parseInt(endMatch[1], 10);
    const endMin = parseInt(endMatch[2], 10);
    end = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`);
  } else {
    end = new Date(endPart);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

/**
 * Shared task builder / normalizer.
 * All file parsers and external sync sources funnel into this function.
 */
function buildTask(raw = {}) {
  const taskName = (raw.task || raw.title || raw.summary || raw.name || 'Untitled Task').trim();
  const deadline = raw.deadline || raw.due || (raw.end ? (raw.end.dateTime || raw.end.date || raw.end) : null);
  const urgency = raw.urgency ? normalizeUrgency(raw.urgency) : inferUrgency(taskName, deadline);

  let scheduledSlot = raw.scheduledSlot || null;
  if (!scheduledSlot && (raw.start || raw.startTime)) {
    scheduledSlot = formatSlot(raw.start || raw.startTime, raw.end || raw.endTime);
  }

  const category = (
    raw.category ||
    raw.course ||
    raw.subject ||
    (raw.organizer && (raw.organizer.displayName || raw.organizer.email)) ||
    'General'
  ).trim();

  return {
    task: taskName,
    deadline: deadline ? new Date(deadline).toISOString().replace('T', ' ').substring(0, 16) : null,
    urgency,
    scheduledSlot,
    category,
    completed: Boolean(raw.completed),
    googleEventId: raw.googleEventId || null,
  };
}

/**
 * Parses JSON content into tasks
 */
function parseJSON(content) {
  const data = typeof content === 'string' ? JSON.parse(content) : content;
  const items = Array.isArray(data) ? data : data.tasks || [data];
  return items.map(buildTask);
}

/**
 * Parses simple CSV content into tasks
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });
    tasks.push(buildTask(row));
  }

  return tasks;
}

/**
 * Parses simple iCalendar / .ics content into tasks
 */
function parseICS(content) {
  const events = [];
  const lines = content.split(/\r?\n/);
  let currentEvent = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) {
        events.push(buildTask(currentEvent));
        currentEvent = null;
      }
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.task = line.substring(8).trim();
      } else if (line.startsWith('DTSTART:')) {
        const val = line.substring(8).trim();
        currentEvent.start = parseIcsDate(val);
      } else if (line.startsWith('DTEND:')) {
        const val = line.substring(6).trim();
        currentEvent.end = parseIcsDate(val);
      } else if (line.startsWith('CATEGORIES:')) {
        currentEvent.category = line.substring(11).trim();
      }
    }
  }

  return events;
}

function parseIcsDate(icsDateStr) {
  // e.g. 20261028T100000Z or 20261028
  if (!icsDateStr) return null;
  const clean = icsDateStr.replace(/[^0-9T]/g, '');
  if (clean.length >= 15) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    const h = clean.substring(9, 11);
    const min = clean.substring(11, 13);
    const s = clean.substring(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
  }
  return new Date(icsDateStr);
}

module.exports = {
  formatSlot,
  parseSlot,
  buildTask,
  parseJSON,
  parseCSV,
  parseICS,
};
