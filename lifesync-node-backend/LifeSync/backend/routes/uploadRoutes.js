const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { uploadSchedule } = require('../controllers/uploadController');

const router = express.Router();

const storage = multer.memoryStorage();
const ALLOWED_EXT = ['.ics', '.csv', '.json', '.txt'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = ('.' + file.originalname.split('.').pop()).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}". Use .ics, .csv, .json, or .txt`));
    }
    cb(null, true);
  },
});

router.post('/', protect, upload.single('file'), uploadSchedule);

module.exports = router;
