/**
 * Urgency inference and normalization utilities.
 */

function normalizeUrgency(val) {
  if (!val) return 'medium';
  const clean = String(val).toLowerCase().trim();
  if (['high', 'urgent', 'critical', 'immediate', '1'].includes(clean)) return 'high';
  if (['low', 'trivial', 'minor', 'optional', '3'].includes(clean)) return 'low';
  return 'medium';
}

function inferUrgency(taskName = '', deadline = null) {
  const name = String(taskName).toLowerCase();

  // Keyword-based high urgency heuristics
  if (
    name.includes('exam') ||
    name.includes('quiz') ||
    name.includes('cat') ||
    name.includes('fat') ||
    name.includes('final') ||
    name.includes('urgent') ||
    name.includes('midterm') ||
    name.includes('asap')
  ) {
    return 'high';
  }

  // Deadline proximity heuristic
  if (deadline) {
    try {
      const deadlineDate = new Date(deadline);
      if (!isNaN(deadlineDate.getTime())) {
        const now = new Date();
        const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
        if (diffHours <= 24) return 'high';
        if (diffHours <= 72) return 'medium';
        return 'low';
      }
    } catch {
      // ignore parse errors
    }
  }

  return 'medium';
}

module.exports = {
  normalizeUrgency,
  inferUrgency,
};
