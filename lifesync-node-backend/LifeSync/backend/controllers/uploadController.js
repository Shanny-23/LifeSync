const path = require('path');
const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const { parseIcs, parseCsv, parseJson } = require('../utils/uploadParsers');

// @route POST /api/upload
// Accepts a single .ics, .csv, .json, or .txt(csv-formatted) file and
// bulk-creates tasks for the authenticated user.
const uploadSchedule = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded. Attach a file under the "file" field.');
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let result;

  switch (ext) {
    case '.ics':
      result = parseIcs(req.file.buffer);
      break;
    case '.csv':
    case '.txt':
      result = parseCsv(req.file.buffer);
      break;
    case '.json':
      result = parseJson(req.file.buffer);
      break;
    default:
      res.status(400);
      throw new Error(`Unsupported file type "${ext}". Use .ics, .csv, .json, or .txt`);
  }

  const { tasks: parsedTasks, errors } = result;

  if (parsedTasks.length === 0) {
    res.status(422);
    throw new Error(
      `No valid tasks could be parsed from this file.${errors.length ? ' Errors: ' + errors.join('; ') : ''}`
    );
  }

  const docs = parsedTasks.map((t) => ({ ...t, owner: req.user._id }));
  const created = await Task.insertMany(docs);

  res.status(201).json({
    success: true,
    fileName: req.file.originalname,
    imported: created.length,
    skipped: errors.length,
    errors,
    tasks: created,
  });
});

module.exports = { uploadSchedule };
