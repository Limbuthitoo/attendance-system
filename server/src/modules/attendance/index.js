// ─────────────────────────────────────────────────────────────────────────────
// Attendance Module Index (includes leaves, holidays)
// ─────────────────────────────────────────────────────────────────────────────

const attendanceService = require('../../services/attendance.service');
const leaveService = require('../../services/leave.service');
const attendanceRoutes = require('../../routes/v1/attendance');
const leaveRoutes = require('../../routes/v1/leaves');
const holidayRoutes = require('../../routes/v1/holidays');

module.exports = {
  name: 'attendance',
  routes: { attendance: attendanceRoutes, leaves: leaveRoutes, holidays: holidayRoutes },
  service: { attendance: attendanceService, leave: leaveService },
  moduleCode: 'attendance',
};
