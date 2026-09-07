// Parses the "YYYY-MM-DD HH:mm - HH:mm" format used in the frontend's
// mockData.js scheduledSlot field into real Date objects.
function parseScheduledSlot(slot) {
  if (!slot || typeof slot !== 'string') return null;

  const [startPart, endTimePart] = slot.split(' - ').map((s) => s.trim());
  if (!startPart || !endTimePart) return null;

  const [datePart, startTime] = startPart.split(' ');
  if (!datePart || !startTime) return null;

  const scheduledStart = new Date(`${datePart}T${startTime}:00`);
  const scheduledEnd = new Date(`${datePart}T${endTimePart}:00`);

  if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime())) {
    return null;
  }

  return { scheduledStart, scheduledEnd };
}

module.exports = { parseScheduledSlot };
