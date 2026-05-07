// ─────────────────────────────────────────────────────────────────────────────
// Payroll Service — Monthly summary generation & export
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

/**
 * Generate payroll summary for a specific month.
 * Calculates working days, present/absent/late/half-day counts, total hours, overtime, leave days.
 */
async function generatePayrollSummary({ orgId, year, month, adminId, req }) {
  const prisma = getPrisma();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month

  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, employeeCode: true, department: true },
  });

  // Get all attendance for the month
  const attendance = await prisma.attendance.findMany({
    where: {
      orgId,
      date: { gte: startDate, lte: endDate },
    },
    select: { employeeId: true, status: true, workHours: true, date: true },
  });

  // Get approved leaves for the month
  const leaves = await prisma.leave.findMany({
    where: {
      orgId,
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { employeeId: true, days: true, startDate: true, endDate: true },
  });

  // Get holidays in the month
  const holidays = await prisma.holiday.findMany({
    where: {
      orgId,
      adDate: { gte: startDate, lte: endDate },
    },
  });
  const holidayCount = holidays.length;

  // Get approved overtime
  const overtime = await prisma.overtimeRecord.findMany({
    where: {
      orgId,
      date: { gte: startDate, lte: endDate },
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
    },
    select: { employeeId: true, overtimeHours: true },
  });

  // Load penalty policy for this org
  const penaltyPolicy = await prisma.attendancePenaltyPolicy.findUnique({
    where: { orgId, isActive: true },
  });

  // Calculate total working days in month (excluding weekends - Saturday for Nepal)
  let totalWorkDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 6) totalWorkDays++; // Not Saturday
  }
  totalWorkDays -= holidayCount;

  // Group data per employee
  const attByEmp = {};
  for (const rec of attendance) {
    if (!attByEmp[rec.employeeId]) attByEmp[rec.employeeId] = [];
    attByEmp[rec.employeeId].push(rec);
  }

  const leaveByEmp = {};
  for (const lv of leaves) {
    if (!leaveByEmp[lv.employeeId]) leaveByEmp[lv.employeeId] = 0;
    // Count only days within this month
    const lvStart = new Date(Math.max(new Date(lv.startDate).getTime(), startDate.getTime()));
    const lvEnd = new Date(Math.min(new Date(lv.endDate).getTime(), endDate.getTime()));
    const days = Math.ceil((lvEnd - lvStart) / (1000 * 60 * 60 * 24)) + 1;
    leaveByEmp[lv.employeeId] += days;
  }

  const otByEmp = {};
  for (const ot of overtime) {
    if (!otByEmp[ot.employeeId]) otByEmp[ot.employeeId] = 0;
    otByEmp[ot.employeeId] += Number(ot.overtimeHours);
  }

  const summaries = [];

  for (const emp of employees) {
    const records = attByEmp[emp.id] || [];
    let present = 0, late = 0, halfDay = 0, absent = 0, totalWorkHours = 0;
    let onLeave = 0, holiday = 0, weeklyOff = 0, earlyExit = 0;

    for (const rec of records) {
      totalWorkHours += Number(rec.workHours || 0);
      if (rec.status === 'PRESENT') present++;
      else if (rec.status === 'LATE') { present++; late++; }
      else if (rec.status === 'HALF_DAY') halfDay++;
      else if (rec.status === 'ABSENT') absent++;
      else if (rec.status === 'ON_LEAVE') onLeave++;
      else if (rec.status === 'HOLIDAY') holiday++;
      else if (rec.status === 'WEEKLY_OFF') weeklyOff++;
      else if (rec.status === 'EARLY_EXIT') { present++; earlyExit++; }
      else if (rec.status === 'MISSING_CHECKOUT') present++; // credited hours
    }

    const leaveDays = leaveByEmp[emp.id] || 0;
    const overtimeHours = otByEmp[emp.id] || 0;

    // Paid days: present + leave + holidays + weekly offs + half days(0.5)
    const paidDays = present + leaveDays + holiday + weeklyOff + (halfDay * 0.5);

    // Absent/unpaid: total work days - accounted days
    const accountedDays = present + halfDay + leaveDays + onLeave + holiday + weeklyOff;
    absent = Math.max(0, totalWorkDays - accountedDays);

    // Effective (payable) days
    const effectiveDays = present + leaveDays + onLeave + holiday + weeklyOff + (halfDay * 0.5);

    // Late/Early exit penalties
    let penaltyDays = 0;
    if (penaltyPolicy) {
      if (late > penaltyPolicy.maxLatePerMonth) {
        const excessLate = late - penaltyPolicy.maxLatePerMonth;
        penaltyDays += excessLate * 0.5; // Each excess late = 0.5 day deduction
      }
      if (earlyExit > penaltyPolicy.maxEarlyExitPerMonth) {
        const excessEarly = earlyExit - penaltyPolicy.maxEarlyExitPerMonth;
        penaltyDays += excessEarly * 0.5;
      }
    }

    summaries.push({
      orgId,
      employeeId: emp.id,
      year,
      month,
      totalWorkDays,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      halfDays: halfDay,
      leaveDays: leaveDays + onLeave,
      holidayDays: holidayCount + holiday,
      weeklyOffDays: weeklyOff,
      earlyExitDays: earlyExit,
      totalWorkHours: Math.round(totalWorkHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      effectiveDays: Math.round((effectiveDays - penaltyDays) * 100) / 100,
      penaltyDays: Math.round(penaltyDays * 100) / 100,
    });
  }

  // Upsert all summaries in a transaction
  await prisma.$transaction(
    summaries.map(s =>
      prisma.payrollSummary.upsert({
        where: {
          orgId_employeeId_year_month: {
            orgId: s.orgId,
            employeeId: s.employeeId,
            year: s.year,
            month: s.month,
          },
        },
        create: s,
        update: {
          totalWorkDays: s.totalWorkDays,
          presentDays: s.presentDays,
          absentDays: s.absentDays,
          lateDays: s.lateDays,
          halfDays: s.halfDays,
          leaveDays: s.leaveDays,
          holidayDays: s.holidayDays,
          weeklyOffDays: s.weeklyOffDays,
          earlyExitDays: s.earlyExitDays,
          totalWorkHours: s.totalWorkHours,
          overtimeHours: s.overtimeHours,
          effectiveDays: s.effectiveDays,
          penaltyDays: s.penaltyDays,
          generatedAt: new Date(),
        },
      })
    )
  );

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payroll.generate',
    resource: 'payroll_summary',
    newData: { year, month, employeeCount: summaries.length },
    req,
  });

  return { generated: summaries.length, year, month, totalWorkDays };
}

/**
 * Get payroll summaries for a month.
 */
async function getPayrollSummaries({ orgId, year, month, department }) {
  const prisma = getPrisma();

  const where = { orgId, year, month };

  const summaries = await prisma.payrollSummary.findMany({
    where,
    include: {
      employee: {
        select: { name: true, employeeCode: true, department: true, designation: true },
      },
    },
    orderBy: { employee: { name: 'asc' } },
  });

  let result = summaries;
  if (department) {
    result = summaries.filter(s => s.employee.department === department);
  }

  // Calculate totals
  const totals = result.reduce((acc, s) => ({
    presentDays: acc.presentDays + s.presentDays,
    absentDays: acc.absentDays + s.absentDays,
    lateDays: acc.lateDays + s.lateDays,
    halfDays: acc.halfDays + s.halfDays,
    leaveDays: acc.leaveDays + s.leaveDays,
    totalWorkHours: acc.totalWorkHours + Number(s.totalWorkHours),
    overtimeHours: acc.overtimeHours + Number(s.overtimeHours),
    effectiveDays: acc.effectiveDays + Number(s.effectiveDays),
  }), { presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, leaveDays: 0, totalWorkHours: 0, overtimeHours: 0, effectiveDays: 0 });

  return { summaries: result, totals, employeeCount: result.length };
}

/**
 * Export payroll as CSV rows.
 */
async function exportPayroll({ orgId, year, month }) {
  const { summaries } = await getPayrollSummaries({ orgId, year, month });

  const header = [
    'Employee Code', 'Name', 'Department', 'Designation',
    'Work Days', 'Present', 'Absent', 'Late', 'Half Day', 'Leave',
    'Holidays', 'Total Hours', 'Overtime Hours', 'Effective Days',
  ];

  const rows = summaries.map(s => [
    s.employee.employeeCode,
    s.employee.name,
    s.employee.department,
    s.employee.designation,
    s.totalWorkDays,
    s.presentDays,
    s.absentDays,
    s.lateDays,
    s.halfDays,
    s.leaveDays,
    s.holidayDays,
    s.totalWorkHours,
    s.overtimeHours,
    s.effectiveDays,
  ]);

  return { header, rows, totalRecords: rows.length };
}

module.exports = {
  generatePayrollSummary,
  getPayrollSummaries,
  exportPayroll,
};
