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
  // Convert Date object to plain YYYY-MM-DD string for frontend compatibility
  if (r.date instanceof Date) {
    r.date = r.date.toISOString().split('T')[0];
  }
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

    // The date column is a PostgreSQL DATE type — use a plain date string for exact match
    const dateFilter = new Date(date + 'T00:00:00.000Z');

    const [records, approvedLeaves] = await Promise.all([
      prisma.attendance.findMany({
        where: { orgId, date: dateFilter },
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, department: true, designation: true } },
        },
        orderBy: { checkIn: 'asc' },
      }),
      // Find approved leaves that cover this date but have no attendance record
      prisma.leave.findMany({
        where: {
          orgId,
          status: 'APPROVED',
          startDate: { lte: dateFilter },
          endDate: { gte: dateFilter },
        },
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, department: true, designation: true } },
        },
      }),
    ]);

    const attendance = records.map(transformAtt);

    // Add virtual ON_LEAVE entries for approved leaves without attendance records
    const existingEmployeeIds = new Set(records.map(r => r.employeeId));
    for (const leave of approvedLeaves) {
      if (!existingEmployeeIds.has(leave.employeeId)) {
        attendance.push(transformAtt({
          id: `leave-${leave.id}`,
          orgId,
          employeeId: leave.employeeId,
          date: dateFilter,
          status: 'ON_LEAVE',
          checkIn: null,
          checkOut: null,
          workHours: null,
          source: 'SYSTEM',
          notes: `On ${leave.leaveType.toLowerCase()} leave${leave.isHalfDay ? ' (half-day)' : ''}`,
          employee: leave.employee,
        }));
        existingEmployeeIds.add(leave.employeeId);
      }
    }

    // Compute summary and departments for the frontend
    const summary = { total: attendance.length, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, holiday: 0, weeklyOff: 0, missingCheckout: 0, earlyExit: 0 };
    const deptSet = new Set();
    for (const a of attendance) {
      if (a.status === 'present') summary.present++;
      else if (a.status === 'late') summary.late++;
      else if (a.status === 'half-day' || a.status === 'half_day') summary.halfDay++;
      else if (a.status === 'absent') summary.absent++;
      else if (a.status === 'on-leave' || a.status === 'on_leave') summary.onLeave++;
      else if (a.status === 'holiday') summary.holiday++;
      else if (a.status === 'weekly-off' || a.status === 'weekly_off') summary.weeklyOff++;
      else if (a.status === 'missing-checkout' || a.status === 'missing_checkout') summary.missingCheckout++;
      else if (a.status === 'early-exit' || a.status === 'early_exit') summary.earlyExit++;
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

// POST /api/v1/attendance/finalize — Admin: manually finalize attendance for a date
router.post('/finalize', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { date } = req.body; // optional YYYY-MM-DD, defaults to yesterday
    const targetDate = date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    const result = await attendanceService.finalizeAttendance({ orgId: req.orgId, date: targetDate });
    res.json({ message: 'Attendance finalized', ...result });
  } catch (err) {
    next(err);
  }
});

// ─── Attendance Corrections (Regularization) ────────────────────────────────

const correctionService = require('../../services/attendance-correction.service');

// POST /api/v1/attendance/corrections — Employee requests correction
router.post('/corrections', async (req, res, next) => {
  try {
    const { date, correctionType, requestedCheckIn, requestedCheckOut, reason } = req.body;
    const correction = await correctionService.requestCorrection({
      orgId: req.orgId,
      employeeId: req.user.id,
      date,
      correctionType,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      req,
    });
    res.status(201).json(correction);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/corrections/my — Employee's own correction requests
router.get('/corrections/my', async (req, res, next) => {
  try {
    const corrections = await correctionService.getMyCorrections({
      employeeId: req.user.id,
      orgId: req.orgId,
    });
    res.json(corrections);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/attendance/corrections — Admin/Manager: list all correction requests
router.get('/corrections', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await correctionService.getOrgCorrections({
      orgId: req.orgId,
      status: status || undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/attendance/corrections/:id/review — Admin/Manager approves/rejects
router.put('/corrections/:id/review', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }
    const result = await correctionService.reviewCorrection({
      correctionId: req.params.id,
      reviewerId: req.user.id,
      orgId: req.orgId,
      status,
      reviewNote,
      req,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/attendance/lock — Admin: lock attendance for a month (after payroll)
router.post('/lock', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const { getPrisma } = require('../../lib/prisma');
    const prisma = getPrisma();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { count } = await prisma.attendance.updateMany({
      where: {
        orgId: req.orgId,
        date: { gte: startDate, lte: endDate },
      },
      data: { isLocked: true },
    });

    res.json({ message: `Locked ${count} attendance records for ${year}-${String(month).padStart(2, '0')}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
