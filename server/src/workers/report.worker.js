// ─────────────────────────────────────────────────────────────────────────────
// Report Worker — Async report generation (attendance, payroll exports)
// ─────────────────────────────────────────────────────────────────────────────
const { Worker } = require('bullmq');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../../data/reports');

function createReportWorker(connection) {
  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const worker = new Worker('report', async (job) => {
    if (job.name === 'generate-report') {
      await handleReportGeneration(job);
    }
  }, { connection, concurrency: 2 });

  worker.on('failed', (job, err) => {
    console.error(`📊 Report job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function handleReportGeneration(job) {
  const { orgId, type, params, requestedBy } = job.data;
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  let result;

  switch (type) {
    case 'attendance-summary':
      result = await generateAttendanceSummaryReport(orgId, params);
      break;
    case 'attendance-export':
      result = await generateAttendanceExport(orgId, params);
      break;
    case 'payroll-export':
      result = await generatePayrollExport(orgId, params);
      break;
    case 'leave-report':
      result = await generateLeaveReport(orgId, params);
      break;
    case 'late-arrivals':
      result = await generateLateArrivalsReport(orgId, params);
      break;
    case 'department-summary':
      result = await generateDepartmentSummary(orgId, params);
      break;
    default:
      throw new Error(`Unknown report type: ${type}`);
  }

  // Save report to disk
  const filename = `${type}_${orgId}_${Date.now()}.csv`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, result.csv, 'utf-8');

  // Create a notification for the requester
  if (requestedBy) {
    const { createBulkNotifications } = require('../services/notification.service');
    await createBulkNotifications({
      orgId,
      employeeIds: [requestedBy],
      title: 'Report Ready',
      body: `Your ${type.replace(/-/g, ' ')} report is ready for download.`,
      type: 'REPORT_READY',
      data: { filename, reportType: type },
    });
  }

  console.log(`📊 Report generated: ${type} (${result.rowCount} rows) → ${filename}`);
  return { filename, rowCount: result.rowCount };
}

async function generateAttendanceSummaryReport(orgId, { startDate, endDate, branchId, departmentFilter }) {
  const { getAttendanceSummary } = require('../services/report.service');
  const result = await getAttendanceSummary({ orgId, startDate, endDate, branchId, departmentFilter });

  const header = 'Employee,Code,Department,Designation,Present,Late,Half Day,Absent,Early Exit,Total Hours,Avg Hours';
  const rows = result.employees.map(emp =>
    `"${emp.name}","${emp.employeeCode || ''}","${emp.department || ''}","${emp.designation || ''}",${emp.present},${emp.late},${emp.halfDay},${emp.absent},${emp.earlyExit},${emp.totalHours.toFixed(1)},${emp.avgHours.toFixed(1)}`
  );

  return { csv: [header, ...rows].join('\n'), rowCount: rows.length };
}

async function generateAttendanceExport(orgId, { startDate, endDate, branchId }) {
  const { exportAttendance } = require('../services/report.service');
  const { header, rows } = await exportAttendance({ orgId, startDate, endDate, branchId });

  const csv = [header.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  return { csv, rowCount: rows.length };
}

async function generatePayrollExport(orgId, { year, month }) {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const records = await prisma.payrollSummary.findMany({
    where: { orgId, year, month },
    include: { employee: { select: { name: true, employeeCode: true, department: true } } },
    orderBy: { employee: { name: 'asc' } },
  });

  const header = 'Employee,Code,Department,Working Days,Present,Absent,Late,Overtime Hrs,Basic Salary,Allowances,Deductions,Net Pay';
  const rows = records.map(r =>
    `"${r.employee.name}","${r.employee.employeeCode || ''}","${r.employee.department || ''}",${r.workingDays},${r.presentDays},${r.absentDays},${r.lateDays},${r.overtimeHours || 0},${r.basicSalary || 0},${r.totalAllowances || 0},${r.totalDeductions || 0},${r.netPay || 0}`
  );

  return { csv: [header, ...rows].join('\n'), rowCount: rows.length };
}

async function generateLeaveReport(orgId, { year, departmentFilter }) {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true, ...(departmentFilter ? { department: departmentFilter } : {}) },
    select: { id: true, name: true, employeeCode: true, department: true },
  });

  const balances = await prisma.leaveBalance.findMany({
    where: { orgId, year, employeeId: { in: employees.map(e => e.id) } },
    include: { leaveType: { select: { name: true } } },
  });

  const header = 'Employee,Code,Department,Leave Type,Entitled,Used,Balance';
  const rows = balances.map(b => {
    const emp = employees.find(e => e.id === b.employeeId);
    return `"${emp?.name || ''}","${emp?.employeeCode || ''}","${emp?.department || ''}","${b.leaveType.name}",${b.entitled},${b.used},${b.balance}`;
  });

  return { csv: [header, ...rows].join('\n'), rowCount: rows.length };
}

async function generateLateArrivalsReport(orgId, { startDate, endDate }) {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const records = await prisma.attendance.findMany({
    where: {
      orgId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
      status: 'LATE',
    },
    include: { employee: { select: { name: true, employeeCode: true, department: true } } },
    orderBy: [{ date: 'desc' }, { checkIn: 'asc' }],
  });

  const header = 'Date,Employee,Code,Department,Check In,Late By (min)';
  const rows = records.map(r =>
    `"${r.date.toISOString().split('T')[0]}","${r.employee.name}","${r.employee.employeeCode || ''}","${r.employee.department || ''}","${r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : ''}",${r.lateMinutes || 0}`
  );

  return { csv: [header, ...rows].join('\n'), rowCount: rows.length };
}

async function generateDepartmentSummary(orgId, { startDate, endDate }) {
  const { getDepartmentReport } = require('../services/report.service');
  const data = await getDepartmentReport({ orgId, startDate, endDate });

  const header = 'Department,Employees,Present,Late,Half Day,Absent,Early Exit,Total Hours';
  const rows = data.map(d =>
    `"${d.department || 'Unassigned'}",${d.employeeCount},${d.present},${d.late},${d.halfDay},${d.absent},${d.earlyExit},${d.totalHours}`
  );

  return { csv: [header, ...rows].join('\n'), rowCount: rows.length };
}

module.exports = { createReportWorker };
