const { parseSlot } = require('./parsers');

/**
 * Checks whether two time intervals [startA, endA] and [startB, endB] overlap
 */
function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

/**
 * Detects conflicts between incoming candidate tasks and existing tasks in the database.
 * Returns an array of conflict objects:
 * {
 *   incomingTask: { task, scheduledSlot },
 *   conflictingWith: { id, task, scheduledSlot },
 *   reason: string
 * }
 */
function findConflicts(incomingTasks = [], existingTasks = []) {
  const conflicts = [];

  const parsedExisting = existingTasks
    .map((task) => {
      const parsed = parseSlot(task.scheduledSlot);
      return parsed ? { task, ...parsed } : null;
    })
    .filter(Boolean);

  incomingTasks.forEach((incoming) => {
    if (!incoming.scheduledSlot) return;
    const incomingParsed = parseSlot(incoming.scheduledSlot);
    if (!incomingParsed) return;

    // Check against existing database tasks
    parsedExisting.forEach((existing) => {
      // Don't conflict with itself if updating the same task
      if (incoming.id && incoming.id === existing.task.id) return;
      if (incoming.googleEventId && incoming.googleEventId === existing.task.googleEventId) return;

      if (intervalsOverlap(incomingParsed.start, incomingParsed.end, existing.start, existing.end)) {
        conflicts.push({
          incomingTask: {
            task: incoming.task,
            scheduledSlot: incoming.scheduledSlot,
            googleEventId: incoming.googleEventId || null,
          },
          conflictingWith: {
            id: existing.task.id,
            task: existing.task.task,
            scheduledSlot: existing.task.scheduledSlot,
          },
          reason: `Overlaps with existing scheduled task "${existing.task.task}" (${existing.task.scheduledSlot})`,
        });
      }
    });
  });

  return conflicts;
}

module.exports = {
  intervalsOverlap,
  findConflicts,
};
