// ─────────────────────────────────────────────────────────────────────────────
// Incentive Service — Plans, calculation engine, approval, adjustments
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { getSalesStats } = require('./crm.service');
const { getPerformanceScore } = require('./performance.service');
const { getTaskStats } = require('./task.service');
const { getProjectStats } = require('./project.service');
const { getReferralStats } = require('./referral.service');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function r2(n) {
  return Math.round(n * 100) / 100;
}

function periodDates(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCENTIVE PLAN CRUD
// ═══════════════════════════════════════════════════════════════════════════════

async function listPlans({ orgId, status, type }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (type) where.type = type;

  return prisma.incentivePlan.findMany({
    where,
    include: { _count: { select: { employeeIncentives: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPlan(orgId, planId) {
  const prisma = getPrisma();
  const plan = await prisma.incentivePlan.findFirst({
    where: { id: planId, orgId },
    include: { _count: { select: { employeeIncentives: true } } },
  });
  if (!plan) throw Object.assign(new Error('Incentive plan not found'), { status: 404 });
  return plan;
}

async function createPlan({ orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const plan = await prisma.incentivePlan.create({
    data: {
      orgId,
      name: data.name,
      type: data.type,
      description: data.description || null,
      calculationFrequency: data.calculationFrequency || 'monthly',
      payoutFrequency: data.payoutFrequency || 'same_month',
      approvalRequired: data.approvalRequired !== false,
      taxable: data.taxable !== false,
      maxCap: data.maxCap || null,
      applicableDepartments: data.applicableDepartments || [],
      applicableDesignations: data.applicableDesignations || [],
      allowProbation: data.allowProbation || false,
      minWorkingDays: data.minWorkingDays || 0,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      rules: data.rules || [],
      status: data.status || 'DRAFT',
      createdBy: adminId,
    },
  });

  await auditLog({
    orgId, actorId: adminId,
    action: 'incentive_plan.create', resource: 'incentive_plan',
    resourceId: plan.id, newData: data, req,
  });

  return plan;
}

async function updatePlan({ orgId, planId, data, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.incentivePlan.findFirst({ where: { id: planId, orgId } });
  if (!existing) throw Object.assign(new Error('Plan not found'), { status: 404 });

  const updated = await prisma.incentivePlan.update({
    where: { id: planId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.calculationFrequency !== undefined && { calculationFrequency: data.calculationFrequency }),
      ...(data.payoutFrequency !== undefined && { payoutFrequency: data.payoutFrequency }),
      ...(data.approvalRequired !== undefined && { approvalRequired: data.approvalRequired }),
      ...(data.taxable !== undefined && { taxable: data.taxable }),
      ...(data.maxCap !== undefined && { maxCap: data.maxCap }),
      ...(data.applicableDepartments !== undefined && { applicableDepartments: data.applicableDepartments }),
      ...(data.applicableDesignations !== undefined && { applicableDesignations: data.applicableDesignations }),
      ...(data.allowProbation !== undefined && { allowProbation: data.allowProbation }),
      ...(data.minWorkingDays !== undefined && { minWorkingDays: data.minWorkingDays }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.rules !== undefined && { rules: data.rules }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  await auditLog({
    orgId, actorId: adminId,
    action: 'incentive_plan.update', resource: 'incentive_plan',
    resourceId: planId, oldData: existing, newData: data, req,
  });

  return updated;
}

async function deletePlan({ orgId, planId, adminId, req }) {
  const prisma = getPrisma();
  const plan = await prisma.incentivePlan.findFirst({
    where: { id: planId, orgId },
    include: { _count: { select: { employeeIncentives: true } } },
  });
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  if (plan._count.employeeIncentives > 0) {
    throw Object.assign(new Error('Cannot delete plan with existing incentive records. Archive it instead.'), { status: 400 });
  }

  await prisma.incentivePlan.delete({ where: { id: planId } });

  await auditLog({
    orgId, actorId: adminId,
    action: 'incentive_plan.delete', resource: 'incentive_plan',
    resourceId: planId, oldData: plan, req,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

function isEligible(employee, plan, presentDays) {
  if (!employee.isActive) return false;
  if (employee.employmentStatus === 'probation' && !plan.allowProbation) return false;
  if (plan.minWorkingDays > 0 && presentDays < plan.minWorkingDays) return false;
  if (plan.applicableDepartments.length > 0 && !plan.applicableDepartments.includes(employee.department)) return false;
  if (plan.applicableDesignations.length > 0 && !plan.applicableDesignations.includes(employee.designation)) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE INCENTIVE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate attendance-based incentive for one employee.
 * Rules format (JSON array in plan.rules):
 * [
 *   { "condition": "zero_absence", "amount": 5000 },
 *   { "condition": "punctuality", "minPunctualityPct": 95, "amount": 2000 },
 *   { "condition": "no_late", "maxLateCount": 0, "amount": 3000 },
 *   { "condition": "full_attendance", "amount": 5000 },
 * ]
 */
function calculateAttendanceIncentive({ rules, attendanceData }) {
  let incentive = 0;
  const breakdown = [];

  for (const rule of rules) {
    switch (rule.condition) {
      case 'zero_absence':
        if (attendanceData.absentDays === 0 && attendanceData.unpaidLeaveDays === 0) {
          incentive += Number(rule.amount);
          breakdown.push({ rule: 'zero_absence', amount: Number(rule.amount), met: true });
        } else {
          breakdown.push({ rule: 'zero_absence', amount: 0, met: false });
        }
        break;

      case 'punctuality': {
        const pct = attendanceData.totalWorkDays > 0
          ? ((attendanceData.totalWorkDays - attendanceData.lateDays) / attendanceData.totalWorkDays) * 100
          : 0;
        const minPct = rule.minPunctualityPct || 95;
        if (pct >= minPct) {
          incentive += Number(rule.amount);
          breakdown.push({ rule: 'punctuality', amount: Number(rule.amount), met: true, pct: r2(pct) });
        } else {
          breakdown.push({ rule: 'punctuality', amount: 0, met: false, pct: r2(pct) });
        }
        break;
      }

      case 'no_late':
        if (attendanceData.lateDays <= (rule.maxLateCount || 0)) {
          incentive += Number(rule.amount);
          breakdown.push({ rule: 'no_late', amount: Number(rule.amount), met: true });
        } else {
          breakdown.push({ rule: 'no_late', amount: 0, met: false, lateDays: attendanceData.lateDays });
        }
        break;

      case 'full_attendance':
        if (attendanceData.absentDays === 0 && attendanceData.lateDays === 0 &&
            attendanceData.earlyExitDays === 0 && attendanceData.unpaidLeaveDays === 0) {
          incentive += Number(rule.amount);
          breakdown.push({ rule: 'full_attendance', amount: Number(rule.amount), met: true });
        } else {
          breakdown.push({ rule: 'full_attendance', amount: 0, met: false });
        }
        break;

      case 'custom_fixed':
        // A simple fixed amount if a custom condition field meets a threshold
        incentive += Number(rule.amount);
        breakdown.push({ rule: 'custom_fixed', amount: Number(rule.amount), met: true });
        break;

      default:
        break;
    }
  }

  return { incentive: r2(incentive), breakdown };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATE INCENTIVES — Main engine
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate incentives for all eligible employees for a given plan and period.
 */
async function calculateIncentives({ orgId, planId, year, month, adminId, req }) {
  const prisma = getPrisma();
  const plan = await getPlan(orgId, planId);

  if (plan.status !== 'ACTIVE') {
    throw Object.assign(new Error('Plan must be ACTIVE to calculate incentives'), { status: 400 });
  }

  const { start, end } = periodDates(year, month);

  // Check plan date range
  if (new Date(plan.startDate) > end) {
    throw Object.assign(new Error('Plan has not started yet for this period'), { status: 400 });
  }
  if (plan.endDate && new Date(plan.endDate) < start) {
    throw Object.assign(new Error('Plan has expired for this period'), { status: 400 });
  }

  // Get employees
  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true, name: true, employeeCode: true, department: true, designation: true, employmentStatus: true, isActive: true },
  });

  let results = [];

  if (plan.type === 'ATTENDANCE') {
    results = await calculateAttendanceIncentives({ prisma, orgId, plan, employees, start, end, year, month });
  } else if (plan.type === 'FESTIVAL' || plan.type === 'CUSTOM') {
    results = calculateFixedIncentives({ plan, employees });
  } else if (plan.type === 'SALES') {
    results = await calculateSalesIncentives({ orgId, plan, employees, year, month });
  } else if (plan.type === 'PERFORMANCE') {
    results = await calculatePerformanceIncentives({ orgId, plan, employees, year, month });
  } else if (plan.type === 'TASK') {
    results = await calculateTaskIncentives({ orgId, plan, employees, year, month });
  } else if (plan.type === 'PROJECT') {
    results = await calculateProjectIncentives({ orgId, plan, employees, year, month });
  } else if (plan.type === 'REFERRAL') {
    results = await calculateReferralIncentives({ orgId, plan, employees, year, month });
  } else {
    throw Object.assign(new Error(`Unknown incentive type: ${plan.type}`), { status: 400 });
  }

  // Apply max cap
  if (plan.maxCap) {
    const cap = Number(plan.maxCap);
    for (const r of results) {
      if (r.calculatedAmount > cap) r.calculatedAmount = cap;
    }
  }

  // Determine initial status
  const initialStatus = plan.approvalRequired ? 'PENDING_REVIEW' : 'APPROVED';

  // Upsert employee incentives
  const upserted = [];
  for (const r of results) {
    if (r.calculatedAmount <= 0) continue;

    const record = await prisma.employeeIncentive.upsert({
      where: {
        orgId_employeeId_planId_periodStart_periodEnd: {
          orgId, employeeId: r.employeeId, planId: plan.id,
          periodStart: start, periodEnd: end,
        },
      },
      create: {
        orgId,
        employeeId: r.employeeId,
        planId: plan.id,
        periodStart: start,
        periodEnd: end,
        sourceModule: plan.type.toLowerCase(),
        sourceData: r.sourceData || {},
        calculatedAmount: r.calculatedAmount,
        approvedAmount: plan.approvalRequired ? null : r.calculatedAmount,
        status: initialStatus,
        payrollYear: year,
        payrollMonth: month,
      },
      update: {
        sourceData: r.sourceData || {},
        calculatedAmount: r.calculatedAmount,
        approvedAmount: plan.approvalRequired ? null : r.calculatedAmount,
        status: initialStatus,
      },
    });
    upserted.push(record);
  }

  await auditLog({
    orgId, actorId: adminId,
    action: 'incentive.calculate', resource: 'employee_incentive',
    newData: { planId, year, month, calculated: upserted.length }, req,
  });

  return { calculated: upserted.length, planName: plan.name, year, month };
}

async function calculateAttendanceIncentives({ prisma, orgId, plan, employees, start, end, year, month }) {
  // Fetch attendance data for the period
  const attendance = await prisma.attendance.findMany({
    where: { orgId, date: { gte: start, lte: end } },
    select: { employeeId: true, status: true, lateMinutes: true, earlyExitMinutes: true },
  });

  // Fetch unpaid leaves
  const leaves = await prisma.leave.findMany({
    where: {
      orgId, status: 'APPROVED', leaveType: 'UNPAID',
      startDate: { lte: end }, endDate: { gte: start },
    },
    select: { employeeId: true, days: true },
  });

  // Group by employee
  const attByEmp = {};
  for (const rec of attendance) {
    if (!attByEmp[rec.employeeId]) {
      attByEmp[rec.employeeId] = { presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, earlyExitDays: 0, totalWorkDays: 0 };
    }
    const d = attByEmp[rec.employeeId];
    d.totalWorkDays++;
    if (rec.status === 'PRESENT') d.presentDays++;
    else if (rec.status === 'LATE') { d.presentDays++; d.lateDays++; }
    else if (rec.status === 'HALF_DAY') { d.halfDays++; d.presentDays += 0.5; }
    else if (rec.status === 'ABSENT') d.absentDays++;
    else if (rec.status === 'EARLY_EXIT') { d.presentDays++; d.earlyExitDays++; }
  }

  const unpaidByEmp = {};
  for (const lv of leaves) {
    unpaidByEmp[lv.employeeId] = (unpaidByEmp[lv.employeeId] || 0) + lv.days;
  }

  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    const attData = attByEmp[emp.id] || { presentDays: 0, absentDays: 0, lateDays: 0, halfDays: 0, earlyExitDays: 0, totalWorkDays: 0 };
    attData.unpaidLeaveDays = unpaidByEmp[emp.id] || 0;

    if (!isEligible(emp, plan, attData.presentDays)) continue;

    const { incentive, breakdown } = calculateAttendanceIncentive({ rules, attendanceData: attData });

    results.push({
      employeeId: emp.id,
      calculatedAmount: incentive,
      sourceData: { attendance: attData, breakdown },
    });
  }

  return results;
}

function calculateFixedIncentives({ plan, employees }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const fixedAmount = rules.find(r => r.condition === 'fixed_amount');
  const amount = fixedAmount ? Number(fixedAmount.amount) : 0;

  if (amount <= 0) return [];

  return employees
    .filter(emp => isEligible(emp, plan, 999)) // no min days for festival/custom
    .map(emp => ({
      employeeId: emp.id,
      calculatedAmount: amount,
      sourceData: { type: plan.type, fixedAmount: amount },
    }));
}

// ── Sales Incentive Calculator ───────────────────────────────────────────────
async function calculateSalesIncentives({ orgId, plan, employees, year, month }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    if (!isEligible(emp, plan, 0)) continue;
    const stats = await getSalesStats({ orgId, employeeId: emp.id, year, month });
    if (stats.totalDeals === 0) continue;

    let amount = 0;
    for (const rule of rules) {
      if (rule.condition === 'per_deal') {
        amount += stats.totalDeals * Number(rule.amount || 0);
      } else if (rule.condition === 'commission_pct') {
        amount += stats.totalValue * (Number(rule.percentage || 0) / 100);
      } else if (rule.condition === 'target_bonus' && rule.target) {
        if (stats.totalValue >= Number(rule.target)) amount += Number(rule.amount || 0);
      } else if (rule.condition === 'fixed_amount') {
        amount += Number(rule.amount || 0);
      }
    }

    if (amount > 0) {
      results.push({ employeeId: emp.id, calculatedAmount: Math.round(amount * 100) / 100, sourceData: { type: 'SALES', ...stats } });
    }
  }
  return results;
}

// ── Performance Incentive Calculator ─────────────────────────────────────────
async function calculatePerformanceIncentives({ orgId, plan, employees, year, month }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    if (!isEligible(emp, plan, 0)) continue;
    const perf = await getPerformanceScore({ orgId, employeeId: emp.id, year, month });
    if (perf.totalKpis === 0) continue;

    let amount = 0;
    for (const rule of rules) {
      if (rule.condition === 'score_threshold') {
        if (perf.averageScore >= Number(rule.minScore || 80)) amount += Number(rule.amount || 0);
      } else if (rule.condition === 'score_multiplier') {
        amount += perf.averageScore * Number(rule.multiplier || 1);
      } else if (rule.condition === 'fixed_amount') {
        amount += Number(rule.amount || 0);
      }
    }

    if (amount > 0) {
      results.push({ employeeId: emp.id, calculatedAmount: Math.round(amount * 100) / 100, sourceData: { type: 'PERFORMANCE', ...perf } });
    }
  }
  return results;
}

// ── Task Incentive Calculator ────────────────────────────────────────────────
async function calculateTaskIncentives({ orgId, plan, employees, year, month }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    if (!isEligible(emp, plan, 0)) continue;
    const stats = await getTaskStats({ orgId, employeeId: emp.id, year, month });
    if (stats.completed === 0) continue;

    let amount = 0;
    for (const rule of rules) {
      if (rule.condition === 'per_task') {
        amount += stats.completed * Number(rule.amount || 0);
      } else if (rule.condition === 'completion_bonus' && rule.minTasks) {
        if (stats.completed >= Number(rule.minTasks)) amount += Number(rule.amount || 0);
      } else if (rule.condition === 'fixed_amount') {
        amount += Number(rule.amount || 0);
      }
    }

    if (amount > 0) {
      results.push({ employeeId: emp.id, calculatedAmount: Math.round(amount * 100) / 100, sourceData: { type: 'TASK', ...stats } });
    }
  }
  return results;
}

// ── Project Incentive Calculator ─────────────────────────────────────────────
async function calculateProjectIncentives({ orgId, plan, employees, year, month }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    if (!isEligible(emp, plan, 0)) continue;
    const stats = await getProjectStats({ orgId, employeeId: emp.id, year, month });
    if (stats.completedProjects === 0 && stats.totalProjects === 0) continue;

    let amount = 0;
    for (const rule of rules) {
      if (rule.condition === 'per_project_completed') {
        amount += stats.completedProjects * Number(rule.amount || 0);
      } else if (rule.condition === 'active_member_bonus') {
        if (stats.totalProjects > 0) amount += Number(rule.amount || 0);
      } else if (rule.condition === 'fixed_amount') {
        amount += Number(rule.amount || 0);
      }
    }

    if (amount > 0) {
      results.push({ employeeId: emp.id, calculatedAmount: Math.round(amount * 100) / 100, sourceData: { type: 'PROJECT', ...stats } });
    }
  }
  return results;
}

// ── Referral Incentive Calculator ────────────────────────────────────────────
async function calculateReferralIncentives({ orgId, plan, employees, year, month }) {
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  const results = [];

  for (const emp of employees) {
    if (!isEligible(emp, plan, 0)) continue;
    const stats = await getReferralStats({ orgId, employeeId: emp.id, year, month });
    if (stats.hiredCount === 0 && stats.totalSubmitted === 0) continue;

    let amount = 0;
    for (const rule of rules) {
      if (rule.condition === 'per_hire') {
        amount += stats.hiredCount * Number(rule.amount || 0);
      } else if (rule.condition === 'per_submission') {
        amount += stats.totalSubmitted * Number(rule.amount || 0);
      } else if (rule.condition === 'fixed_amount') {
        amount += Number(rule.amount || 0);
      }
    }

    if (amount > 0) {
      results.push({ employeeId: emp.id, calculatedAmount: Math.round(amount * 100) / 100, sourceData: { type: 'REFERRAL', ...stats } });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL / REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function listIncentives({ orgId, planId, status, employeeId, year, month, page = 1, limit = 50 }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (planId) where.planId = planId;
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (year && month) {
    where.payrollYear = year;
    where.payrollMonth = month;
  }

  const [records, total] = await Promise.all([
    prisma.employeeIncentive.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true, department: true, designation: true } },
        plan: { select: { name: true, type: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employeeIncentive.count({ where }),
  ]);

  return { records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getMyIncentives({ orgId, employeeId, year }) {
  const prisma = getPrisma();
  const where = { orgId, employeeId };
  if (year) where.payrollYear = year;

  return prisma.employeeIncentive.findMany({
    where,
    include: {
      plan: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function reviewIncentive({ orgId, incentiveId, action, approvedAmount, reviewNote, adminId, req }) {
  const prisma = getPrisma();

  const record = await prisma.employeeIncentive.findFirst({ where: { id: incentiveId, orgId } });
  if (!record) throw Object.assign(new Error('Incentive record not found'), { status: 404 });
  if (!['CALCULATED', 'PENDING_REVIEW'].includes(record.status)) {
    throw Object.assign(new Error('Incentive is not in a reviewable state'), { status: 400 });
  }

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
  const finalAmount = action === 'approve'
    ? (approvedAmount !== undefined ? approvedAmount : Number(record.calculatedAmount))
    : 0;

  const updated = await prisma.employeeIncentive.update({
    where: { id: incentiveId },
    data: {
      status: newStatus,
      approvedAmount: finalAmount,
      reviewedBy: adminId,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
  });

  await auditLog({
    orgId, actorId: adminId,
    action: `incentive.${action}`, resource: 'employee_incentive',
    resourceId: incentiveId, oldData: { status: record.status }, newData: { status: newStatus, approvedAmount: finalAmount }, req,
  });

  return updated;
}

async function bulkReview({ orgId, incentiveIds, action, adminId, req }) {
  const prisma = getPrisma();
  let count = 0;

  for (const id of incentiveIds) {
    try {
      await reviewIncentive({ orgId, incentiveId: id, action, adminId, req });
      count++;
    } catch {
      // Skip already-reviewed or invalid records
    }
  }

  return { reviewed: count, action };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUSTMENTS & CLAWBACKS
// ═══════════════════════════════════════════════════════════════════════════════

async function createAdjustment({ orgId, incentiveId, adjustmentType, amount, reason, adminId, req }) {
  const prisma = getPrisma();

  const incentive = await prisma.employeeIncentive.findFirst({ where: { id: incentiveId, orgId } });
  if (!incentive) throw Object.assign(new Error('Incentive not found'), { status: 404 });

  const adjustment = await prisma.incentiveAdjustment.create({
    data: {
      orgId,
      incentiveId,
      adjustmentType,
      amount,
      reason,
      createdBy: adminId,
    },
  });

  // Update approved amount with adjustment
  if (incentive.approvedAmount !== null) {
    const newApproved = r2(Number(incentive.approvedAmount) + Number(amount));
    await prisma.employeeIncentive.update({
      where: { id: incentiveId },
      data: { approvedAmount: Math.max(0, newApproved) },
    });
  }

  await auditLog({
    orgId, actorId: adminId,
    action: `incentive.${adjustmentType.toLowerCase()}`, resource: 'incentive_adjustment',
    resourceId: adjustment.id, newData: { incentiveId, adjustmentType, amount, reason }, req,
  });

  return adjustment;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

async function getIncentiveSummary({ orgId, year, month }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (year) where.payrollYear = year;
  if (month) where.payrollMonth = month;

  const incentives = await prisma.employeeIncentive.findMany({
    where,
    select: {
      status: true,
      calculatedAmount: true,
      approvedAmount: true,
      paidAmount: true,
      plan: { select: { name: true, type: true } },
    },
  });

  const totalCalculated = incentives.reduce((s, i) => s + Number(i.calculatedAmount), 0);
  const totalApproved = incentives.filter(i => i.approvedAmount !== null).reduce((s, i) => s + Number(i.approvedAmount), 0);
  const totalPaid = incentives.reduce((s, i) => s + Number(i.paidAmount), 0);

  const byStatus = {};
  const byPlan = {};
  for (const i of incentives) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    const planName = i.plan.name;
    if (!byPlan[planName]) byPlan[planName] = { count: 0, total: 0 };
    byPlan[planName].count++;
    byPlan[planName].total += Number(i.approvedAmount || i.calculatedAmount);
  }

  return {
    totalRecords: incentives.length,
    totalCalculated: r2(totalCalculated),
    totalApproved: r2(totalApproved),
    totalPaid: r2(totalPaid),
    pendingApproval: byStatus.PENDING_REVIEW || 0,
    byStatus,
    byPlan,
  };
}

/**
 * Get approved incentive total for an employee for a payroll month.
 * Called by payroll engine during payslip generation.
 */
async function getApprovedIncentiveForPayroll({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();

  const incentives = await prisma.employeeIncentive.findMany({
    where: {
      orgId,
      employeeId,
      payrollYear: year,
      payrollMonth: month,
      status: 'APPROVED',
    },
    select: { approvedAmount: true, plan: { select: { taxable: true } } },
  });

  let taxableAmount = 0;
  let nonTaxableAmount = 0;

  for (const i of incentives) {
    const amt = Number(i.approvedAmount || 0);
    if (i.plan.taxable) taxableAmount += amt;
    else nonTaxableAmount += amt;
  }

  return {
    total: r2(taxableAmount + nonTaxableAmount),
    taxable: r2(taxableAmount),
    nonTaxable: r2(nonTaxableAmount),
  };
}

/**
 * Mark incentives as PAID after payroll is marked as paid.
 */
async function markIncentivesPaid({ orgId, year, month }) {
  const prisma = getPrisma();

  const result = await prisma.employeeIncentive.updateMany({
    where: {
      orgId,
      payrollYear: year,
      payrollMonth: month,
      status: 'APPROVED',
    },
    data: {
      status: 'PAID',
      paidAmount: undefined, // will be set per-record below
    },
  });

  // Set paidAmount = approvedAmount for each
  const approved = await prisma.employeeIncentive.findMany({
    where: { orgId, payrollYear: year, payrollMonth: month, status: 'PAID' },
  });
  for (const inc of approved) {
    await prisma.employeeIncentive.update({
      where: { id: inc.id },
      data: { paidAmount: inc.approvedAmount || inc.calculatedAmount },
    });
  }

  return { marked: result.count };
}

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  calculateIncentives,
  listIncentives,
  getMyIncentives,
  reviewIncentive,
  bulkReview,
  createAdjustment,
  getIncentiveSummary,
  getApprovedIncentiveForPayroll,
  markIncentivesPaid,
};
