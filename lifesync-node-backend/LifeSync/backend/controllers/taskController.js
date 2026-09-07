const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');

// @route GET /api/tasks
// Supports ?urgency=high&category=Work&search=review&from=YYYY-MM-DD&to=YYYY-MM-DD
const getTasks = asyncHandler(async (req, res) => {
  const { urgency, category, search, from, to } = req.query;

  const query = { owner: req.user._id };

  if (urgency && urgency !== 'all') query.urgency = urgency;
  if (category && category !== 'all') query.category = category;

  if (search) {
    query.$or = [
      { task: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }

  if (from || to) {
    query.scheduledStart = {};
    if (from) query.scheduledStart.$gte = new Date(from);
    if (to) query.scheduledStart.$lte = new Date(to);
  }

  const tasks = await Task.find(query).sort({ scheduledStart: 1 });
  res.json({ success: true, count: tasks.length, tasks });
});

// @route GET /api/tasks/:id
const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.json({ success: true, task });
});

// @route POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const { task, category, urgency, deadline, scheduledStart, scheduledEnd, source } = req.body;

  if (!task || !deadline || !scheduledStart || !scheduledEnd) {
    res.status(400);
    throw new Error('task, deadline, scheduledStart, and scheduledEnd are required');
  }

  const created = await Task.create({
    owner: req.user._id,
    task,
    category,
    urgency,
    deadline,
    scheduledStart,
    scheduledEnd,
    source: source || 'manual',
  });

  res.status(201).json({ success: true, task: created });
});

// @route PUT /api/tasks/:id
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  const editable = ['task', 'category', 'urgency', 'deadline', 'scheduledStart', 'scheduledEnd', 'completed'];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) task[field] = req.body[field];
  });

  await task.save();
  res.json({ success: true, task });
});

// @route DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  res.json({ success: true, message: 'Task deleted' });
});

// @route GET /api/tasks/stats/summary
// Powers the Dashboard metric cards and category chips
const getStats = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ owner: req.user._id });

  const byUrgency = { high: 0, medium: 0, low: 0 };
  const byCategory = {};

  tasks.forEach((t) => {
    if (byUrgency[t.urgency] !== undefined) byUrgency[t.urgency] += 1;
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  res.json({
    success: true,
    total: tasks.length,
    byUrgency,
    byCategory,
  });
});

module.exports = { getTasks, getTask, createTask, updateTask, deleteTask, getStats };
