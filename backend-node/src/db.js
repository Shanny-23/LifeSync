const fs = require('fs').promises;
const path = require('path');
const { customAlphabet } = require('nanoid');

// Fallback nano id generator if nanoid module structure varies
let nanoid;
try {
  const nano = require('nanoid');
  nanoid = nano.nanoid || customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
} catch {
  nanoid = () => Math.random().toString(36).substring(2, 10);
}

const DATA_FILE = path.resolve(__dirname, '../data/tasks.json');

// Serialized write chain to prevent file corruption
let writeQueue = Promise.resolve();

async function ensureStore() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readAll() {
  await ensureStore();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('[DB] Error reading tasks.json:', err);
    return [];
  }
}

function writeAll(tasks) {
  writeQueue = writeQueue.then(async () => {
    await ensureStore();
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(tasks, null, 2), 'utf8');
    await fs.rename(tempFile, DATA_FILE);
  }).catch((err) => {
    console.error('[DB] Serialized write failed:', err);
  });
  return writeQueue;
}

const db = {
  async getAllTasks() {
    return await readAll();
  },

  async getTaskById(id) {
    const tasks = await readAll();
    return tasks.find((t) => t.id === id) || null;
  },

  async addTask(taskData) {
    const tasks = await readAll();
    const id = taskData.id || `task-${nanoid(8)}`;
    const newTask = {
      id,
      task: taskData.task || 'Untitled Task',
      deadline: taskData.deadline || null,
      urgency: taskData.urgency || 'medium',
      scheduledSlot: taskData.scheduledSlot || null,
      category: taskData.category || 'General',
      completed: Boolean(taskData.completed),
      googleEventId: taskData.googleEventId || null,
      createdAt: taskData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    await writeAll(tasks);
    return newTask;
  },

  async addTasks(taskList) {
    const tasks = await readAll();
    const added = [];
    const updated = [];

    for (const item of taskList) {
      // Check for deduplication by googleEventId if present
      if (item.googleEventId) {
        const existingIdx = tasks.findIndex((t) => t.googleEventId === item.googleEventId);
        if (existingIdx !== -1) {
          tasks[existingIdx] = {
            ...tasks[existingIdx],
            task: item.task || tasks[existingIdx].task,
            deadline: item.deadline !== undefined ? item.deadline : tasks[existingIdx].deadline,
            urgency: item.urgency || tasks[existingIdx].urgency,
            scheduledSlot: item.scheduledSlot !== undefined ? item.scheduledSlot : tasks[existingIdx].scheduledSlot,
            category: item.category || tasks[existingIdx].category,
            updatedAt: new Date().toISOString(),
          };
          updated.push(tasks[existingIdx]);
          continue;
        }
      }

      const id = item.id || `task-${nanoid(8)}`;
      const newTask = {
        id,
        task: item.task || 'Untitled Task',
        deadline: item.deadline || null,
        urgency: item.urgency || 'medium',
        scheduledSlot: item.scheduledSlot || null,
        category: item.category || 'General',
        completed: Boolean(item.completed),
        googleEventId: item.googleEventId || null,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      added.push(newTask);
    }

    await writeAll(tasks);
    return { added, updated, total: added.length + updated.length };
  },

  async updateTask(id, updates) {
    const tasks = await readAll();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    tasks[idx] = {
      ...tasks[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await writeAll(tasks);
    return tasks[idx];
  },

  async deleteTask(id) {
    const tasks = await readAll();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;

    tasks.splice(idx, 1);
    await writeAll(tasks);
    return true;
  },

  async replaceAll(newTasks) {
    await writeAll(newTasks);
    return newTasks;
  },
};

module.exports = db;
