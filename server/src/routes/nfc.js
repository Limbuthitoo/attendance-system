const express = require('express');
const { getDB } = require('../db');
const { authenticateDevice } = require('../middleware/deviceAuth');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── NFC Tap Ingestion (called by reader service) ──────────────────────────

router.post('/tap', authenticateDevice, (req, res) => {
  const { cardUid, deviceId, timestamp } = req.body;

  if (!cardUid || typeof cardUid !== 'string') {
    return res.status(400).json({ status: 'ERROR', error: 'cardUid is required' });
  }

  const db = getDB();
  const tapTime = timestamp || new Date().toISOString();
  const today = new Date(tapTime).toISOString().split('T')[0];

  // Log helper — writes every tap to audit log
  function logTap(employeeId, result, attendanceId) {
    db.prepare(
      'INSERT INTO nfc_tap_log (card_uid, device_id, employee_id, result, attendance_id, tap_time) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(cardUid, deviceId || null, employeeId, result, attendanceId, tapTime);
  }

  // 1. Look up the card
  const card = db.prepare(
    'SELECT nc.*, e.id AS emp_id, e.name, e.employee_id AS emp_code, e.is_active AS emp_active FROM nfc_cards nc JOIN employees e ON nc.employee_id = e.id WHERE nc.card_uid = ?'
  ).get(cardUid);

  if (!card) {
    logTap(null, 'UNKNOWN_CARD', null);
    return res.json({ status: 'UNKNOWN_CARD', message: 'Card not registered' });
  }

  if (!card.is_active) {
    logTap(card.emp_id, 'INACTIVE_CARD', null);
    return res.json({ status: 'INACTIVE_CARD', message: 'Card is deactivated', employee: card.name });
  }

  if (!card.emp_active) {
    logTap(card.emp_id, 'INACTIVE_CARD', null);
    return res.json({ status: 'INACTIVE_CARD', message: 'Employee account is inactive', employee: card.name });
  }

  const employeeId = card.emp_id;

  // 2. Get today's attendance record
  const existing = db.prepare(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?'
  ).get(employeeId, today);

  // 3. Decide action: check-in, check-out, or duplicate
  const now = new Date(tapTime);

  if (!existing || !existing.check_in) {
    // ── CHECK IN ──
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isLate = hour > 9 || (hour === 9 && minute > 30);
    const status = isLate ? 'late' : 'present';

    let attendanceId;
    if (existing) {
      db.prepare('UPDATE attendance SET check_in = ?, status = ?, notes = COALESCE(notes, \'\') || ? WHERE id = ?')
        .run(tapTime, status, ' [NFC]', existing.id);
      attendanceId = existing.id;
    } else {
      const result = db.prepare(
        'INSERT INTO attendance (employee_id, date, check_in, status, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(employeeId, today, tapTime, status, '[NFC]');
      attendanceId = result.lastInsertRowid;
    }

    logTap(employeeId, 'CHECKED_IN', attendanceId);
    return res.json({
      status: 'CHECKED_IN',
      message: `${card.name} checked in`,
      employee: card.name,
      empCode: card.emp_code,
      time: tapTime,
      late: isLate,
    });
  }

  if (existing.check_in && !existing.check_out) {
    // ── CHECK OUT ──
    const checkInTime = new Date(existing.check_in);
    const workHours = ((now - checkInTime) / (1000 * 60 * 60)).toFixed(2);
    const attendanceStatus = parseFloat(workHours) < 4 ? 'half-day' : existing.status;

    db.prepare('UPDATE attendance SET check_out = ?, work_hours = ?, status = ?, notes = COALESCE(notes, \'\') || ? WHERE id = ?')
      .run(tapTime, parseFloat(workHours), attendanceStatus, ' [NFC]', existing.id);

    logTap(employeeId, 'CHECKED_OUT', existing.id);
    return res.json({
      status: 'CHECKED_OUT',
      message: `${card.name} checked out`,
      employee: card.name,
      empCode: card.emp_code,
      time: tapTime,
      workHours: parseFloat(workHours),
    });
  }

  // ── Already checked in and out ──
  logTap(employeeId, 'DUPLICATE_IGNORED', existing.id);
  return res.json({
    status: 'DUPLICATE_IGNORED',
    message: `${card.name} already completed today`,
    employee: card.name,
    empCode: card.emp_code,
  });
});

// ─── NFC Card Management (admin, JWT-protected) ────────────────────────────

// List all NFC cards
router.get('/cards', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const cards = db.prepare(`
    SELECT nc.*, e.name, e.employee_id AS emp_code, e.department
    FROM nfc_cards nc
    JOIN employees e ON nc.employee_id = e.id
    ORDER BY nc.assigned_at DESC
  `).all();
  res.json({ cards });
});

// Get cards for a specific employee
router.get('/cards/employee/:employeeId', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const cards = db.prepare(
    'SELECT * FROM nfc_cards WHERE employee_id = ? ORDER BY assigned_at DESC'
  ).all(req.params.employeeId);
  res.json({ cards });
});

// Assign a new NFC card to an employee
router.post('/cards', authenticate, requireAdmin, (req, res) => {
  const { card_uid, employee_id, label } = req.body;

  if (!card_uid || !employee_id) {
    return res.status(400).json({ error: 'card_uid and employee_id are required' });
  }

  const db = getDB();

  // Check employee exists
  const employee = db.prepare('SELECT id, name FROM employees WHERE id = ?').get(employee_id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  // Check card not already assigned
  const existing = db.prepare('SELECT * FROM nfc_cards WHERE card_uid = ?').get(card_uid);
  if (existing) {
    return res.status(400).json({ error: 'Card UID already assigned to an employee' });
  }

  const result = db.prepare(
    'INSERT INTO nfc_cards (card_uid, employee_id, label) VALUES (?, ?, ?)'
  ).run(card_uid, employee_id, label || null);

  const card = db.prepare('SELECT * FROM nfc_cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Card assigned', card });
});

// Deactivate a card
router.put('/cards/:id/deactivate', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const card = db.prepare('SELECT * FROM nfc_cards WHERE id = ?').get(req.params.id);

  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  db.prepare("UPDATE nfc_cards SET is_active = 0, deactivated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);

  res.json({ message: 'Card deactivated' });
});

// Reactivate a card
router.put('/cards/:id/activate', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const card = db.prepare('SELECT * FROM nfc_cards WHERE id = ?').get(req.params.id);

  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  db.prepare('UPDATE nfc_cards SET is_active = 1, deactivated_at = NULL WHERE id = ?')
    .run(req.params.id);

  res.json({ message: 'Card activated' });
});

// Delete a card assignment
router.delete('/cards/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const card = db.prepare('SELECT * FROM nfc_cards WHERE id = ?').get(req.params.id);

  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  db.prepare('DELETE FROM nfc_cards WHERE id = ?').run(req.params.id);
  res.json({ message: 'Card removed' });
});

// ─── NFC Reader Devices (admin) ────────────────────────────────────────────

router.get('/readers', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const readers = db.prepare('SELECT * FROM nfc_readers ORDER BY created_at DESC').all();
  res.json({ readers });
});

router.post('/readers', authenticate, requireAdmin, (req, res) => {
  const { device_id, name, location } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }

  const db = getDB();
  const existing = db.prepare('SELECT * FROM nfc_readers WHERE device_id = ?').get(device_id);
  if (existing) {
    return res.status(400).json({ error: 'Device ID already registered' });
  }

  db.prepare('INSERT INTO nfc_readers (device_id, name, location) VALUES (?, ?, ?)')
    .run(device_id, name || null, location || null);

  res.status(201).json({ message: 'Reader registered' });
});

// ─── Tap Log (admin) ───────────────────────────────────────────────────────

router.get('/tap-log', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { date, limit: queryLimit } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const rowLimit = Math.min(parseInt(queryLimit) || 100, 500);

  const logs = db.prepare(`
    SELECT tl.*, e.name, e.employee_id AS emp_code
    FROM nfc_tap_log tl
    LEFT JOIN employees e ON tl.employee_id = e.id
    WHERE DATE(tl.tap_time) = ?
    ORDER BY tl.tap_time DESC
    LIMIT ?
  `).all(targetDate, rowLimit);

  res.json({ logs, date: targetDate });
});

// ─── NFC Write Jobs ────────────────────────────────────────────────────────

// Admin: create a write job (queue employee ID to be written to next card)
router.post('/write-jobs', authenticate, requireAdmin, (req, res) => {
  const { employee_id, device_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  const db = getDB();

  const employee = db.prepare(
    'SELECT id, employee_id, name FROM employees WHERE id = ? AND is_active = 1'
  ).get(employee_id);

  if (!employee) {
    return res.status(404).json({ error: 'Active employee not found' });
  }

  // Cancel any existing pending write job for this employee
  db.prepare(
    "UPDATE nfc_write_jobs SET status = 'cancelled' WHERE employee_id = ? AND status = 'pending'"
  ).run(employee_id);

  // The data written to the card: just the employee_id string (e.g., "ARC-002")
  const result = db.prepare(
    'INSERT INTO nfc_write_jobs (employee_id, data_to_write, device_id) VALUES (?, ?, ?)'
  ).run(employee_id, employee.employee_id, device_id || null);

  const job = db.prepare('SELECT * FROM nfc_write_jobs WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({
    message: `Write job queued — place card on reader for ${employee.name}`,
    job,
  });
});

// Admin: list write jobs
router.get('/write-jobs', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { status } = req.query;

  let query = `
    SELECT wj.*, e.name, e.employee_id AS emp_code
    FROM nfc_write_jobs wj
    JOIN employees e ON wj.employee_id = e.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE wj.status = ?';
    params.push(status);
  }

  query += ' ORDER BY wj.created_at DESC LIMIT 50';
  const jobs = db.prepare(query).all(...params);
  res.json({ jobs });
});

// Admin: cancel a pending write job
router.put('/write-jobs/:id/cancel', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const job = db.prepare('SELECT * FROM nfc_write_jobs WHERE id = ? AND status = ?').get(req.params.id, 'pending');

  if (!job) {
    return res.status(404).json({ error: 'Pending write job not found' });
  }

  db.prepare("UPDATE nfc_write_jobs SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Write job cancelled' });
});

// Reader service: poll for pending write jobs
router.get('/write-jobs/pending', authenticateDevice, (req, res) => {
  const db = getDB();
  const deviceId = req.query.device_id;

  let query = "SELECT wj.*, e.employee_id AS emp_code, e.name FROM nfc_write_jobs wj JOIN employees e ON wj.employee_id = e.id WHERE wj.status = 'pending'";
  const params = [];

  if (deviceId) {
    query += ' AND (wj.device_id = ? OR wj.device_id IS NULL)';
    params.push(deviceId);
  }

  query += ' ORDER BY wj.created_at ASC LIMIT 1';
  const job = db.prepare(query).get(...params);

  res.json({ job: job || null });
});

// Reader service: report write result
router.put('/write-jobs/:id/complete', authenticateDevice, (req, res) => {
  const { card_uid, success, error_message } = req.body;

  const db = getDB();
  const job = db.prepare('SELECT * FROM nfc_write_jobs WHERE id = ?').get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Write job not found' });
  }

  if (success && card_uid) {
    // Mark job completed
    db.prepare(
      "UPDATE nfc_write_jobs SET status = 'completed', result_card_uid = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(card_uid, req.params.id);

    // Auto-assign the card to the employee (if not already assigned)
    const existingCard = db.prepare('SELECT * FROM nfc_cards WHERE card_uid = ?').get(card_uid);
    if (!existingCard) {
      db.prepare(
        'INSERT INTO nfc_cards (card_uid, employee_id, label) VALUES (?, ?, ?)'
      ).run(card_uid, job.employee_id, `Auto-provisioned`);
    }

    return res.json({ status: 'completed', message: 'Card written and registered', card_uid });
  } else {
    db.prepare(
      "UPDATE nfc_write_jobs SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(error_message || 'Unknown error', req.params.id);

    return res.json({ status: 'failed', message: error_message || 'Write failed' });
  }
});

module.exports = router;
