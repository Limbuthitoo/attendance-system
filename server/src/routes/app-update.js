const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// APK storage directory
const APK_DIR = path.join(__dirname, '..', '..', 'data', 'apk');
if (!fs.existsSync(APK_DIR)) {
  fs.mkdirSync(APK_DIR, { recursive: true });
}

// Multer config — accept only .apk files, max 100MB
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, APK_DIR),
    filename: (req, file, cb) => {
      // Store as app-{version}.apk
      const version = req.body.version || 'unknown';
      const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '');
      cb(null, `app-${safeVersion}.apk`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.apk') || file.mimetype === 'application/vnd.android.package-archive' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .apk files are allowed'));
    }
  },
});

// Check for app update (no auth required — mobile app calls this on launch)
// Semantic version comparison helper
function isVersionGreater(v1, v2) {
  if (!v1 || !v2) return false;
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

router.get('/check', (req, res) => {
  const db = getDB();
  const latest = db.prepare(
    'SELECT * FROM app_releases ORDER BY id DESC LIMIT 1'
  ).get();

  if (!latest) {
    return res.json({ update_available: false });
  }

  const currentVersion = req.query.current_version;
  let updateAvailable = true;
  if (currentVersion) {
    updateAvailable = isVersionGreater(latest.version, currentVersion);
  }

  res.json({
    update_available: updateAvailable,
    version: latest.version,
    release_notes: latest.release_notes,
    is_mandatory: !!latest.is_mandatory,
    file_size: latest.file_size,
    uploaded_at: latest.uploaded_at,
    download_url: `/api/app-update/download`,
  });
});

// Download latest APK (no auth — mobile needs to download)
router.get('/download', (req, res) => {
  const db = getDB();
  const latest = db.prepare(
    'SELECT * FROM app_releases ORDER BY id DESC LIMIT 1'
  ).get();

  if (!latest || !latest.filename) {
    return res.status(404).json({ error: 'No release available' });
  }

  const filePath = path.join(APK_DIR, latest.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'APK file not found' });
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);
  res.setHeader('Content-Length', latest.file_size);
  fs.createReadStream(filePath).pipe(res);
});

// Upload new APK (admin only)
router.post('/upload', authenticate, requireAdmin, (req, res) => {
  upload.single('apk')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'APK file is required' });
    }

    const { version, release_notes, is_mandatory } = req.body;
    if (!version) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Version is required' });
    }

    const db = getDB();

    // Delete old APK files (keep only the latest)
    const oldReleases = db.prepare('SELECT filename FROM app_releases').all();
    for (const old of oldReleases) {
      const oldPath = path.join(APK_DIR, old.filename);
      if (fs.existsSync(oldPath) && old.filename !== req.file.filename) {
        fs.unlinkSync(oldPath);
      }
    }

    // Clear old records and insert new
    db.prepare('DELETE FROM app_releases').run();

    const result = db.prepare(
      `INSERT INTO app_releases (version, filename, file_size, release_notes, is_mandatory, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      version,
      req.file.filename,
      req.file.size,
      release_notes || '',
      is_mandatory ? 1 : 0,
      req.user.id
    );

    const release = db.prepare('SELECT * FROM app_releases WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ release });
  });
});

// Get current release info (admin)
router.get('/current', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const release = db.prepare(
    'SELECT r.*, e.name as uploaded_by_name FROM app_releases r LEFT JOIN employees e ON r.uploaded_by = e.id ORDER BY r.id DESC LIMIT 1'
  ).get();

  res.json({ release: release || null });
});

// Delete current release (admin)
router.delete('/current', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const release = db.prepare('SELECT * FROM app_releases ORDER BY id DESC LIMIT 1').get();

  if (release) {
    const filePath = path.join(APK_DIR, release.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.prepare('DELETE FROM app_releases WHERE id = ?').run(release.id);
  }

  res.json({ message: 'Release deleted' });
});

module.exports = router;
