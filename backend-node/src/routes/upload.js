const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const { parseJSON, parseCSV, parseICS } = require('../utils/parsers');
const { findConflicts } = require('../utils/conflicts');

// Configure multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/upload
 * Handles .json, .csv, .ics file uploads
 * Query param: ?commit=true to persist tasks, otherwise returns preview + conflicts
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in upload request' });
    }

    const filename = req.file.originalname.toLowerCase();
    const content = req.file.buffer.toString('utf8');
    let parsedTasks = [];

    if (filename.endsWith('.json')) {
      parsedTasks = parseJSON(content);
    } else if (filename.endsWith('.csv')) {
      parsedTasks = parseCSV(content);
    } else if (filename.endsWith('.ics')) {
      parsedTasks = parseICS(content);
    } else {
      // Try JSON first as fallback
      try {
        parsedTasks = parseJSON(content);
      } catch {
        return res.status(400).json({
          error: 'Unsupported file format',
          message: 'Please upload a valid .json, .csv, or .ics calendar file',
        });
      }
    }

    if (parsedTasks.length === 0) {
      return res.status(400).json({ error: 'No valid tasks or events could be extracted from the file' });
    }

    // Run conflict detection against existing tasks
    const existingTasks = await db.getAllTasks();
    const conflicts = findConflicts(parsedTasks, existingTasks);

    const shouldCommit = req.query.commit === 'true';

    if (shouldCommit) {
      const saveResult = await db.addTasks(parsedTasks);
      return res.status(201).json({
        success: true,
        committed: true,
        addedCount: saveResult.added.length,
        updatedCount: saveResult.updated.length,
        conflicts,
        tasks: saveResult.added.concat(saveResult.updated),
      });
    }

    // Preview mode
    return res.json({
      success: true,
      committed: false,
      preview: true,
      tasksCount: parsedTasks.length,
      conflictsCount: conflicts.length,
      conflicts,
      tasks: parsedTasks,
    });
  } catch (err) {
    console.error('[Upload] Error processing file:', err);
    res.status(500).json({ error: 'Failed to process uploaded file', message: err.message });
  }
});

module.exports = router;
