const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply for leave
router.post('/', authenticate, (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;

  if (!leave_type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);

  if (end < start) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  const db = getDB();
  const result = db.prepare(
    'INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, leave_type, start_date, end_date, days, reason);

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Leave application submitted', leave });
});

// Get my leaves
router.get('/my', authenticate, (req, res) => {
  const db = getDB();
  const { status } = req.query;

  let query = 'SELECT * FROM leaves WHERE employee_id = ?';
  const params = [req.user.id];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const leaves = db.prepare(query).all(...params);
  res.json({ leaves });
});

// Get all leaves (admin)
router.get('/all', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { status } = req.query;

  let query = `
    SELECT l.*, e.name, e.employee_id as emp_code, e.department
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE l.status = ?';
    params.push(status);
  }

  query += ' ORDER BY l.created_at DESC';
  const leaves = db.prepare(query).all(...params);
  res.json({ leaves });
});

// Approve/Reject leave (admin)
router.put('/:id/review', authenticate, requireAdmin, (req, res) => {
  const { status, review_note } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const db = getDB();
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);

  if (!leave) {
    return res.status(404).json({ error: 'Leave not found' });
  }

  if (leave.status !== 'pending') {
    return res.status(400).json({ error: 'Leave already reviewed' });
  }

  db.prepare(
    "UPDATE leaves SET status = ?, reviewed_by = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, req.user.id, review_note || null, req.params.id);

  // If approved, mark attendance as absent for leave dates
  if (status === 'approved') {
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)'
    );

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      insertStmt.run(leave.employee_id, dateStr, 'absent', `On ${leave.leave_type} leave`);
    }
  }

  const updated = db.prepare(`
    SELECT l.*, e.name, e.employee_id as emp_code
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
    WHERE l.id = ?
  `).get(req.params.id);

  res.json({ message: `Leave ${status}`, leave: updated });
});

// Cancel leave (own pending leave only)
router.delete('/:id', authenticate, (req, res) => {
  const db = getDB();
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ? AND employee_id = ?').get(req.params.id, req.user.id);

  if (!leave) {
    return res.status(404).json({ error: 'Leave not found' });
  }

  if (leave.status !== 'pending') {
    return res.status(400).json({ error: 'Can only cancel pending leaves' });
  }

  db.prepare('DELETE FROM leaves WHERE id = ?').run(req.params.id);
  res.json({ message: 'Leave cancelled' });
});

module.exports = router;
