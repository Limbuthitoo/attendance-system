// ─────────────────────────────────────────────────────────────────────────────
// Settings Service — Org settings, shift, work schedule management
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { cacheGet, cacheSet, cacheInvalidate } = require('../config/redis');
const { auditLog } = require('../lib/audit');

/**
 * Get all settings for an organization (with Redis caching)
 */
async function getOrgSettings(orgId) {
  const cacheKey = `settings:${orgId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const prisma = getPrisma();
  const rows = await prisma.orgSetting.findMany({ where: { orgId } });

  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  await cacheSet(cacheKey, settings, 120); // 2 min cache
  return settings;
}

/**
 * Update org settings (batch upsert)
 */
async function updateOrgSettings({ orgId, settings, adminId, req }) {
  const prisma = getPrisma();

  const oldSettings = await getOrgSettings(orgId);

  for (const [key, value] of Object.entries(settings)) {
    await prisma.orgSetting.upsert({
      where: { orgId_key: { orgId, key } },
      create: { orgId, key, value: String(value) },
      update: { value: String(value) },
    });
  }

  await cacheInvalidate(`settings:${orgId}`);

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'settings.update',
    resource: 'org_settings',
    oldData: oldSettings,
    newData: settings,
    req,
  });

  return getOrgSettings(orgId);
}

/**
 * Create a shift for an org
 */
async function createShift({ orgId, data, adminId, req }) {
  const prisma = getPrisma();

  // If this is marked as default, unset other defaults
  if (data.isDefault) {
    await prisma.shift.updateMany({
      where: { orgId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const shift = await prisma.shift.create({
    data: {
      orgId,
      branchId: data.branchId || null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      lateThresholdMinutes: data.lateThresholdMinutes || 30,
      halfDayHours: data.halfDayHours || 4,
      fullDayHours: data.fullDayHours || 8,
      minCheckoutMinutes: data.minCheckoutMinutes || 2,
      isDefault: data.isDefault || false,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'shift.create',
    resource: 'shift',
    resourceId: shift.id,
    newData: data,
    req,
  });

  return shift;
}

/**
 * List shifts for an org (optionally filter by branchId)
 */
async function listShifts(orgId, { branchId } = {}) {
  const prisma = getPrisma();
  const where = { orgId, isActive: true };
  if (branchId) where.branchId = branchId;

  return prisma.shift.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true, code: true } },
      _count: { select: { employeeAssignments: { where: { isCurrent: true } } } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

/**
 * Get a single shift
 */
async function getShift(shiftId, orgId) {
  const prisma = getPrisma();
  return prisma.shift.findFirst({
    where: { id: shiftId, orgId },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      employeeAssignments: {
        where: { isCurrent: true },
        select: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
      },
    },
  });
}

/**
 * Update a shift
 */
async function updateShift({ shiftId, orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.shift.findFirst({ where: { id: shiftId, orgId } });
  if (!existing) throw Object.assign(new Error('Shift not found'), { status: 404 });

  if (data.isDefault) {
    await prisma.shift.updateMany({
      where: { orgId, isDefault: true, id: { not: shiftId } },
      data: { isDefault: false },
    });
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.branchId !== undefined) updateData.branchId = data.branchId || null;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.lateThresholdMinutes !== undefined) updateData.lateThresholdMinutes = data.lateThresholdMinutes;
  if (data.halfDayHours !== undefined) updateData.halfDayHours = data.halfDayHours;
  if (data.fullDayHours !== undefined) updateData.fullDayHours = data.fullDayHours;
  if (data.minCheckoutMinutes !== undefined) updateData.minCheckoutMinutes = data.minCheckoutMinutes;
  if (typeof data.isDefault === 'boolean') updateData.isDefault = data.isDefault;

  const shift = await prisma.shift.update({ where: { id: shiftId }, data: updateData });

  await auditLog({
    orgId, actorId: adminId, action: 'shift.update',
    resource: 'shift', resourceId: shiftId,
    oldData: { name: existing.name, startTime: existing.startTime, endTime: existing.endTime },
    newData: updateData, req,
  });

  return shift;
}

/**
 * Deactivate a shift
 */
async function deactivateShift({ shiftId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.shift.findFirst({ where: { id: shiftId, orgId } });
  if (!existing) throw Object.assign(new Error('Shift not found'), { status: 404 });

  // Prevent deactivating a shift that has current assignments
  const assignedCount = await prisma.employeeAssignment.count({
    where: { shiftId, isCurrent: true },
  });
  if (assignedCount > 0) {
    throw Object.assign(
      new Error(`Cannot deactivate — ${assignedCount} employee(s) are currently assigned to this shift`),
      { status: 409 }
    );
  }

  const shift = await prisma.shift.update({
    where: { id: shiftId },
    data: { isActive: false },
  });

  await auditLog({
    orgId, actorId: adminId, action: 'shift.deactivate',
    resource: 'shift', resourceId: shiftId,
    oldData: { name: existing.name }, req,
  });

  return shift;
}

/**
 * Create a work schedule
 */
async function createWorkSchedule({ orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const schedule = await prisma.workSchedule.create({
    data: {
      orgId,
      name: data.name,
      workingDays: data.workingDays, // JSON array: ["mon","tue","wed","thu","fri"]
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'work_schedule.create',
    resource: 'work_schedule',
    resourceId: schedule.id,
    newData: data,
    req,
  });

  return schedule;
}

/**
 * List work schedules for an org
 */
async function listWorkSchedules(orgId) {
  const prisma = getPrisma();
  return prisma.workSchedule.findMany({
    where: { orgId, isActive: true },
    include: {
      _count: { select: { employeeAssignments: { where: { isCurrent: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get a single work schedule
 */
async function getWorkSchedule(scheduleId, orgId) {
  const prisma = getPrisma();
  return prisma.workSchedule.findFirst({
    where: { id: scheduleId, orgId },
    include: {
      employeeAssignments: {
        where: { isCurrent: true },
        select: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
      },
    },
  });
}

/**
 * Update a work schedule
 */
async function updateWorkSchedule({ scheduleId, orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.workSchedule.findFirst({ where: { id: scheduleId, orgId } });
  if (!existing) throw Object.assign(new Error('Work schedule not found'), { status: 404 });

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.workingDays !== undefined) updateData.workingDays = data.workingDays;
  if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
  if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;

  const schedule = await prisma.workSchedule.update({ where: { id: scheduleId }, data: updateData });

  await auditLog({
    orgId, actorId: adminId, action: 'work_schedule.update',
    resource: 'work_schedule', resourceId: scheduleId,
    oldData: { name: existing.name, workingDays: existing.workingDays },
    newData: updateData, req,
  });

  return schedule;
}

/**
 * Deactivate a work schedule
 */
async function deactivateWorkSchedule({ scheduleId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.workSchedule.findFirst({ where: { id: scheduleId, orgId } });
  if (!existing) throw Object.assign(new Error('Work schedule not found'), { status: 404 });

  const assignedCount = await prisma.employeeAssignment.count({
    where: { workScheduleId: scheduleId, isCurrent: true },
  });
  if (assignedCount > 0) {
    throw Object.assign(
      new Error(`Cannot deactivate — ${assignedCount} employee(s) are currently using this schedule`),
      { status: 409 }
    );
  }

  const schedule = await prisma.workSchedule.update({
    where: { id: scheduleId },
    data: { isActive: false },
  });

  await auditLog({
    orgId, actorId: adminId, action: 'work_schedule.deactivate',
    resource: 'work_schedule', resourceId: scheduleId,
    oldData: { name: existing.name }, req,
  });

  return schedule;
}

/**
 * Assign an employee to a branch + shift + work schedule
 */
async function assignEmployee({ employeeId, branchId, shiftId, workScheduleId, adminId, orgId, req }) {
  const prisma = getPrisma();

  // Mark old assignment as non-current
  await prisma.employeeAssignment.updateMany({
    where: { employeeId, isCurrent: true },
    data: { isCurrent: false, effectiveTo: new Date() },
  });

  const assignment = await prisma.employeeAssignment.create({
    data: {
      employeeId,
      branchId,
      shiftId,
      workScheduleId,
      effectiveFrom: new Date(),
      isCurrent: true,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'employee.assign',
    resource: 'employee_assignment',
    resourceId: assignment.id,
    newData: { branchId, shiftId, workScheduleId },
    req,
  });

  return assignment;
}

/**
 * Bulk-assign multiple employees to the same branch/shift/schedule
 */
async function bulkAssignEmployees({ employeeIds, branchId, shiftId, workScheduleId, adminId, orgId, req }) {
  const prisma = getPrisma();
  const results = [];

  for (const employeeId of employeeIds) {
    // End current assignment
    await prisma.employeeAssignment.updateMany({
      where: { employeeId, isCurrent: true },
      data: { isCurrent: false, effectiveTo: new Date() },
    });

    const assignment = await prisma.employeeAssignment.create({
      data: { employeeId, branchId, shiftId, workScheduleId, effectiveFrom: new Date(), isCurrent: true },
    });
    results.push(assignment);
  }

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'employee.bulk_assign',
    resource: 'employee_assignment',
    newData: { employeeCount: employeeIds.length, branchId, shiftId, workScheduleId },
    req,
  });

  return results;
}

/**
 * Get current assignment for an employee
 */
async function getEmployeeAssignment(employeeId) {
  const prisma = getPrisma();
  return prisma.employeeAssignment.findFirst({
    where: { employeeId, isCurrent: true },
    include: {
      branch: { select: { id: true, name: true, code: true, timezone: true } },
      shift: true,
      workSchedule: true,
    },
  });
}

/**
 * Get assignment history for an employee
 */
async function getAssignmentHistory(employeeId) {
  const prisma = getPrisma();
  return prisma.employeeAssignment.findMany({
    where: { employeeId },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      workSchedule: { select: { id: true, name: true, workingDays: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * List all current assignments for an org (with employee details)
 */
async function listAssignments(orgId, { branchId, shiftId, workScheduleId } = {}) {
  const prisma = getPrisma();
  const where = { isCurrent: true, employee: { orgId } };
  if (branchId) where.branchId = branchId;
  if (shiftId) where.shiftId = shiftId;
  if (workScheduleId) where.workScheduleId = workScheduleId;

  return prisma.employeeAssignment.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true, designation: true } },
      branch: { select: { id: true, name: true, code: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      workSchedule: { select: { id: true, name: true, workingDays: true } },
    },
    orderBy: { employee: { name: 'asc' } },
  });
}

module.exports = {
  getOrgSettings,
  updateOrgSettings,
  createShift,
  listShifts,
  getShift,
  updateShift,
  deactivateShift,
  createWorkSchedule,
  listWorkSchedules,
  getWorkSchedule,
  updateWorkSchedule,
  deactivateWorkSchedule,
  assignEmployee,
  bulkAssignEmployees,
  getEmployeeAssignment,
  getAssignmentHistory,
  listAssignments,
};
