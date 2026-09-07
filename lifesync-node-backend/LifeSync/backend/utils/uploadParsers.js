const ical = require('node-ical');
const { parse: parseCsvSync } = require('csv-parse/sync');
const { parseScheduledSlot } = require('./scheduleParser');

const ALLOWED_URGENCY = ['low', 'medium', 'high'];

const normalizeUrgency = (val) => {
  const v = String(val || '').toLowerCase();
  return ALLOWED_URGENCY.includes(v) ? v : 'medium';
};

// --- .ics (iCalendar) ---
function parseIcs(buffer) {
  const data = ical.parseICS(buffer.toString('utf-8'));
  const tasks = [];
  const errors = [];

  Object.values(data).forEach((component) => {
    if (component.type !== 'VEVENT') return;
    try {
      const scheduledStart = component.start;
      const scheduledEnd = component.end || component.start;
      if (!scheduledStart) {
        errors.push(`Event "${component.summary || 'Untitled'}" has no start time`);
        return;
      }
      tasks.push({
        task: component.summary || 'Untitled event',
        category: (component.categories && component.categories[0]) || 'General',
        urgency: normalizeUrgency(component.priority <= 4 && component.priority > 0 ? 'high' : 'medium'),
        deadline: scheduledEnd,
        scheduledStart,
        scheduledEnd,
        source: 'ics',
      });
    } catch (err) {
      errors.push(`Failed to parse an event: ${err.message}`);
    }
  });

  return { tasks, errors };
}

// --- .csv ---
// Expected headers: task,category,urgency,deadline,scheduledStart,scheduledEnd
// (deadline/scheduledStart/scheduledEnd as ISO strings or "YYYY-MM-DD HH:mm")
function parseCsv(buffer) {
  const records = parseCsvSync(buffer.toString('utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const tasks = [];
  const errors = [];

  records.forEach((row, idx) => {
    try {
      if (!row.task) {
        errors.push(`Row ${idx + 1}: missing "task" column`);
        return;
      }

      let scheduledStart = row.scheduledStart ? new Date(row.scheduledStart) : null;
      let scheduledEnd = row.scheduledEnd ? new Date(row.scheduledEnd) : null;

      // Fall back to a combined "scheduledSlot" column matching the mock format
      if ((!scheduledStart || !scheduledEnd) && row.scheduledSlot) {
        const parsed = parseScheduledSlot(row.scheduledSlot);
        if (parsed) {
          scheduledStart = parsed.scheduledStart;
          scheduledEnd = parsed.scheduledEnd;
        }
      }

      if (!scheduledStart || !scheduledEnd || Number.isNaN(scheduledStart.getTime())) {
        errors.push(`Row ${idx + 1} ("${row.task}"): missing or invalid schedule time`);
        return;
      }

      const deadline = row.deadline ? new Date(row.deadline) : scheduledEnd;

      tasks.push({
        task: row.task,
        category: row.category || 'General',
        urgency: normalizeUrgency(row.urgency),
        deadline,
        scheduledStart,
        scheduledEnd,
        source: 'csv',
      });
    } catch (err) {
      errors.push(`Row ${idx + 1}: ${err.message}`);
    }
  });

  return { tasks, errors };
}

// --- .json ---
// Accepts either an array of task objects with scheduledStart/scheduledEnd,
// or the frontend mock shape with a combined scheduledSlot string.
function parseJson(buffer) {
  const tasks = [];
  const errors = [];
  let parsed;

  try {
    parsed = JSON.parse(buffer.toString('utf-8'));
  } catch (err) {
    return { tasks, errors: [`Invalid JSON: ${err.message}`] };
  }

  const list = Array.isArray(parsed) ? parsed : parsed.tasks;
  if (!Array.isArray(list)) {
    return { tasks, errors: ['Expected a JSON array of tasks (or an object with a "tasks" array)'] };
  }

  list.forEach((item, idx) => {
    try {
      if (!item.task) {
        errors.push(`Item ${idx + 1}: missing "task" field`);
        return;
      }

      let scheduledStart = item.scheduledStart ? new Date(item.scheduledStart) : null;
      let scheduledEnd = item.scheduledEnd ? new Date(item.scheduledEnd) : null;

      if ((!scheduledStart || !scheduledEnd) && item.scheduledSlot) {
        const parsedSlot = parseScheduledSlot(item.scheduledSlot);
        if (parsedSlot) {
          scheduledStart = parsedSlot.scheduledStart;
          scheduledEnd = parsedSlot.scheduledEnd;
        }
      }

      if (!scheduledStart || !scheduledEnd || Number.isNaN(scheduledStart.getTime())) {
        errors.push(`Item ${idx + 1} ("${item.task}"): missing or invalid schedule time`);
        return;
      }

      const deadline = item.deadline ? new Date(item.deadline) : scheduledEnd;

      tasks.push({
        task: item.task,
        category: item.category || 'General',
        urgency: normalizeUrgency(item.urgency),
        deadline,
        scheduledStart,
        scheduledEnd,
        source: 'json',
      });
    } catch (err) {
      errors.push(`Item ${idx + 1}: ${err.message}`);
    }
  });

  return { tasks, errors };
}

module.exports = { parseIcs, parseCsv, parseJson };
