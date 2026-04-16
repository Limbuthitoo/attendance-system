const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getOfficeSettings, invalidateCache } = require('../settings');

const router = express.Router();

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

module.exports = router;
