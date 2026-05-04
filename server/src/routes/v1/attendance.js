// ─────────────────────────────────────────────────────────────────────────────
// Attendance Routes (v1) — Check-in, check-out, history
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const attendanceService = require('../../services/attendance.service');
const { addSnakeCase, lowercaseEnum } = require('../../lib/compat');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// Transform attendance record for backward compat
function transformAtt(r) {
  if (!r) return r;
  // Convert Prisma Decimal to plain number before addSnakeCase strips prototype
  if (r.workHours != null) r.workHours = parseFloat(r.workHours);
  const t = addSnakeCase(r);
  if (t.status) {
    t.status = lowercaseEnum(t.status);
  }
  // Flatten employee for /all endpoint
  if (t.employee) {
    t.name = t.employee.name;
    t.emp_code = t.employee.employeeCode || t.employee.employee_code;
    t.employee_id = t.employee.employeeCode || t.employee.employee_code;
    t.department = t.employee.department;
  }
  return t;
}

// POST /api/v1/attendance/check-in
router.post('/check-in', async (req, res, next) => {
  try {
    const attendance = await attendanceService.checkIn({
      employeeId: req.user.id,
      orgId: req.orgId,
      notes: req.body.notes,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      req,
    });
    res.json({ attendance: transformAtt(attendance), message: 'Checked in successfully' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/attendance/check-out
router.post('/check-out', async (req, res, next) => {
  try {
    const attendance = await attendanceService.checkOut({
      employeeId: req.user.id,
      orgId: req.orgId,
      notes: req.body.notes,
      req,
    });
    res.json({ attendance: transformAtt(attendance), message: 'Checked out successfully' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/attendance/today — Today's status for current user
router.get('/today', async (req, res, next) => {
  try {
    const today = attendanceService.getTodayDate();
    const records = await attendanceService.getEmployeeAttendance({
      employeeId: req.user.id,
      orgId: req.orgId,
      startDate: today,
      endDate: today,
    });

    res.json({ attendance: transformAtt(records[0]) || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/history?month=X&year=Y — Monthly history
router.get('/history', async (req, res, next) => {
  try {
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year required' });
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const records = await attendanceService.getEmployeeAttendance({
      employeeId: req.user.id,
      orgId: req.orgId,
      startDate,
      endDate,
    });

    res.json({ attendance: records.map(transformAtt) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/all?date=YYYY-MM-DD — Admin: all employees for a date
router.get('/all', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const date = req.query.date || attendanceService.getTodayDate();
    const prisma = getPrisma();
    const orgId = req.orgId;

    const dateStart = new Date(date + 'T00:00:00+05:45');
    const dateEnd = new Date(date + 'T23:59:59+05:45');

    const records = await prisma.attendance.findMany({
      where: { orgId, date: { gte: dateStart, lte: dateEnd } },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, department: true, designation: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    const attendance = records.map(transformAtt);

    // Compute summary and departments for the frontend
    const summary = { total: attendance.length, present: 0, late: 0, halfDay: 0, absent: 0 };
    const deptSet = new Set();
    for (const a of attendance) {
      if (a.status === 'present') summary.present++;
      else if (a.status === 'late') summary.late++;
      else if (a.status === 'half-day' || a.status === 'half_day') summary.halfDay++;
      else if (a.status === 'absent') summary.absent++;
      if (a.department) deptSet.add(a.department);
    }

    res.json({ attendance, summary, departments: [...deptSet].sort() });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/my — Current user's attendance
router.get('/my', async (req, res, next) => {
  try {
    const startDate = req.query.startDate || req.query.start_date || attendanceService.getTodayDate();
    const endDate = req.query.endDate || req.query.end_date || startDate;

    const records = await attendanceService.getEmployeeAttendance({
      employeeId: req.user.id,
      orgId: req.orgId,
      startDate,
      endDate,
    });

    res.json({ attendance: records.map(transformAtt) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/employee/:id — Admin: specific employee attendance
router.get('/employee/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const startDate = req.query.startDate || req.query.start_date || attendanceService.getTodayDate();
    const endDate = req.query.endDate || req.query.end_date || startDate;

    const records = await attendanceService.getEmployeeAttendance({
      employeeId: req.params.id,
      orgId: req.orgId,
      startDate,
      endDate,
    });

    res.json({ attendance: records.map(transformAtt) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/summary — Admin: org-wide attendance summary
router.get('/summary', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const summary = await attendanceService.getOrgAttendanceSummary(req.orgId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
