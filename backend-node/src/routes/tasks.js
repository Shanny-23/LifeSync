const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildTask } = require('../utils/parsers');

/**
 * GET /api/tasks
 * Query params: status, urgency, category, search
 */
router.get('/', async (req, res) => {
  try {
    let tasks = await db.getAllTasks();
    const { status, urgency, category, search } = req.query;

    if (status) {
      if (status === 'completed') tasks = tasks.filter((t) => t.completed);
      else if (status === 'pending') tasks = tasks.filter((t) => !t.completed);
    }

    if (urgency && urgency !== 'all') {
      tasks = tasks.filter((t) => (t.urgency || '').toLowerCase() === urgency.toLowerCase());
    }

    if (category && category !== 'all') {
      tasks = tasks.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) => (t.task || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)
      );
    }

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks', message: err.message });
  }
});

/**
 * GET /api/tasks/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task', message: err.message });
  }
});

/**
 * POST /api/tasks
 */
router.post('/', async (req, res) => {
  try {
    const taskData = buildTask(req.body);
    const created = await db.addTask(taskData);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create task', message: err.message });
  }
});

/**
 * PUT /api/tasks/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await db.updateTask(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update task', message: err.message });
  }
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const ok = await db.deleteTask(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', message: err.message });
  }
});

module.exports = router;
