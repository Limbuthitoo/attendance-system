// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Routes (v1) — Aggregated data for admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// Helper: today's date as YYYY-MM-DD in Asia/Kathmandu
function todayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
}

// GET /api/v1/dashboard/stats — Admin: org stats, Employee: own stats
router.get('/stats', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;
    const today = todayDate();
    const currentMonth = today.slice(0, 7);
    const isAdmin = req.user.role === 'admin' || req.user.roles?.some(r => ['org_admin', 'hr_manager'].includes(r));

    if (isAdmin) {
      const todayFilter = new Date(today + 'T00:00:00.000Z');
      const monthStart = new Date(currentMonth + '-01T00:00:00.000Z');

      const [totalEmployees, presentToday, lateToday, halfDayToday, absentToday, earlyExitToday, pendingLeaves, monthlyRaw] = await Promise.all([
        prisma.employee.count({ where: { orgId, isActive: true } }),
        prisma.attendance.count({ where: { orgId, date: todayFilter, status: { in: ['PRESENT', 'LATE', 'EARLY_EXIT'] } } }),
        prisma.attendance.count({ where: { orgId, date: todayFilter, status: 'LATE' } }),
        prisma.attendance.count({ where: { orgId, date: todayFilter, status: 'HALF_DAY' } }),
        prisma.attendance.count({ where: { orgId, date: todayFilter, status: 'ABSENT' } }),
        prisma.attendance.count({ where: { orgId, date: todayFilter, status: 'EARLY_EXIT' } }),
        prisma.leave.count({ where: { orgId, status: 'PENDING' } }),
        prisma.attendance.groupBy({ by: ['status'], where: { orgId, date: { gte: monthStart } }, _count: true }),
      ]);

      const monthlyStats = monthlyRaw.map(r => ({
        status: r.status.toLowerCase().replace('_', '-'),
        count: r._count,
      }));

      res.json({
        totalEmployees,
        presentToday,
        lateToday,
        earlyExitToday,
        onLeaveToday: absentToday,
        absentToday: totalEmployees - presentToday - absentToday - halfDayToday,
        pendingLeaves,
        monthlyStats,
      });
    } else {
      const todayFilter = new Date(today + 'T00:00:00.000Z');
      const monthStart = new Date(currentMonth + '-01T00:00:00.000Z');
      const empId = req.user.id;

      const [todayRecord, monthRaw, pendingLeaves, approvedLeaves, workHoursAgg] = await Promise.all([
        prisma.attendance.findFirst({ where: { employeeId: empId, date: todayFilter } }),
        prisma.attendance.groupBy({ by: ['status'], where: { employeeId: empId, date: { gte: monthStart } }, _count: true }),
        prisma.leave.count({ where: { employeeId: empId, status: 'PENDING' } }),
        prisma.leave.count({ where: { employeeId: empId, status: 'APPROVED', startDate: { gte: new Date(`${new Date().getFullYear()}-01-01`) } } }),
        prisma.attendance.aggregate({ where: { employeeId: empId, date: { gte: monthStart } }, _sum: { workHours: true } }),
      ]);

      const monthAttendance = monthRaw.map(r => ({
        status: r.status.toLowerCase().replace('_', '-'),
        count: r._count,
      }));

      res.json({
        today: todayRecord,
        monthAttendance,
        pendingLeaves,
        approvedLeaves,
        totalWorkHours: parseFloat((workHoursAgg._sum.workHours || 0).toFixed(1)),
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/weekly-trend
router.get('/weekly-trend', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;
    const days = parseInt(req.query.days) || 7;
    const isAdmin = req.user.role === 'admin' || req.user.roles?.some(r => ['org_admin', 'hr_manager'].includes(r));
    const since = new Date();
    since.setDate(since.getDate() - days);

    if (isAdmin) {
      const records = await prisma.attendance.findMany({
        where: { orgId, date: { gte: since } },
        select: { date: true, status: true },
        orderBy: { date: 'asc' },
      });

      const byDate = {};
      for (const r of records) {
        const d = r.date.toISOString().slice(0, 10);
        if (!byDate[d]) byDate[d] = { date: d, present: 0, late: 0, halfDay: 0, absent: 0, earlyExit: 0 };
        const s = r.status.toLowerCase().replace('_', '');
        if (s === 'present') byDate[d].present++;
        else if (s === 'late') byDate[d].late++;
        else if (s === 'halfday' || s === 'half_day') byDate[d].halfDay++;
        else if (s === 'absent') byDate[d].absent++;
        else if (s === 'earlyexit' || s === 'early_exit') byDate[d].earlyExit++;
      }

      const totalEmployees = await prisma.employee.count({ where: { orgId, isActive: true } });
      res.json({ trend: Object.values(byDate), totalEmployees });
    } else {
      const records = await prisma.attendance.findMany({
        where: { employeeId: req.user.id, date: { gte: since } },
        select: { date: true, status: true, workHours: true, checkIn: true },
        orderBy: { date: 'asc' },
      });

      const trend = records.map(r => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status.toLowerCase().replace('_', '-'),
        work_hours: r.workHours,
        check_in_time: r.checkIn ? r.checkIn.toTimeString().slice(0, 5) : null,
      }));

      res.json({ trend });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/department-stats (admin only)
router.get('/department-stats', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;
    const today = todayDate();
    const todayFilter = new Date(today + 'T00:00:00.000Z');

    const employees = await prisma.employee.findMany({
      where: { orgId, isActive: true },
      select: { id: true, department: true },
    });

    const todayAtt = await prisma.attendance.findMany({
      where: { orgId, date: todayFilter },
      select: { employeeId: true, status: true },
    });

    const attByEmp = {};
    for (const a of todayAtt) attByEmp[a.employeeId] = a.status;

    const deptMap = {};
    for (const e of employees) {
      const dept = e.department || 'Other';
      if (!deptMap[dept]) deptMap[dept] = { department: dept, total: 0, present: 0, late: 0 };
      deptMap[dept].total++;
      const s = attByEmp[e.id];
      if (s === 'PRESENT' || s === 'LATE') deptMap[dept].present++;
      if (s === 'LATE') deptMap[dept].late++;
    }

    res.json({ departments: Object.values(deptMap).sort((a, b) => b.total - a.total) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/leave-stats
router.get('/leave-stats', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year + 1}-01-01`);
    const isAdmin = req.user.role === 'admin' || req.user.roles?.some(r => ['org_admin', 'hr_manager'].includes(r));

    const where = {
      orgId,
      status: 'APPROVED',
      startDate: { gte: yearStart, lt: yearEnd },
      ...(isAdmin ? {} : { employeeId: req.user.id }),
    };

    const byType = await prisma.leave.groupBy({
      by: ['leaveType'],
      where,
      _count: true,
      _sum: { days: true },
    });

    const byTypeFormatted = byType.map(r => ({
      type: r.leaveType.toLowerCase(),
      count: r._count,
      totalDays: r._sum.days || 0,
    }));

    if (isAdmin) {
      const allLeaves = await prisma.leave.findMany({
        where,
        select: { startDate: true },
      });
      const monthCounts = {};
      for (const l of allLeaves) {
        const m = String(l.startDate.getMonth() + 1).padStart(2, '0');
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
      const byMonth = Object.entries(monthCounts).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
      res.json({ byType: byTypeFormatted, byMonth });
    } else {
      res.json({ byType: byTypeFormatted });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/activity-log — Merged timeline
router.get('/activity-log', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;
    const { date, start_date, end_date, employee_id } = req.query;
    const rowLimit = Math.min(parseInt(req.query.limit) || 200, 500);
    const isAdmin = req.user.role === 'admin' || req.user.roles?.some(r => ['org_admin', 'hr_manager'].includes(r));

    const today = todayDate();
    const hasRange = start_date && end_date;
    const dateFrom = new Date((hasRange ? start_date : (date || today)) + 'T00:00:00.000Z');
    const dateTo = new Date((hasRange ? end_date : (date || today)) + 'T00:00:00.000Z');

    const empFilter = isAdmin && employee_id ? employee_id : (isAdmin ? undefined : req.user.id);

    const activities = [];

    // 1. Attendance
    const attWhere = { orgId, date: { gte: dateFrom, lte: dateTo }, ...(empFilter ? { employeeId: empFilter } : {}) };
    const records = await prisma.attendance.findMany({
      where: attWhere,
      include: { employee: { select: { name: true, employeeCode: true, department: true } } },
      orderBy: { checkIn: 'desc' },
      take: rowLimit,
    });

    for (const r of records) {
      if (r.checkIn) {
        activities.push({
          type: 'check_in', time: r.checkIn.toISOString(),
          employee: r.employee.name, empCode: r.employee.employeeCode,
          department: r.employee.department, employeeId: r.employeeId,
          status: r.status.toLowerCase().replace('_', '-'),
          method: r.source === 'NFC' ? 'NFC' : 'Manual',
        });
      }
      if (r.checkOut) {
        activities.push({
          type: 'check_out', time: r.checkOut.toISOString(),
          employee: r.employee.name, empCode: r.employee.employeeCode,
          department: r.employee.department, employeeId: r.employeeId,
          workHours: r.workHours, method: r.source === 'NFC' ? 'NFC' : 'Manual',
        });
      }
    }

    // 2. Leaves
    const leaveWhere = {
      orgId,
      OR: [
        { createdAt: { gte: dateFrom, lte: dateTo } },
        { updatedAt: { gte: dateFrom, lte: dateTo } },
      ],
      ...(empFilter ? { employeeId: empFilter } : {}),
    };
    const leaves = await prisma.leave.findMany({
      where: leaveWhere,
      include: {
        employee: { select: { name: true, employeeCode: true, department: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: rowLimit,
    });

    for (const l of leaves) {
      if (l.createdAt >= dateFrom && l.createdAt <= dateTo) {
        activities.push({
          type: 'leave_applied', time: l.createdAt.toISOString(),
          employee: l.employee.name, empCode: l.employee.employeeCode,
          department: l.employee.department, employeeId: l.employeeId,
          leaveType: l.leaveType.toLowerCase(), startDate: l.startDate.toISOString().slice(0, 10),
          endDate: l.endDate.toISOString().slice(0, 10), days: l.days, reason: l.reason,
        });
      }
      if (l.status !== 'PENDING' && l.updatedAt >= dateFrom && l.updatedAt <= dateTo) {
        activities.push({
          type: l.status === 'APPROVED' ? 'leave_approved' : 'leave_rejected',
          time: l.updatedAt.toISOString(),
          employee: l.employee.name, empCode: l.employee.employeeCode,
          department: l.employee.department, employeeId: l.employeeId,
          leaveType: l.leaveType.toLowerCase(),
          reviewer: l.reviewer?.name || null,
          reviewNote: l.reviewNote,
        });
      }
    }

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json({ activities: activities.slice(0, rowLimit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard — Org-wide combined dashboard (new)
router.get('/', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgId = req.orgId;

    const [pendingLeaves, totalEmployees, activeDevices, recentNotices] = await Promise.all([
      prisma.leave.count({ where: { orgId, status: 'PENDING' } }),
      prisma.employee.count({ where: { orgId, isActive: true } }),
      prisma.device.count({ where: { orgId, isActive: true } }),
      prisma.notice.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, type: true, createdAt: true },
      }),
    ]);

    res.json({ pendingLeaves, totalEmployees, activeDevices, recentNotices });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
