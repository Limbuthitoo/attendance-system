const express = require('express');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');
const { isLateCheckIn, getHalfDayHours } = require('../settings');

const router = express.Router();

// Check in
router.post('/check-in', authenticate, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);

  if (existing && existing.check_in) {
    return res.status(400).json({ error: 'Already checked in today' });
  }

  // Determine if late based on office settings
  const isLate = isLateCheckIn(new Date());

  if (existing) {
    db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?')
      .run(now, isLate ? 'late' : 'present', existing.id);
  } else {
    db.prepare('INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, ?)')
      .run(req.user.id, today, now, isLate ? 'late' : 'present');
  }

  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);
  res.json({ message: 'Checked in successfully', attendance: record });
});

// Check out
router.post('/check-out', authenticate, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);

  if (!existing || !existing.check_in) {
    return res.status(400).json({ error: 'Please check in first' });
  }

  if (existing.check_out) {
    return res.status(400).json({ error: 'Already checked out today' });
  }

  const checkInTime = new Date(existing.check_in);
  const checkOutTime = new Date(now);
  const workHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2);

  const status = parseFloat(workHours) < getHalfDayHours() ? 'half-day' : existing.status;

  db.prepare('UPDATE attendance SET check_out = ?, work_hours = ?, status = ? WHERE id = ?')
    .run(now, parseFloat(workHours), status, existing.id);

  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);
  res.json({ message: 'Checked out successfully', attendance: record });
});

// Get today's attendance for current user
router.get('/today', authenticate, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const record = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);
  res.json({ attendance: record || null });
});

// Get attendance history for current user
router.get('/history', authenticate, (req, res) => {
  const db = getDB();
  const { month, year } = req.query;

  let query = 'SELECT * FROM attendance WHERE employee_id = ?';
  const params = [req.user.id];

  if (month && year) {
    query += " AND strftime('%m', date) = ? AND strftime('%Y', date) = ?";
    params.push(month.toString().padStart(2, '0'), year.toString());
  }

  query += ' ORDER BY date DESC';
  const records = db.prepare(query).all(...params);
  res.json({ attendance: records });
});

// Get all attendance (admin)
router.get('/all', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const db = getDB();
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const records = db.prepare(`
    SELECT a.*, e.name, e.employee_id as emp_code, e.department, e.designation
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.date = ?
    ORDER BY a.check_in ASC
  `).all(targetDate);

  res.json({ attendance: records, date: targetDate });
});

module.exports = router;
