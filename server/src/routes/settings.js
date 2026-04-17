const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getOfficeSettings, invalidateCache } = require('../settings');

const router = express.Router();

// Ensure uploads/branding directory exists
const brandingDir = path.join(__dirname, '..', '..', 'data', 'branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

// Multer config for logo/favicon uploads
const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, brandingDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const type = req.params.type; // 'logo' or 'favicon'
      cb(null, `${type}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (png, jpg, jpeg, svg, ico, webp) are allowed'));
    }
  },
});

// Get all office settings (any authenticated user can view)
router.get('/', authenticate, (req, res) => {
  res.json({ settings: getOfficeSettings() });
});

// Update office settings (admin only)
router.put('/', authenticate, requireAdmin, (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object is required' });
  }

  const ALLOWED_KEYS = [
    'office_start', 'office_end', 'late_threshold_minutes',
    'half_day_hours', 'full_day_hours', 'min_checkout_minutes',
    'working_days', 'timezone', 'company_name',
    'quota_sick', 'quota_casual', 'quota_earned',
  ];

  const db = getDB();
  const upsert = db.prepare(
    "INSERT INTO office_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );

  const updated = [];
  for (const [key, value] of Object.entries(settings)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    upsert.run(key, String(value));
    updated.push(key);
  }

  invalidateCache();

  res.json({ message: `Updated ${updated.length} settings`, updated, settings: getOfficeSettings() });
});

// Upload logo or favicon
router.post('/branding/:type', authenticate, requireAdmin, (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  brandingUpload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum 2MB allowed.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Save the filename in office_settings
    const db = getDB();
    const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';
    db.prepare(
      "INSERT INTO office_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(key, req.file.filename);
    invalidateCache();

    res.json({
      message: `${type} uploaded successfully`,
      filename: req.file.filename,
      url: `/api/settings/branding/${type}`,
    });
  });
});

// Delete logo or favicon
router.delete('/branding/:type', authenticate, requireAdmin, (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';
  const db = getDB();
  const row = db.prepare("SELECT value FROM office_settings WHERE key = ?").get(key);

  if (row && row.value) {
    const filePath = path.join(brandingDir, row.value);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  db.prepare("DELETE FROM office_settings WHERE key = ?").run(key);
  invalidateCache();

  res.json({ message: `${type} removed successfully` });
});

// Serve branding files (public — no auth needed for favicon/logo)
router.get('/branding/:type', (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';
  const db = getDB();
  const row = db.prepare("SELECT value FROM office_settings WHERE key = ?").get(key);

  if (!row || !row.value) {
    return res.status(404).json({ error: `No ${type} uploaded` });
  }

  const filePath = path.join(brandingDir, row.value);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `${type} file not found` });
  }

  res.sendFile(filePath);
});

module.exports = router;
