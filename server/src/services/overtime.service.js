// ─────────────────────────────────────────────────────────────────────────────
// Overtime Service — Policies, auto-calculation, approval workflow
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

// ── Policy CRUD ─────────────────────────────────────────────────────────────

async function listPolicies({ orgId }) {
  const prisma = getPrisma();
  return prisma.overtimePolicy.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
}

async function createPolicy({ orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const policy = await prisma.overtimePolicy.create({
    data: {
      orgId,
      name: data.name,
      overtimeAfterHours: data.overtimeAfterHours,
      maxOvertimeHoursDaily: data.maxOvertimeHoursDaily || 4,
      overtimeRateMultiplier: data.overtimeRateMultiplier || 1.5,
      weekendRateMultiplier: data.weekendRateMultiplier || 2.0,
      holidayRateMultiplier: data.holidayRateMultiplier || 2.0,
      requiresApproval: data.requiresApproval !== false,
    },
  });

  await auditLog({ orgId, actorId: adminId, action: 'overtime_policy.create', resource: 'overtime_policy', resourceId: policy.id, newData: data, req });
  return policy;
}

async function updatePolicy({ orgId, policyId, data, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.overtimePolicy.findFirst({ where: { id: policyId, orgId } });
  if (!existing) throw Object.assign(new Error('Policy not found'), { status: 404 });

  const updated = await prisma.overtimePolicy.update({
    where: { id: policyId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.overtimeAfterHours !== undefined && { overtimeAfterHours: data.overtimeAfterHours }),
      ...(data.maxOvertimeHoursDaily !== undefined && { maxOvertimeHoursDaily: data.maxOvertimeHoursDaily }),
      ...(data.overtimeRateMultiplier !== undefined && { overtimeRateMultiplier: data.overtimeRateMultiplier }),
      ...(data.weekendRateMultiplier !== undefined && { weekendRateMultiplier: data.weekendRateMultiplier }),
      ...(data.holidayRateMultiplier !== undefined && { holidayRateMultiplier: data.holidayRateMultiplier }),
      ...(data.requiresApproval !== undefined && { requiresApproval: data.requiresApproval }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await auditLog({ orgId, actorId: adminId, action: 'overtime_policy.update', resource: 'overtime_policy', resourceId: policyId, oldData: existing, newData: data, req });
  return updated;
}

// ── Overtime calculation (run daily or on checkout) ─────────────────────────

/**
 * Calculate overtime for a single attendance record.
 * Called automatically when an employee checks out.
 */
async function calculateOvertime({ orgId, employeeId, attendanceDate, workHours }) {
  const prisma = getPrisma();

  // Get active policy for the org
  const policy = await prisma.overtimePolicy.findFirst({
    where: { orgId, isActive: true },
  });

  if (!policy) return null; // No overtime policy configured

  const threshold = Number(policy.overtimeAfterHours);
  if (workHours <= threshold) return null; // No overtime

  const rawOvertime = workHours - threshold;
  const maxDaily = Number(policy.maxOvertimeHoursDaily);
  const overtimeHours = Math.min(rawOvertime, maxDaily);

  // Determine rate multiplier (weekend/holiday/normal)
  const date = new Date(attendanceDate);
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  let rateMultiplier = Number(policy.overtimeRateMultiplier);

  // Check if it's a weekend (Saturday in Nepal)
  if (dayOfWeek === 6) {
    rateMultiplier = Number(policy.weekendRateMultiplier);
  }

  // Check if it's a holiday
  const holiday = await prisma.holiday.findFirst({
    where: {
      orgId,
      adDate: date,
    },
  });
  if (holiday) {
    rateMultiplier = Number(policy.holidayRateMultiplier);
  }

  const status = policy.requiresApproval ? 'PENDING' : 'AUTO_APPROVED';

  const record = await prisma.overtimeRecord.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: {
      orgId,
      employeeId,
      policyId: policy.id,
      date,
      regularHours: threshold,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      rateMultiplier,
      status,
    },
    update: {
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      rateMultiplier,
      regularHours: threshold,
    },
  });

  return record;
}

// ── Overtime records management ─────────────────────────────────────────────

async function listOvertimeRecords({ orgId, employeeId, status, startDate, endDate, page = 1, limit = 50 }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const [records, total] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true, department: true } },
        policy: { select: { name: true, overtimeRateMultiplier: true } },
        approver: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.overtimeRecord.count({ where }),
  ]);

  return { records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Approve or reject overtime record.
 */
async function reviewOvertime({ orgId, recordId, status, adminId, req }) {
  const prisma = getPrisma();

  const record = await prisma.overtimeRecord.findFirst({ where: { id: recordId, orgId } });
  if (!record) throw Object.assign(new Error('Overtime record not found'), { status: 404 });
  if (record.status !== 'PENDING') throw Object.assign(new Error('Record is not pending'), { status: 400 });

  const updated = await prisma.overtimeRecord.update({
    where: { id: recordId },
    data: {
      status,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });

  await auditLog({ orgId, actorId: adminId, action: `overtime.${status.toLowerCase()}`, resource: 'overtime_record', resourceId: recordId, req });
  return updated;
}

/**
 * Get overtime summary for a period.
 */
async function getOvertimeSummary({ orgId, startDate, endDate }) {
  const prisma = getPrisma();

  const records = await prisma.overtimeRecord.findMany({
    where: {
      orgId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
      status: { in: ['APPROVED', 'AUTO_APPROVED'] },
    },
    select: {
      employeeId: true,
      overtimeHours: true,
      rateMultiplier: true,
      employee: { select: { name: true, employeeCode: true, department: true } },
    },
  });

  const empMap = {};
  for (const rec of records) {
    if (!empMap[rec.employeeId]) {
      empMap[rec.employeeId] = {
        employeeId: rec.employeeId,
        name: rec.employee.name,
        employeeCode: rec.employee.employeeCode,
        department: rec.employee.department,
        totalOvertimeHours: 0,
        weightedHours: 0,
        recordCount: 0,
      };
    }
    const hrs = Number(rec.overtimeHours);
    empMap[rec.employeeId].totalOvertimeHours += hrs;
    empMap[rec.employeeId].weightedHours += hrs * Number(rec.rateMultiplier);
    empMap[rec.employeeId].recordCount++;
  }

  return Object.values(empMap)
    .map(e => ({
      ...e,
      totalOvertimeHours: Math.round(e.totalOvertimeHours * 100) / 100,
      weightedHours: Math.round(e.weightedHours * 100) / 100,
    }))
    .sort((a, b) => b.totalOvertimeHours - a.totalOvertimeHours);
}

module.exports = {
  listPolicies,
  createPolicy,
  updatePolicy,
  calculateOvertime,
  listOvertimeRecords,
  reviewOvertime,
  getOvertimeSummary,
};
