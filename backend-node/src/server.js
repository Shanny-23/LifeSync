const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LifeSync Node Backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
const tasksRouter = require('./routes/tasks');
const dashboardRouter = require('./routes/dashboard');
const uploadRouter = require('./routes/upload');
const googleRouter = require('./routes/google');

app.use('/api/tasks', tasksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/google', googleRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` LifeSync Backend running on http://localhost:${PORT}`);
    console.log(` Tasks API:       http://localhost:${PORT}/api/tasks`);
    console.log(` Dashboard API:   http://localhost:${PORT}/api/dashboard`);
    console.log(` Upload API:      http://localhost:${PORT}/api/upload`);
    console.log(` Google Sync API: http://localhost:${PORT}/api/google`);
    console.log(`====================================================`);
  });
}

module.exports = app;
