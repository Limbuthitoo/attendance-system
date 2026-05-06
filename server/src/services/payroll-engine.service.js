// ─────────────────────────────────────────────────────────────────────────────
// Nepal HR Payroll Engine — Configurable salary calculation service
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION — All values overridable via OrgSettings
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS = {
  payroll_basic_salary_pct: 60,          // basic = gross * 60%
  payroll_ssf_employee_pct: 11,          // employee SSF contribution
  payroll_ssf_employer_pct: 20,          // employer SSF contribution
  payroll_ssf_enabled: true,
  payroll_overtime_multiplier: 1.5,
  payroll_weekend_overtime_multiplier: 2.0,
  payroll_holiday_overtime_multiplier: 2.0,
  payroll_working_hours_per_day: 8,
  // Nepal Tax Slabs 2080/81 (annual income in NPR) — married gets slightly different first bracket
  payroll_tax_slabs_single: JSON.stringify([
    { min: 0, max: 500000, rate: 1 },
    { min: 500000, max: 700000, rate: 10 },
    { min: 700000, max: 1000000, rate: 20 },
    { min: 1000000, max: 2000000, rate: 30 },
    { min: 2000000, max: Infinity, rate: 36 },
  ]),
  payroll_tax_slabs_married: JSON.stringify([
    { min: 0, max: 600000, rate: 1 },
    { min: 600000, max: 800000, rate: 10 },
    { min: 800000, max: 1100000, rate: 20 },
    { min: 1100000, max: 2000000, rate: 30 },
    { min: 2000000, max: Infinity, rate: 36 },
  ]),
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load payroll configuration from OrgSettings, with defaults fallback.
 */
async function getPayrollConfig(orgId) {
  const prisma = getPrisma();
  const settings = await prisma.orgSetting.findMany({
    where: { orgId, key: { startsWith: 'payroll_' } },
  });

  const config = { ...DEFAULTS };
  for (const s of settings) {
    if (s.key in config) {
      // Parse booleans and numbers
      if (s.value === 'true') config[s.key] = true;
      else if (s.value === 'false') config[s.key] = false;
      else if (!isNaN(Number(s.value)) && s.value.trim() !== '') config[s.key] = Number(s.value);
      else config[s.key] = s.value;
    }
  }

  return config;
}

/**
 * Calculate Nepal progressive income tax (annual).
 */
function calculateAnnualTax(annualTaxableIncome, taxSlabs) {
  let slabs;
  try {
    slabs = typeof taxSlabs === 'string' ? JSON.parse(taxSlabs) : taxSlabs;
  } catch {
    slabs = JSON.parse(DEFAULTS.payroll_tax_slabs_single);
  }

  let tax = 0;
  let remaining = annualTaxableIncome;

  for (const slab of slabs) {
    const max = slab.max === null || slab.max === Infinity ? Infinity : slab.max;
    const slabWidth = max - slab.min;
    const taxableInSlab = Math.min(remaining, slabWidth);
    if (taxableInSlab <= 0) break;
    tax += taxableInSlab * (slab.rate / 100);
    remaining -= taxableInSlab;
  }

  return Math.round(tax * 100) / 100;
}

/**
 * Round to 2 decimal places.
 */
function r2(n) {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALARY STRUCTURE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function getSalaryStructure(orgId, employeeId) {
  const prisma = getPrisma();
  return prisma.salaryStructure.findFirst({
    where: { orgId, employeeId, isActive: true },
    orderBy: { effectiveFrom: 'desc' },
  });
}

async function upsertSalaryStructure({ orgId, employeeId, grossSalary, basicSalary, allowances, effectiveFrom, adminId, req }) {
  const prisma = getPrisma();

  // Deactivate previous structure
  await prisma.salaryStructure.updateMany({
    where: { orgId, employeeId, isActive: true },
    data: { isActive: false, effectiveTo: new Date(effectiveFrom) },
  });

  const structure = await prisma.salaryStructure.create({
    data: {
      orgId,
      employeeId,
      grossSalary,
      basicSalary,
      allowances: allowances || {},
      effectiveFrom: new Date(effectiveFrom),
      isActive: true,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'salary_structure.create',
    resource: 'salary_structure',
    resourceId: structure.id,
    newData: { grossSalary, basicSalary, allowances },
    req,
  });

  return structure;
}

async function getAllSalaryStructures(orgId) {
  const prisma = getPrisma();
  return prisma.salaryStructure.findMany({
    where: { orgId, isActive: true },
    include: { employee: { select: { name: true, employeeCode: true, department: true, designation: true } } },
    orderBy: { employee: { name: 'asc' } },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCE SALARY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function createAdvanceSalary({ orgId, employeeId, description, totalAmount, monthlyDeduction, startMonth, startYear, adminId, req }) {
  const prisma = getPrisma();
  const record = await prisma.advanceSalary.create({
    data: {
      orgId,
      employeeId,
      description,
      totalAmount,
      remainingAmount: totalAmount,
      monthlyDeduction,
      startMonth,
      startYear,
      isActive: true,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'advance_salary.create',
    resource: 'advance_salary',
    resourceId: record.id,
    newData: { totalAmount, monthlyDeduction },
    req,
  });

  return record;
}

async function getActiveAdvanceSalaries(orgId, employeeId) {
  const prisma = getPrisma();
  return prisma.advanceSalary.findMany({
    where: { orgId, employeeId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getAllAdvanceSalaries(orgId) {
  const prisma = getPrisma();
  return prisma.advanceSalary.findMany({
    where: { orgId, isActive: true },
    include: { employee: { select: { name: true, employeeCode: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYSLIP GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate payslips for all employees for a given month.
 * This is the core Nepal HR Payroll calculation engine.
 */
async function generatePayslips({ orgId, year, month, adminId, req }) {
  const prisma = getPrisma();
  const config = await getPayrollConfig(orgId);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // 1. Get active employees with salary structures
  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, employeeCode: true, department: true, gender: true },
  });

  const salaryStructures = await prisma.salaryStructure.findMany({
    where: { orgId, isActive: true },
  });
  const salaryMap = {};
  for (const s of salaryStructures) {
    salaryMap[s.employeeId] = s;
  }

  // 2. Get attendance data
  const attendance = await prisma.attendance.findMany({
    where: { orgId, date: { gte: startDate, lte: endDate } },
    select: { employeeId: true, status: true, workHours: true },
  });

  // 3. Get approved leaves
  const leaves = await prisma.leave.findMany({
    where: {
      orgId,
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { employeeId: true, days: true, type: true, startDate: true, endDate: true },
  });

  // 4. Get holidays
  const holidays = await prisma.holiday.findMany({
    where: { orgId, adDate: { gte: startDate, lte: endDate } },
  });
  const holidayCount = holidays.length;

  // 5. Get approved overtime
  const overtime = await prisma.overtimeRecord.findMany({
    where: {
      orgId,
      date: { gte: startDate, lte: endDate },
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
    },
    select: { employeeId: true, overtimeHours: true, rateMultiplier: true },
  });

  // 6. Get active advance salaries
  const advances = await prisma.advanceSalary.findMany({
    where: { orgId, isActive: true },
  });

  // Calculate total working days (excluding Saturdays for Nepal)
  let totalWorkDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 6) totalWorkDays++;
  }
  totalWorkDays -= holidayCount;

  // Group data per employee
  const attByEmp = {};
  for (const rec of attendance) {
    if (!attByEmp[rec.employeeId]) attByEmp[rec.employeeId] = [];
    attByEmp[rec.employeeId].push(rec);
  }

  const leaveByEmp = {};
  const unpaidLeaveByEmp = {};
  for (const lv of leaves) {
    const lvStart = new Date(Math.max(new Date(lv.startDate).getTime(), startDate.getTime()));
    const lvEnd = new Date(Math.min(new Date(lv.endDate).getTime(), endDate.getTime()));
    const days = Math.ceil((lvEnd - lvStart) / (1000 * 60 * 60 * 24)) + 1;
    if (!leaveByEmp[lv.employeeId]) leaveByEmp[lv.employeeId] = 0;
    leaveByEmp[lv.employeeId] += days;
    if (lv.type === 'UNPAID') {
      if (!unpaidLeaveByEmp[lv.employeeId]) unpaidLeaveByEmp[lv.employeeId] = 0;
      unpaidLeaveByEmp[lv.employeeId] += days;
    }
  }

  const otByEmp = {};
  for (const ot of overtime) {
    if (!otByEmp[ot.employeeId]) otByEmp[ot.employeeId] = { hours: 0, amount: 0 };
    otByEmp[ot.employeeId].hours += Number(ot.overtimeHours);
  }

  const advanceByEmp = {};
  for (const adv of advances) {
    if (!advanceByEmp[adv.employeeId]) advanceByEmp[adv.employeeId] = 0;
    advanceByEmp[adv.employeeId] += Number(adv.monthlyDeduction);
  }

  // ─── Calculate payslip for each employee ───────────────────────────────────
  const payslips = [];
  const advanceUpdates = [];

  for (const emp of employees) {
    const salary = salaryMap[emp.id];
    if (!salary) continue; // Skip employees without salary structure

    const gross = Number(salary.grossSalary);
    const basic = Number(salary.basicSalary);
    const allowances = salary.allowances || {};

    // Attendance counts
    const records = attByEmp[emp.id] || [];
    let presentDays = 0, absentDays = 0;
    for (const rec of records) {
      if (rec.status === 'PRESENT' || rec.status === 'LATE') presentDays++;
      else if (rec.status === 'HALF_DAY') presentDays += 0.5;
      else if (rec.status === 'ABSENT') absentDays++;
    }
    const leaveDays = leaveByEmp[emp.id] || 0;
    const unpaidLeaveDays = unpaidLeaveByEmp[emp.id] || 0;
    const accountedDays = presentDays + leaveDays;
    absentDays = Math.max(0, totalWorkDays - accountedDays);

    // ── EARNINGS ──
    // Overtime amount
    const otData = otByEmp[emp.id] || { hours: 0 };
    const hourlyRate = gross / (totalWorkDays * config.payroll_working_hours_per_day);
    const overtimeAmount = r2(otData.hours * hourlyRate * config.payroll_overtime_multiplier);

    const grossEarnings = r2(gross + overtimeAmount);

    // ── DEDUCTIONS ──
    // SSF
    const employeeSsf = config.payroll_ssf_enabled ? r2(basic * config.payroll_ssf_employee_pct / 100) : 0;
    const employerSsf = config.payroll_ssf_enabled ? r2(basic * config.payroll_ssf_employer_pct / 100) : 0;

    // TDS (Tax Deducted at Source)
    // Annual taxable = (gross - employee_ssf) * 12
    const annualGross = grossEarnings * 12;
    const annualSsf = employeeSsf * 12;
    const annualTaxable = annualGross - annualSsf;
    // Select tax slabs based on marital status (if available, default to single)
    const taxSlabs = config.payroll_tax_slabs_single; // TODO: marital status per employee
    const annualTax = calculateAnnualTax(Math.max(0, annualTaxable), taxSlabs);
    const tds = r2(annualTax / 12);

    // Unpaid leave deduction
    const dailyRate = gross / totalWorkDays;
    const unpaidLeaveDeduction = r2(unpaidLeaveDays * dailyRate);

    // Absence deduction (unapproved absences)
    const absenceDeduction = r2(absentDays * dailyRate);

    // Advance salary deduction
    const advanceSalaryDeduction = r2(advanceByEmp[emp.id] || 0);

    // Total deductions
    const totalDeductions = r2(employeeSsf + tds + unpaidLeaveDeduction + absenceDeduction + advanceSalaryDeduction);

    // Net salary
    const netSalary = r2(grossEarnings - totalDeductions);

    // Company cost
    const companyCost = r2(grossEarnings + employerSsf);

    payslips.push({
      orgId,
      employeeId: emp.id,
      year,
      month,
      basicSalary: basic,
      allowances,
      overtimeAmount,
      bonus: 0,
      grossEarnings,
      employeeSsf,
      employerSsf,
      tds,
      unpaidLeaveDeduction,
      absenceDeduction,
      advanceSalaryDeduction,
      otherDeductions: {},
      totalDeductions,
      netSalary,
      companyCost,
      totalWorkDays,
      presentDays: Math.round(presentDays),
      absentDays,
      unpaidLeaveDays,
      overtimeHours: r2(otData.hours),
      status: 'DRAFT',
    });

    // Track advance salary deductions to update remaining
    for (const adv of advances.filter(a => a.employeeId === emp.id && a.isActive)) {
      const deduction = Number(adv.monthlyDeduction);
      const newRemaining = Math.max(0, Number(adv.remainingAmount) - deduction);
      advanceUpdates.push({ id: adv.id, remaining: newRemaining, close: newRemaining <= 0 });
    }
  }

  // ─── Upsert payslips in transaction ────────────────────────────────────────
  await prisma.$transaction([
    ...payslips.map(p =>
      prisma.payslip.upsert({
        where: {
          orgId_employeeId_year_month: {
            orgId: p.orgId,
            employeeId: p.employeeId,
            year: p.year,
            month: p.month,
          },
        },
        create: p,
        update: {
          ...p,
          generatedAt: new Date(),
        },
      })
    ),
    // Update advance salary remaining amounts
    ...advanceUpdates.map(u =>
      prisma.advanceSalary.update({
        where: { id: u.id },
        data: {
          remainingAmount: u.remaining,
          isActive: !u.close,
        },
      })
    ),
  ]);

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payslip.generate',
    resource: 'payslip',
    newData: { year, month, count: payslips.length, totalWorkDays },
    req,
  });

  return { generated: payslips.length, year, month, totalWorkDays };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYSLIP QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

async function getPayslips({ orgId, year, month, department, status }) {
  const prisma = getPrisma();
  const where = { orgId, year, month };
  if (status) where.status = status;

  const payslips = await prisma.payslip.findMany({
    where,
    include: {
      employee: { select: { name: true, employeeCode: true, department: true, designation: true, gender: true } },
    },
    orderBy: { employee: { name: 'asc' } },
  });

  let result = payslips;
  if (department) {
    result = payslips.filter(p => p.employee.department === department);
  }

  // Calculate totals
  const totals = result.reduce((acc, p) => ({
    grossEarnings: acc.grossEarnings + Number(p.grossEarnings),
    totalDeductions: acc.totalDeductions + Number(p.totalDeductions),
    netSalary: acc.netSalary + Number(p.netSalary),
    employeeSsf: acc.employeeSsf + Number(p.employeeSsf),
    employerSsf: acc.employerSsf + Number(p.employerSsf),
    tds: acc.tds + Number(p.tds),
    companyCost: acc.companyCost + Number(p.companyCost),
  }), { grossEarnings: 0, totalDeductions: 0, netSalary: 0, employeeSsf: 0, employerSsf: 0, tds: 0, companyCost: 0 });

  return { payslips: result, totals, employeeCount: result.length };
}

async function getEmployeePayslip({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  return prisma.payslip.findUnique({
    where: { orgId_employeeId_year_month: { orgId, employeeId, year, month } },
    include: {
      employee: { select: { name: true, employeeCode: true, department: true, designation: true } },
    },
  });
}

async function getMyPayslips({ orgId, employeeId, year }) {
  const prisma = getPrisma();
  return prisma.payslip.findMany({
    where: { orgId, employeeId, year },
    orderBy: { month: 'desc' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL LOCK / UNLOCK
// ═══════════════════════════════════════════════════════════════════════════════

async function lockPayroll({ orgId, year, month, adminId, req }) {
  const prisma = getPrisma();

  const updated = await prisma.payslip.updateMany({
    where: { orgId, year, month, status: 'DRAFT' },
    data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: adminId },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payroll.lock',
    resource: 'payslip',
    newData: { year, month, locked: updated.count },
    req,
  });

  return { locked: updated.count };
}

async function unlockPayroll({ orgId, year, month, adminId, req }) {
  const prisma = getPrisma();

  const updated = await prisma.payslip.updateMany({
    where: { orgId, year, month, status: 'LOCKED' },
    data: { status: 'DRAFT', lockedAt: null, lockedBy: null },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payroll.unlock',
    resource: 'payslip',
    newData: { year, month, unlocked: updated.count },
    req,
  });

  return { unlocked: updated.count };
}

async function markAsPaid({ orgId, year, month, adminId, req }) {
  const prisma = getPrisma();

  const updated = await prisma.payslip.updateMany({
    where: { orgId, year, month, status: 'LOCKED' },
    data: { status: 'PAID' },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payroll.paid',
    resource: 'payslip',
    newData: { year, month, paid: updated.count },
    req,
  });

  return { paid: updated.count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

async function exportPayslips({ orgId, year, month }) {
  const { payslips } = await getPayslips({ orgId, year, month });

  const header = [
    'Employee Code', 'Name', 'Department', 'Designation',
    'Basic Salary', 'Allowances', 'Overtime', 'Gross Earnings',
    'SSF (Employee)', 'SSF (Employer)', 'TDS',
    'Unpaid Leave Ded.', 'Absence Ded.', 'Advance Salary Ded.',
    'Total Deductions', 'Net Salary', 'Company Cost',
    'Work Days', 'Present', 'Absent', 'OT Hours', 'Status',
  ];

  const rows = payslips.map(p => [
    p.employee.employeeCode,
    p.employee.name,
    p.employee.department,
    p.employee.designation,
    Number(p.basicSalary),
    Object.values(p.allowances || {}).reduce((a, b) => a + Number(b), 0),
    Number(p.overtimeAmount),
    Number(p.grossEarnings),
    Number(p.employeeSsf),
    Number(p.employerSsf),
    Number(p.tds),
    Number(p.unpaidLeaveDeduction),
    Number(p.absenceDeduction),
    Number(p.advanceSalaryDeduction),
    Number(p.totalDeductions),
    Number(p.netSalary),
    Number(p.companyCost),
    p.totalWorkDays,
    p.presentDays,
    p.absentDays,
    Number(p.overtimeHours),
    p.status,
  ]);

  return { header, rows, totalRecords: rows.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL CONFIG MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function updatePayrollConfig({ orgId, settings, adminId, req }) {
  const prisma = getPrisma();
  const allowed = Object.keys(DEFAULTS);

  const updates = [];
  for (const [key, value] of Object.entries(settings)) {
    if (!allowed.includes(key)) continue;
    updates.push(
      prisma.orgSetting.upsert({
        where: { orgId_key: { orgId, key } },
        create: { orgId, key, value: String(value) },
        update: { value: String(value) },
      })
    );
  }

  await prisma.$transaction(updates);

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'payroll_config.update',
    resource: 'org_setting',
    newData: settings,
    req,
  });

  return getPayrollConfig(orgId);
}

module.exports = {
  getPayrollConfig,
  getSalaryStructure,
  upsertSalaryStructure,
  getAllSalaryStructures,
  createAdvanceSalary,
  getActiveAdvanceSalaries,
  getAllAdvanceSalaries,
  generatePayslips,
  getPayslips,
  getEmployeePayslip,
  getMyPayslips,
  lockPayroll,
  unlockPayroll,
  markAsPaid,
  exportPayslips,
  updatePayrollConfig,
};
