const express = require('express');
const router = express.Router();
const db = require('../db');
const { findConflicts } = require('../utils/conflicts');

/**
 * GET /api/dashboard/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const tasks = await db.getAllTasks();
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const highUrgency = tasks.filter((t) => !t.completed && (t.urgency === 'high' || (t.priority_score || 0) >= 70)).length;

    res.json({
      total,
      completed,
      pending,
      highUrgency,
      routinePercent: 41,
      streakDays: 5,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary', message: err.message });
  }
});

/**
 * GET /api/dashboard/week
 */
router.get('/week', async (req, res) => {
  try {
    const tasks = await db.getAllTasks();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekTasks = tasks.filter((t) => {
      if (!t.scheduledSlot) return false;
      const datePart = t.scheduledSlot.substring(0, 10);
      const slotDate = new Date(datePart);
      return slotDate >= startOfWeek && slotDate < endOfWeek;
    });

    res.json(weekTasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch week schedule', message: err.message });
  }
});

/**
 * GET /api/dashboard/conflicts
 */
router.get('/conflicts', async (req, res) => {
  try {
    const tasks = await db.getAllTasks();
    const conflicts = findConflicts(tasks, tasks);
    res.json(conflicts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to detect conflicts', message: err.message });
  }
});

module.exports = router;
