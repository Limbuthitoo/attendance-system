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
