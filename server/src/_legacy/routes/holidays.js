const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get holidays for a BS year (any authenticated user)
router.get('/', authenticate, (req, res) => {
  const year = parseInt(req.query.year) || 2083;
  const db = getDB();
  const holidays = db.prepare('SELECT * FROM holidays WHERE bs_year = ? ORDER BY bs_month, bs_day').all(year);
  res.json({ holidays });
});

// Create a holiday (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { bs_year, bs_month, bs_day, bs_day_end, bs_month_end, name, name_np, ad_date, ad_date_end, women_only } = req.body;

  if (!bs_year || !bs_month || !bs_day || !name) {
    return res.status(400).json({ error: 'bs_year, bs_month, bs_day, and name are required' });
  }

  if (bs_month < 1 || bs_month > 12 || bs_day < 1 || bs_day > 32) {
    return res.status(400).json({ error: 'Invalid BS date' });
  }

  const db = getDB();
  const result = db.prepare(
    `INSERT INTO holidays (bs_year, bs_month, bs_day, bs_day_end, bs_month_end, name, name_np, ad_date, ad_date_end, women_only)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(bs_year, bs_month, bs_day, bs_day_end || null, bs_month_end || null, name, name_np || null, ad_date || null, ad_date_end || null, women_only ? 1 : 0);

  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ holiday });
});

// Update a holiday (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { bs_year, bs_month, bs_day, bs_day_end, bs_month_end, name, name_np, ad_date, ad_date_end, women_only } = req.body;

  if (!bs_year || !bs_month || !bs_day || !name) {
    return res.status(400).json({ error: 'bs_year, bs_month, bs_day, and name are required' });
  }

  const db = getDB();
  const existing = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Holiday not found' });
  }

  db.prepare(
    `UPDATE holidays SET bs_year = ?, bs_month = ?, bs_day = ?, bs_day_end = ?, bs_month_end = ?, name = ?, name_np = ?, ad_date = ?, ad_date_end = ?, women_only = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(bs_year, bs_month, bs_day, bs_day_end || null, bs_month_end || null, name, name_np || null, ad_date || null, ad_date_end || null, women_only ? 1 : 0, id);

  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id);
  res.json({ holiday });
});

// Delete a holiday (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = getDB();

  const existing = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Holiday not found' });
  }

  db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
  res.json({ message: 'Holiday deleted' });
});

module.exports = router;
