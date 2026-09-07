// Seeds a demo user + the same set of tasks used in the frontend's
// src/mockData.js, so the API returns familiar data out of the box.
//
// Usage: npm run seed

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Task = require('../models/Task');
const { parseScheduledSlot } = require('./scheduleParser');

const DEMO_EMAIL = 'demo@lifesync.app';
const DEMO_PASSWORD = 'password123';

// Mirrors src/mockData.js, anchored to the current week (Monday start)
function buildMockTasks() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const dateStr = (offset) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const raw = [
    { task: 'Quarterly Strategic Roadmap Review', offset: 0, deadlineTime: '17:00', urgency: 'high', slot: ['09:30', '11:00'], category: 'Work' },
    { task: 'Cardio & Strength Conditioning', offset: 0, deadlineTime: '20:00', urgency: 'low', slot: ['18:00', '19:15'], category: 'Health' },
    { task: 'Tax Return & Expense Audit', offset: 1, deadlineTime: '16:00', urgency: 'high', slot: ['14:00', '15:30'], category: 'Finance' },
    { task: 'AI Engine Architecture Sync', offset: 2, deadlineTime: '15:00', urgency: 'medium', slot: ['11:00', '12:30'], category: 'Work' },
    { task: 'System Design & Distributed Cache Study', offset: 2, deadlineTime: '21:00', urgency: 'medium', slot: ['16:30', '18:00'], category: 'Learning' },
    { task: 'Weekly Grocery Restock & Meal Prep', offset: 3, deadlineTime: '19:00', urgency: 'low', slot: ['17:30', '18:45'], category: 'Personal' },
    { task: 'Client Security Compliance Sign-off', offset: 4, deadlineTime: '18:00', urgency: 'high', slot: ['10:00', '11:30'], category: 'Work' },
    { task: 'Investment Portfolio Rebalancing', offset: 5, deadlineTime: '14:00', urgency: 'medium', slot: ['13:00', '14:00'], category: 'Finance' },
    { task: 'Weekend Hiking & Recovery Trek', offset: 6, deadlineTime: '18:00', urgency: 'low', slot: ['08:00', '11:30'], category: 'Health' },
  ];

  return raw.map((r) => {
    const date = dateStr(r.offset);
    const { scheduledStart, scheduledEnd } = parseScheduledSlot(`${date} ${r.slot[0]} - ${r.slot[1]}`);
    return {
      task: r.task,
      category: r.category,
      urgency: r.urgency,
      deadline: new Date(`${date}T${r.deadlineTime}:00`),
      scheduledStart,
      scheduledEnd,
      source: 'manual',
    };
  });
}

async function seed() {
  await connectDB();

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.create({ name: 'Demo User', email: DEMO_EMAIL, password: DEMO_PASSWORD });
    console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`Using existing demo user: ${DEMO_EMAIL}`);
  }

  await Task.deleteMany({ owner: user._id });
  const tasks = buildMockTasks().map((t) => ({ ...t, owner: user._id }));
  await Task.insertMany(tasks);

  console.log(`Seeded ${tasks.length} tasks for ${DEMO_EMAIL}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
