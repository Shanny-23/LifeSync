const mongoose = require('mongoose');

const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const formatDateTime = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return `${formatDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const formatTime = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const taskSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    task: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    scheduledStart: {
      type: Date,
      required: [true, 'Scheduled start time is required'],
    },
    scheduledEnd: {
      type: Date,
      required: [true, 'Scheduled end time is required'],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ['manual', 'ics', 'csv', 'json'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

taskSchema.index({ owner: 1, scheduledStart: 1 });

// Shape the JSON output to match the frontend's existing mock data format
// (task, deadline, urgency, scheduledSlot, category) so the React app can
// swap mockData for API calls with minimal changes.
taskSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    ret.deadline = formatDateTime(ret.deadline);
    ret.scheduledSlot = `${formatDateTime(ret.scheduledStart)} - ${formatTime(ret.scheduledEnd)}`;
    delete ret._id;
    delete ret.__v;
    delete ret.scheduledStart;
    delete ret.scheduledEnd;
    return ret;
  },
});

module.exports = mongoose.model('Task', taskSchema);
