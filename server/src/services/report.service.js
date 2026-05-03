// ─────────────────────────────────────────────────────────────────────────────
// Report Service — Attendance analytics, department stats, exports
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

/**
 * Attendance summary for a date range (org-wide or per branch).
 */
async function getAttendanceSummary({ orgId, startDate, endDate, branchId, departmentFilter }) {
  const prisma = getPrisma();

  const employees = await prisma.employee.findMany({
    where: {
      orgId,
      isActive: true,
      ...(departmentFilter ? { department: departmentFilter } : {}),
    },
    select: { id: true, name: true, employeeCode: true, department: true, designation: true },
  });

  const employeeIds = employees.map(e => e.id);

  // If branchId filter, narrow by assignment
  let filteredIds = employeeIds;
  if (branchId) {
    const assignments = await prisma.employeeAssignment.findMany({
      where: { employeeId: { in: employeeIds }, isCurrent: true, branchId },
      select: { employeeId: true },
    });
    filteredIds = assignments.map(a => a.employeeId);
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      orgId,
      employeeId: { in: filteredIds },
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: {
      employeeId: true,
      date: true,
      status: true,
      checkIn: true,
      checkOut: true,
      workHours: true,
      source: true,
    },
  });

  // Aggregate per employee
  const empMap = {};
  for (const emp of employees.filter(e => filteredIds.includes(e.id))) {
    empMap[emp.id] = {
      ...emp,
      present: 0, late: 0, halfDay: 0, absent: 0,
      totalHours: 0, avgHours: 0, records: 0,
    };
  }

  for (const rec of attendance) {
    const emp = empMap[rec.employeeId];
    if (!emp) continue;
    emp.records++;
    emp.totalHours += Number(rec.workHours || 0);
    if (rec.status === 'PRESENT') emp.present++;
    else if (rec.status === 'LATE') { emp.present++; emp.late++; }
    else if (rec.status === 'HALF_DAY') emp.halfDay++;
    else if (rec.status === 'ABSENT') emp.absent++;
  }

  const summaries = Object.values(empMap).map(emp => ({
    ...emp,
    avgHours: emp.records > 0 ? Math.round((emp.totalHours / emp.records) * 100) / 100 : 0,
    totalHours: Math.round(emp.totalHours * 100) / 100,
  }));

  // Org totals
  const totals = summaries.reduce((acc, e) => ({
    present: acc.present + e.present,
    late: acc.late + e.late,
    halfDay: acc.halfDay + e.halfDay,
    absent: acc.absent + e.absent,
    totalHours: acc.totalHours + e.totalHours,
  }), { present: 0, late: 0, halfDay: 0, absent: 0, totalHours: 0 });

  return { employees: summaries, totals, period: { startDate, endDate }, employeeCount: summaries.length };
}

/**
 * Department-level breakdown.
 */
async function getDepartmentReport({ orgId, startDate, endDate }) {
  const prisma = getPrisma();

  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true, department: true },
  });

  const attendance = await prisma.attendance.findMany({
    where: {
      orgId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: { employeeId: true, status: true, workHours: true },
  });

  const deptMap = {};
  for (const emp of employees) {
    if (!deptMap[emp.department]) {
      deptMap[emp.department] = { department: emp.department, employeeCount: 0, present: 0, late: 0, halfDay: 0, absent: 0, totalHours: 0 };
    }
    deptMap[emp.department].employeeCount++;
  }

  const empDept = {};
  for (const emp of employees) { empDept[emp.id] = emp.department; }

  for (const rec of attendance) {
    const dept = empDept[rec.employeeId];
    if (!dept || !deptMap[dept]) continue;
    const d = deptMap[dept];
    d.totalHours += Number(rec.workHours || 0);
    if (rec.status === 'PRESENT') d.present++;
    else if (rec.status === 'LATE') { d.present++; d.late++; }
    else if (rec.status === 'HALF_DAY') d.halfDay++;
    else if (rec.status === 'ABSENT') d.absent++;
  }

  return Object.values(deptMap).map(d => ({
    ...d,
    totalHours: Math.round(d.totalHours * 100) / 100,
  }));
}

/**
 * Daily attendance trend (for charts).
 */
async function getDailyTrend({ orgId, startDate, endDate, branchId }) {
  const prisma = getPrisma();

  const where = {
    orgId,
    date: { gte: new Date(startDate), lte: new Date(endDate) },
  };
  if (branchId) where.branchId = branchId;

  const attendance = await prisma.attendance.findMany({
    where,
    select: { date: true, status: true },
    orderBy: { date: 'asc' },
  });

  const dayMap = {};
  for (const rec of attendance) {
    const key = rec.date.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { date: key, present: 0, late: 0, halfDay: 0, absent: 0, total: 0 };
    dayMap[key].total++;
    if (rec.status === 'PRESENT') dayMap[key].present++;
    else if (rec.status === 'LATE') { dayMap[key].present++; dayMap[key].late++; }
    else if (rec.status === 'HALF_DAY') dayMap[key].halfDay++;
    else if (rec.status === 'ABSENT') dayMap[key].absent++;
  }

  return Object.values(dayMap);
}

/**
 * Late arrivals report — employees consistently arriving late.
 */
async function getLateArrivals({ orgId, startDate, endDate, minLateCount = 3 }) {
  const prisma = getPrisma();

  const lateRecords = await prisma.attendance.findMany({
    where: {
      orgId,
      status: 'LATE',
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: {
      employeeId: true,
      date: true,
      checkIn: true,
      employee: { select: { name: true, employeeCode: true, department: true } },
    },
  });

  const empLates = {};
  for (const rec of lateRecords) {
    if (!empLates[rec.employeeId]) {
      empLates[rec.employeeId] = {
        employeeId: rec.employeeId,
        name: rec.employee.name,
        employeeCode: rec.employee.employeeCode,
        department: rec.employee.department,
        lateCount: 0,
        dates: [],
      };
    }
    empLates[rec.employeeId].lateCount++;
    empLates[rec.employeeId].dates.push(rec.date.toISOString().slice(0, 10));
  }

  return Object.values(empLates)
    .filter(e => e.lateCount >= minLateCount)
    .sort((a, b) => b.lateCount - a.lateCount);
}

/**
 * Leave utilization report.
 */
async function getLeaveReport({ orgId, year }) {
  const prisma = getPrisma();

  const leaves = await prisma.leave.findMany({
    where: {
      orgId,
      status: 'APPROVED',
      startDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
    select: {
      employeeId: true,
      leaveType: true,
      days: true,
      employee: { select: { name: true, employeeCode: true, department: true } },
    },
  });

  const quotas = await prisma.leaveQuota.findMany({
    where: { orgId, year, employeeId: null },
  });

  const defaultQuotaMap = {};
  for (const q of quotas) { defaultQuotaMap[q.leaveType] = q.totalDays; }

  const empLeaves = {};
  for (const lv of leaves) {
    if (!empLeaves[lv.employeeId]) {
      empLeaves[lv.employeeId] = {
        employeeId: lv.employeeId,
        name: lv.employee.name,
        employeeCode: lv.employee.employeeCode,
        department: lv.employee.department,
        byType: {},
        totalUsed: 0,
      };
    }
    const e = empLeaves[lv.employeeId];
    if (!e.byType[lv.leaveType]) e.byType[lv.leaveType] = { used: 0, quota: defaultQuotaMap[lv.leaveType] || 0 };
    e.byType[lv.leaveType].used += lv.days;
    e.totalUsed += lv.days;
  }

  return Object.values(empLeaves).sort((a, b) => b.totalUsed - a.totalUsed);
}

/**
 * Export attendance data as CSV-compatible rows.
 */
async function exportAttendance({ orgId, startDate, endDate, branchId }) {
  const prisma = getPrisma();

  const where = {
    orgId,
    date: { gte: new Date(startDate), lte: new Date(endDate) },
  };
  if (branchId) where.branchId = branchId;

  const records = await prisma.attendance.findMany({
    where,
    select: {
      date: true,
      checkIn: true,
      checkOut: true,
      status: true,
      source: true,
      workHours: true,
      employee: { select: { name: true, employeeCode: true, department: true, designation: true } },
      branch: { select: { name: true } },
    },
    orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
  });

  const header = ['Date', 'Employee Code', 'Employee Name', 'Department', 'Designation', 'Branch', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Source'];
  const rows = records.map(r => [
    r.date.toISOString().slice(0, 10),
    r.employee.employeeCode,
    r.employee.name,
    r.employee.department,
    r.employee.designation,
    r.branch?.name || '',
    r.checkIn ? new Date(r.checkIn).toISOString() : '',
    r.checkOut ? new Date(r.checkOut).toISOString() : '',
    r.workHours || 0,
    r.status,
    r.source,
  ]);

  return { header, rows, totalRecords: rows.length };
}

module.exports = {
  getAttendanceSummary,
  getDepartmentReport,
  getDailyTrend,
  getLateArrivals,
  getLeaveReport,
  exportAttendance,
};
