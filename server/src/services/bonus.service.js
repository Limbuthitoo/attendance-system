// ─────────────────────────────────────────────────────────────────────────────
// Bonus Service — Plans, eligibility criteria, calculation, approval
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CRUD
// ═══════════════════════════════════════════════════════════════════════════════

async function listPlans({ orgId, type, status, fiscalYear }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (fiscalYear) where.fiscalYear = Number(fiscalYear);
  return prisma.bonusPlan.findMany({
    where,
    include: { creator: { select: { id: true, name: true } }, _count: { select: { employeeBonuses: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPlan(orgId, planId) {
  const prisma = getPrisma();
  const plan = await prisma.bonusPlan.findFirst({
    where: { id: planId, orgId },
    include: { creator: { select: { id: true, name: true } }, _count: { select: { employeeBonuses: true } } },
  });
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  return plan;
}

async function createPlan({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const plan = await prisma.bonusPlan.create({
    data: {
      orgId,
      name: data.name,
      type: data.type || 'FESTIVAL',
      description: data.description,
      status: data.status || 'DRAFT',
      baseAmount: data.baseAmount || 0,
      calculationMethod: data.calculationMethod || 'fixed',
      salaryPercentage: data.salaryPercentage || null,
      seniorityTiers: data.seniorityTiers || null,
      proRataEnabled: data.proRataEnabled || false,
      applicableDepartments: data.applicableDepartments || [],
      applicableDesignations: data.applicableDesignations || [],
      minServiceDays: data.minServiceDays || 0,
      allowProbation: data.allowProbation || false,
      minAttendancePct: data.minAttendancePct || null,
      minPerformanceScore: data.minPerformanceScore || null,
      requireNoUnpaidLeave: data.requireNoUnpaidLeave || false,
      requireNoDisciplinary: data.requireNoDisciplinary || false,
      customCriteria: data.customCriteria || null,
      fiscalYear: data.fiscalYear || null,
      bonusMonth: data.bonusMonth || null,
      festivalName: data.festivalName || null,
      maxCap: data.maxCap || null,
      taxable: data.taxable !== undefined ? data.taxable : true,
      createdBy: adminId,
    },
  });
  await auditLog({ orgId, action: 'bonus_plan.create', performedBy: adminId, entityType: 'BonusPlan', entityId: plan.id, details: { name: plan.name, type: plan.type }, req });
  return plan;
}

async function updatePlan({ orgId, planId, data, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.bonusPlan.findFirst({ where: { id: planId, orgId } });
  if (!existing) throw Object.assign(new Error('Plan not found'), { status: 404 });

  const updateData = {};
  const allowedFields = [
    'name', 'type', 'description', 'status', 'baseAmount', 'calculationMethod',
    'salaryPercentage', 'seniorityTiers', 'proRataEnabled', 'applicableDepartments',
    'applicableDesignations', 'minServiceDays', 'allowProbation', 'minAttendancePct',
    'minPerformanceScore', 'requireNoUnpaidLeave', 'requireNoDisciplinary', 'customCriteria',
    'fiscalYear', 'bonusMonth', 'festivalName', 'maxCap', 'taxable',
  ];
  for (const f of allowedFields) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }

  const plan = await prisma.bonusPlan.update({ where: { id: planId }, data: updateData });
  await auditLog({ orgId, action: 'bonus_plan.update', performedBy: adminId, entityType: 'BonusPlan', entityId: plan.id, details: updateData, req });
  return plan;
}

async function deletePlan({ orgId, planId, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.bonusPlan.findFirst({ where: { id: planId, orgId } });
  if (!existing) throw Object.assign(new Error('Plan not found'), { status: 404 });
  await prisma.bonusPlan.delete({ where: { id: planId } });
  await auditLog({ orgId, action: 'bonus_plan.delete', performedBy: adminId, entityType: 'BonusPlan', entityId: planId, details: { name: existing.name }, req });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELIGIBILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

function checkEligibility(employee, plan, stats) {
  const reasons = [];

  // Active check
  if (!employee.isActive) reasons.push('Employee is not active');

  // Probation check
  if (employee.employmentStatus === 'probation' && !plan.allowProbation) {
    reasons.push('Employee is on probation');
  }

  // Min service days
  if (plan.minServiceDays > 0 && employee.joinDate) {
    const daysSinceJoin = Math.floor((Date.now() - new Date(employee.joinDate).getTime()) / 86400000);
    if (daysSinceJoin < plan.minServiceDays) {
      reasons.push(`Min service days not met (${daysSinceJoin}/${plan.minServiceDays})`);
    }
  }

  // Department check
  if (plan.applicableDepartments?.length > 0 && !plan.applicableDepartments.includes(employee.department)) {
    reasons.push(`Department ${employee.department} not applicable`);
  }

  // Designation check
  if (plan.applicableDesignations?.length > 0 && !plan.applicableDesignations.includes(employee.designation)) {
    reasons.push(`Designation ${employee.designation} not applicable`);
  }

  // Attendance percentage
  if (plan.minAttendancePct && stats.attendancePct !== null) {
    if (stats.attendancePct < Number(plan.minAttendancePct)) {
      reasons.push(`Attendance ${stats.attendancePct.toFixed(1)}% below ${plan.minAttendancePct}%`);
    }
  }

  // Performance score
  if (plan.minPerformanceScore && stats.avgPerformanceScore !== null) {
    if (stats.avgPerformanceScore < Number(plan.minPerformanceScore)) {
      reasons.push(`Performance score ${stats.avgPerformanceScore.toFixed(1)} below ${plan.minPerformanceScore}`);
    }
  }

  // Unpaid leave
  if (plan.requireNoUnpaidLeave && stats.unpaidLeaveDays > 0) {
    reasons.push(`Has ${stats.unpaidLeaveDays} unpaid leave days`);
  }

  return { eligible: reasons.length === 0, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATE BONUSES
// ═══════════════════════════════════════════════════════════════════════════════

async function calculateBonuses({ orgId, planId, fiscalYear, bonusMonth, adminId, req }) {
  const prisma = getPrisma();
  const plan = await prisma.bonusPlan.findFirst({ where: { id: planId, orgId } });
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });
  if (!['DRAFT', 'ACTIVE'].includes(plan.status)) {
    throw Object.assign(new Error('Plan must be DRAFT or ACTIVE to calculate'), { status: 400 });
  }

  const year = fiscalYear || plan.fiscalYear || new Date().getFullYear();
  const month = bonusMonth || plan.bonusMonth || null;

  // Get eligible employees
  const empWhere = { orgId, isActive: true };
  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true, name: true, department: true, designation: true, employmentStatus: true,
      joinDate: true, isActive: true,
      salaryStructures: { where: { isActive: true }, take: 1, orderBy: { effectiveFrom: 'desc' }, select: { basicSalary: true, grossSalary: true } },
    },
  });

  const results = [];

  for (const emp of employees) {
    // Gather stats for eligibility
    const stats = await gatherEmployeeStats(prisma, orgId, emp.id, year, month);
    const { eligible, reasons } = checkEligibility(emp, plan, stats);

    // Calculate bonus amount
    let baseAmount = Number(plan.baseAmount);
    let proRataFactor = 1;
    let seniorityMultiplier = 1;
    const salary = emp.salaryStructures[0];

    // Calculation method
    if (plan.calculationMethod === 'salary_percentage' && salary && plan.salaryPercentage) {
      baseAmount = Number(salary.basicSalary) * Number(plan.salaryPercentage) / 100;
    }

    // Seniority tiers
    if (plan.calculationMethod === 'seniority_tiered' && plan.seniorityTiers && emp.joinDate) {
      const yearsOfService = (Date.now() - new Date(emp.joinDate).getTime()) / (365.25 * 86400000);
      const tiers = Array.isArray(plan.seniorityTiers) ? plan.seniorityTiers : [];
      for (const tier of tiers) {
        if (yearsOfService >= (tier.minYears || 0) && (!tier.maxYears || yearsOfService < tier.maxYears)) {
          seniorityMultiplier = tier.multiplier || 1;
          break;
        }
      }
    }

    // Pro-rata for partial year
    if (plan.proRataEnabled && emp.joinDate) {
      const joinDate = new Date(emp.joinDate);
      const yearStart = new Date(year, 0, 1);
      if (joinDate > yearStart) {
        const totalDays = (new Date(year, 11, 31) - yearStart) / 86400000 + 1;
        const workedDays = (new Date(year, 11, 31) - joinDate) / 86400000 + 1;
        proRataFactor = Math.min(1, Math.max(0, workedDays / totalDays));
      }
    }

    let finalAmount = baseAmount * seniorityMultiplier * proRataFactor;
    if (plan.maxCap && finalAmount > Number(plan.maxCap)) finalAmount = Number(plan.maxCap);

    // Tax (simplified 5% if taxable)
    const taxAmount = plan.taxable ? finalAmount * 0.05 : 0;
    const netAmount = finalAmount - taxAmount;

    const bonusData = {
      orgId,
      employeeId: emp.id,
      bonusPlanId: planId,
      fiscalYear: year,
      bonusMonth: month,
      baseAmount: baseAmount,
      proRataFactor: proRataFactor,
      seniorityMultiplier: seniorityMultiplier,
      adjustmentAmount: 0,
      finalAmount: finalAmount,
      taxAmount: taxAmount,
      netAmount: netAmount,
      eligible,
      ineligibleReason: eligible ? null : reasons.join('; '),
      criteriaSnapshot: { ...stats, eligible, reasons },
      status: eligible ? 'CALCULATED' : 'CANCELLED',
    };

    const record = await prisma.employeeBonus.upsert({
      where: {
        orgId_employeeId_bonusPlanId_fiscalYear_bonusMonth: {
          orgId, employeeId: emp.id, bonusPlanId: planId, fiscalYear: year, bonusMonth: month || 0,
        },
      },
      create: bonusData,
      update: bonusData,
    });

    results.push({ employeeId: emp.id, name: emp.name, department: emp.department, eligible, finalAmount, netAmount, reasons });
  }

  // Update plan status
  await prisma.bonusPlan.update({ where: { id: planId }, data: { status: 'ACTIVE', fiscalYear: year } });

  await auditLog({
    orgId, action: 'bonus.calculate', performedBy: adminId,
    entityType: 'BonusPlan', entityId: planId,
    details: { fiscalYear: year, bonusMonth: month, totalEmployees: results.length, eligible: results.filter(r => r.eligible).length },
    req,
  });

  return {
    planId, fiscalYear: year, bonusMonth: month,
    totalEmployees: results.length,
    eligible: results.filter(r => r.eligible).length,
    ineligible: results.filter(r => !r.eligible).length,
    totalAmount: results.filter(r => r.eligible).reduce((s, r) => s + r.finalAmount, 0),
    results,
  };
}

// Gather stats for an employee to check criteria
async function gatherEmployeeStats(prisma, orgId, employeeId, year, month) {
  const stats = { attendancePct: null, avgPerformanceScore: null, unpaidLeaveDays: 0, totalPresent: 0, totalWorkDays: 0 };

  // Attendance stats for the year (or specific month)
  const attWhere = { orgId, employeeId, date: { gte: new Date(year, 0, 1), lte: month ? new Date(year, month - 1 + 1, 0) : new Date(year, 11, 31) } };
  const attRecords = await prisma.attendance.findMany({ where: attWhere, select: { status: true } });
  stats.totalWorkDays = attRecords.length;
  stats.totalPresent = attRecords.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'EARLY_EXIT').length;
  stats.attendancePct = stats.totalWorkDays > 0 ? (stats.totalPresent / stats.totalWorkDays) * 100 : null;

  // Performance scores
  try {
    const scores = await prisma.kpiScore.findMany({
      where: { orgId, employeeId, scoredAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
      select: { score: true },
    });
    if (scores.length > 0) {
      stats.avgPerformanceScore = scores.reduce((s, k) => s + Number(k.score), 0) / scores.length;
    }
  } catch {
    // Performance module may not exist
  }

  // Unpaid leaves
  try {
    const leaves = await prisma.leave.findMany({
      where: { orgId, employeeId, status: 'APPROVED', leaveType: 'UNPAID', startDate: { gte: new Date(year, 0, 1) } },
      select: { totalDays: true },
    });
    stats.unpaidLeaveDays = leaves.reduce((s, l) => s + Number(l.totalDays), 0);
  } catch {
    // Ignore
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BONUS RECORDS — List, approve, bulk actions
// ═══════════════════════════════════════════════════════════════════════════════

async function listBonuses({ orgId, fiscalYear, bonusMonth, status, planId, department }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (fiscalYear) where.fiscalYear = Number(fiscalYear);
  if (bonusMonth) where.bonusMonth = Number(bonusMonth);
  if (status) where.status = status;
  if (planId) where.bonusPlanId = planId;

  const records = await prisma.employeeBonus.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, department: true, designation: true, employmentStatus: true, joinDate: true } },
      bonusPlan: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ employee: { department: 'asc' } }, { employee: { name: 'asc' } }],
  });

  // Filter by department after join (since department is on employee)
  if (department) {
    return records.filter(r => r.employee?.department === department);
  }
  return records;
}

async function getMyBonuses({ orgId, employeeId, fiscalYear }) {
  const prisma = getPrisma();
  const where = { orgId, employeeId };
  if (fiscalYear) where.fiscalYear = Number(fiscalYear);
  return prisma.employeeBonus.findMany({
    where,
    include: { bonusPlan: { select: { name: true, type: true, festivalName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function reviewBonus({ orgId, bonusId, action, adminId, notes, req }) {
  const prisma = getPrisma();
  const bonus = await prisma.employeeBonus.findFirst({ where: { id: bonusId, orgId } });
  if (!bonus) throw Object.assign(new Error('Bonus record not found'), { status: 404 });
  if (!['CALCULATED', 'PENDING_APPROVAL'].includes(bonus.status)) {
    throw Object.assign(new Error('Can only review calculated/pending bonuses'), { status: 400 });
  }

  const newStatus = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : null;
  if (!newStatus) throw Object.assign(new Error('Action must be approve or reject'), { status: 400 });

  const updated = await prisma.employeeBonus.update({
    where: { id: bonusId },
    data: { status: newStatus, approvedBy: adminId, approvedAt: new Date(), notes: notes || bonus.notes },
  });

  await auditLog({ orgId, action: `bonus.${action}`, performedBy: adminId, entityType: 'EmployeeBonus', entityId: bonusId, details: { employeeId: bonus.employeeId, amount: Number(bonus.finalAmount) }, req });
  return updated;
}

async function bulkReview({ orgId, bonusIds, action, adminId, req }) {
  const newStatus = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : null;
  if (!newStatus) throw Object.assign(new Error('Action must be approve or reject'), { status: 400 });

  const prisma = getPrisma();
  const result = await prisma.employeeBonus.updateMany({
    where: { id: { in: bonusIds }, orgId, status: { in: ['CALCULATED', 'PENDING_APPROVAL'] } },
    data: { status: newStatus, approvedBy: adminId, approvedAt: new Date() },
  });

  await auditLog({ orgId, action: `bonus.bulk_${action}`, performedBy: adminId, entityType: 'EmployeeBonus', entityId: 'bulk', details: { count: result.count }, req });
  return { updated: result.count };
}

async function markPaid({ orgId, bonusIds, adminId, req }) {
  const prisma = getPrisma();
  const result = await prisma.employeeBonus.updateMany({
    where: { id: { in: bonusIds }, orgId, status: 'APPROVED' },
    data: { status: 'PAID', paidAt: new Date() },
  });
  await auditLog({ orgId, action: 'bonus.mark_paid', performedBy: adminId, entityType: 'EmployeeBonus', entityId: 'bulk', details: { count: result.count }, req });
  return { updated: result.count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

async function getSummary({ orgId, fiscalYear }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (fiscalYear) where.fiscalYear = Number(fiscalYear);

  const all = await prisma.employeeBonus.findMany({
    where,
    include: {
      employee: { select: { department: true } },
      bonusPlan: { select: { name: true, type: true } },
    },
  });

  const byStatus = {};
  const byPlan = {};
  const byDepartment = {};
  let totalCalculated = 0, totalApproved = 0, totalPaid = 0;

  for (const b of all) {
    const amt = Number(b.finalAmount);
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;

    const planName = b.bonusPlan?.name || 'Unknown';
    if (!byPlan[planName]) byPlan[planName] = { count: 0, total: 0, type: b.bonusPlan?.type };
    byPlan[planName].count++;
    byPlan[planName].total += amt;

    const dept = b.employee?.department || 'Unknown';
    if (!byDepartment[dept]) byDepartment[dept] = { count: 0, total: 0, eligible: 0, ineligible: 0 };
    byDepartment[dept].count++;
    byDepartment[dept].total += amt;
    if (b.eligible) byDepartment[dept].eligible++;
    else byDepartment[dept].ineligible++;

    if (['CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID'].includes(b.status)) totalCalculated += amt;
    if (['APPROVED', 'PAID'].includes(b.status)) totalApproved += amt;
    if (b.status === 'PAID') totalPaid += amt;
  }

  return {
    totalRecords: all.length,
    totalCalculated,
    totalApproved,
    totalPaid,
    pendingApproval: all.filter(b => ['CALCULATED', 'PENDING_APPROVAL'].includes(b.status)).length,
    byStatus,
    byPlan,
    byDepartment,
  };
}

module.exports = {
  listPlans, getPlan, createPlan, updatePlan, deletePlan,
  calculateBonuses, checkEligibility,
  listBonuses, getMyBonuses, reviewBonus, bulkReview, markPaid,
  getSummary,
};
