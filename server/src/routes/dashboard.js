const express = require('express');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/stats', authenticate, (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (req.user.role === 'admin') {
    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees WHERE is_active = 1').get().count;
    const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status IN ('present', 'late')").get(today).count;
    const onLeaveToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'absent'").get(today).count;
    const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'pending'").get().count;
    const lateToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'late'").get(today).count;

    // Monthly attendance summary
    const monthlyStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE date LIKE ? || '%'
      GROUP BY status
    `).all(currentMonth);

    res.json({
      totalEmployees,
      presentToday,
      onLeaveToday,
      pendingLeaves,
      lateToday,
      absentToday: totalEmployees - presentToday - onLeaveToday,
      monthlyStats
    });
  } else {
    // Employee's own stats
    const todayRecord = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(req.user.id, today);

    const monthAttendance = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE employee_id = ? AND date LIKE ? || '%'
      GROUP BY status
    `).all(req.user.id, currentMonth);

    const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE employee_id = ? AND status = 'pending'").get(req.user.id).count;
    const approvedLeaves = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE employee_id = ? AND status = 'approved' AND strftime('%Y', start_date) = strftime('%Y', 'now')").get(req.user.id).count;

    const totalWorkHours = db.prepare(`
      SELECT COALESCE(SUM(work_hours), 0) as total
      FROM attendance
      WHERE employee_id = ? AND date LIKE ? || '%'
    `).get(req.user.id, currentMonth).total;

    res.json({
      today: todayRecord,
      monthAttendance,
      pendingLeaves,
      approvedLeaves,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(1))
    });
  }
});

module.exports = router;

// ─── Activity Log ───────────────────────────────────────────────────────────
// Merged timeline of attendance, NFC taps, and leave activities

router.get('/activity-log', authenticate, (req, res) => {
  const db = getDB();
  const { date, employee_id, limit: qLimit } = req.query;
  const isAdmin = req.user.role === 'admin';
  const targetDate = date || new Date().toISOString().split('T')[0];
  const rowLimit = Math.min(parseInt(qLimit) || 100, 500);

  // For non-admin, force own employee_id
  const empFilter = isAdmin && employee_id ? parseInt(employee_id) : (isAdmin ? null : req.user.id);

  const activities = [];

  // 1. Attendance check-ins and check-outs
  let attQuery = `
    SELECT a.*, e.name, e.employee_id AS emp_code, e.department
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.date = ?
  `;
  const attParams = [targetDate];
  if (empFilter) {
    attQuery += ' AND a.employee_id = ?';
    attParams.push(empFilter);
  }
  attQuery += ' ORDER BY a.check_in DESC';

  const records = db.prepare(attQuery).all(...attParams);
  for (const r of records) {
    if (r.check_in) {
      activities.push({
        type: 'check_in',
        time: r.check_in,
        employee: r.name,
        empCode: r.emp_code,
        department: r.department,
        employeeId: r.employee_id,
        status: r.status,
        method: r.notes?.includes('[NFC]') ? 'NFC' : 'Manual',
      });
    }
    if (r.check_out) {
      activities.push({
        type: 'check_out',
        time: r.check_out,
        employee: r.name,
        empCode: r.emp_code,
        department: r.department,
        employeeId: r.employee_id,
        workHours: r.work_hours,
        method: r.notes?.includes('[NFC]') ? 'NFC' : 'Manual',
      });
    }
  }

  // 2. NFC tap log (admin only, shows all taps including errors)
  if (isAdmin) {
    let tapQuery = `
      SELECT tl.*, e.name, e.employee_id AS emp_code
      FROM nfc_tap_log tl
      LEFT JOIN employees e ON tl.employee_id = e.id
      WHERE DATE(tl.tap_time) = ?
    `;
    const tapParams = [targetDate];
    if (empFilter) {
      tapQuery += ' AND tl.employee_id = ?';
      tapParams.push(empFilter);
    }
    tapQuery += ' ORDER BY tl.tap_time DESC LIMIT ?';
    tapParams.push(rowLimit);

    const taps = db.prepare(tapQuery).all(...tapParams);
    for (const t of taps) {
      // Skip CHECKED_IN / CHECKED_OUT taps — already covered by attendance records
      if (t.result === 'CHECKED_IN' || t.result === 'CHECKED_OUT') continue;
      activities.push({
        type: 'nfc_tap',
        time: t.tap_time,
        employee: t.name || null,
        empCode: t.emp_code || null,
        employeeId: t.employee_id,
        cardUid: t.card_uid,
        deviceId: t.device_id,
        result: t.result,
      });
    }
  }

  // 3. Leave activities (applied, approved, rejected)
  let leaveQuery = `
    SELECT l.*, e.name, e.employee_id AS emp_code, e.department,
           r.name AS reviewer_name
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
    LEFT JOIN employees r ON l.reviewed_by = r.id
    WHERE DATE(l.created_at) = ? OR DATE(l.updated_at) = ?
  `;
  const leaveParams = [targetDate, targetDate];
  if (empFilter) {
    leaveQuery += ' AND l.employee_id = ?';
    leaveParams.push(empFilter);
  }
  leaveQuery += ' ORDER BY l.updated_at DESC';

  const leaves = db.prepare(leaveQuery).all(...leaveParams);
  for (const l of leaves) {
    if (l.created_at && l.created_at.startsWith(targetDate)) {
      activities.push({
        type: 'leave_applied',
        time: l.created_at,
        employee: l.name,
        empCode: l.emp_code,
        department: l.department,
        employeeId: l.employee_id,
        leaveType: l.leave_type,
        startDate: l.start_date,
        endDate: l.end_date,
        days: l.days,
        reason: l.reason,
      });
    }
    if (l.status !== 'pending' && l.updated_at && l.updated_at.startsWith(targetDate)) {
      activities.push({
        type: l.status === 'approved' ? 'leave_approved' : 'leave_rejected',
        time: l.updated_at,
        employee: l.name,
        empCode: l.emp_code,
        department: l.department,
        employeeId: l.employee_id,
        leaveType: l.leave_type,
        reviewerName: l.reviewer_name,
        reviewNote: l.review_note,
      });
    }
  }

  // Sort all by time descending
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));

  res.json({ activities: activities.slice(0, rowLimit), date: targetDate });
});
