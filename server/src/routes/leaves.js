const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getOfficeSettings } = require('../settings');
const { sendLeaveApplicationEmail } = require('../mailer');
const { sendPushToAdmins, sendPushToEmployees } = require('../push');

const router = express.Router();

// Default annual leave quotas per type (days per year)
// Can be overridden via office_settings keys: quota_sick, quota_casual, quota_earned
const DEFAULT_LEAVE_QUOTAS = {
  sick: 12,
  casual: 12,
  earned: 15,
  // unpaid and other have no quota limit
};

function getLeaveQuota(leaveType) {
  const settings = getOfficeSettings();
  const settingKey = `quota_${leaveType}`;
  if (settings[settingKey] !== undefined) {
    const val = parseInt(settings[settingKey]);
    if (val === 0) return null; // 0 means no limit (admin disabled quota)
    if (val > 0) return val;
  }
  return DEFAULT_LEAVE_QUOTAS[leaveType] || null;
}

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

  // Check for overlapping leaves (pending or approved)
  const overlap = db.prepare(`
    SELECT id, start_date, end_date, status FROM leaves
    WHERE employee_id = ? AND status IN ('pending', 'approved')
      AND start_date <= ? AND end_date >= ?
  `).get(req.user.id, end_date, start_date);

  if (overlap) {
    return res.status(400).json({
      error: `Leave dates overlap with an existing ${overlap.status} leave (${overlap.start_date} to ${overlap.end_date})`
    });
  }

  // Check annual quota for leave types that have limits
  const quota = getLeaveQuota(leave_type);
  if (quota) {
    const currentYear = new Date().getFullYear().toString();
    const usedDays = db.prepare(`
      SELECT COALESCE(SUM(days), 0) as total FROM leaves
      WHERE employee_id = ? AND leave_type = ? AND status IN ('pending', 'approved')
        AND strftime('%Y', start_date) = ?
    `).get(req.user.id, leave_type, currentYear).total;

    if (usedDays + days > quota) {
      const remaining = Math.max(0, quota - usedDays);
      return res.status(400).json({
        error: `${leave_type.charAt(0).toUpperCase() + leave_type.slice(1)} leave quota exceeded. Annual limit: ${quota} days, used: ${usedDays}, remaining: ${remaining}, requested: ${days}`
      });
    }
  }

  const result = db.prepare(
    'INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, leave_type, start_date, end_date, days, reason);

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(result.lastInsertRowid);

  // Send email notification to admin (fire-and-forget, won't block response)
  sendLeaveApplicationEmail({
    employeeName: req.user.name,
    empCode: req.user.employee_id,
    department: req.user.department,
    leaveType: leave_type,
    startDate: start_date,
    endDate: end_date,
    days,
    reason,
  });

  // Push notification to all admins
  sendPushToAdmins({
    title: '📋 New Leave Request',
    body: `${req.user.name} applied for ${days}d ${leave_type} leave (${start_date} to ${end_date})`,
    data: { type: 'leave_request', leaveId: leave.id },
  });

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

  // Push notification to the employee
  const emoji = status === 'approved' ? '✅' : '❌';
  const statusText = status === 'approved' ? 'Approved' : 'Rejected';
  sendPushToEmployees([leave.employee_id], {
    title: `${emoji} Leave ${statusText}`,
    body: review_note
      ? `Your ${leave.leave_type} leave (${leave.start_date} to ${leave.end_date}) was ${status}: ${review_note}`
      : `Your ${leave.leave_type} leave (${leave.start_date} to ${leave.end_date}) was ${status}.`,
    data: { type: 'leave_review', leaveId: leave.id, status },
  });

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
