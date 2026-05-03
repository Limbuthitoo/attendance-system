// ─────────────────────────────────────────────────────────────────────────────
// Leave Service — Apply, review, quota management
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { enqueuePush, enqueuePushToAdmins, enqueueEmail } = require('../config/queue');

/**
 * Apply for leave
 */
async function applyLeave({ employeeId, orgId, leaveType, startDate, endDate, reason, req }) {
  const prisma = getPrisma();

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw Object.assign(new Error('End date must be after start date'), { status: 400 });
  }

  // Calculate days (inclusive)
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // Check overlap with existing pending/approved leaves
  const overlap = await prisma.leave.findFirst({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } },
      ],
    },
  });

  if (overlap) {
    throw Object.assign(new Error('Leave dates overlap with an existing leave request'), { status: 409 });
  }

  // Check quota
  const year = start.getFullYear();
  const quota = await getLeaveQuota(orgId, employeeId, leaveType, year);

  if (quota && quota.totalDays > 0) {
    const used = await prisma.leave.aggregate({
      where: {
        employeeId,
        leaveType,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { gte: new Date(`${year}-01-01`) },
        endDate: { lte: new Date(`${year}-12-31`) },
      },
      _sum: { days: true },
    });

    const usedDays = used._sum.days || 0;
    if (usedDays + days > quota.totalDays) {
      throw Object.assign(
        new Error(`Insufficient ${leaveType} leave balance. Used: ${usedDays}, Remaining: ${quota.totalDays - usedDays}, Requested: ${days}`),
        { status: 400 }
      );
    }
  }

  const leave = await prisma.leave.create({
    data: {
      orgId,
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      reason,
    },
  });

  // Notify admins
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, employeeCode: true },
  });

  await enqueuePushToAdmins({
    orgId,
    title: 'New Leave Application',
    body: `${employee.name} (${employee.employeeCode}) applied for ${days} day(s) ${leaveType} leave`,
    data: { type: 'leave', leaveId: leave.id },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'leave.apply',
    resource: 'leave',
    resourceId: leave.id,
    newData: { leaveType, startDate, endDate, days, reason },
    req,
  });

  return leave;
}

/**
 * Review (approve/reject) a leave request
 */
async function reviewLeave({ leaveId, orgId, reviewerId, status, reviewNote, req }) {
  const prisma = getPrisma();

  const leave = await prisma.leave.findFirst({
    where: { id: leaveId, orgId },
  });

  if (!leave) {
    throw Object.assign(new Error('Leave request not found'), { status: 404 });
  }

  if (leave.status !== 'PENDING') {
    throw Object.assign(new Error('Leave request has already been reviewed'), { status: 400 });
  }

  const updated = await prisma.leave.update({
    where: { id: leaveId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewNote: reviewNote || null,
    },
  });

  // If approved, create ABSENT attendance rows for leave days
  if (status === 'APPROVED') {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: leave.employeeId,
            date: new Date(dateStr),
          },
        },
        create: {
          orgId,
          employeeId: leave.employeeId,
          date: new Date(dateStr),
          status: 'ABSENT',
          source: 'SYSTEM',
          notes: `On ${leave.leaveType.toLowerCase()} leave`,
        },
        update: {
          status: 'ABSENT',
          source: 'SYSTEM',
          notes: `On ${leave.leaveType.toLowerCase()} leave`,
        },
      });
    }
  }

  // Notify the employee
  const statusText = status === 'APPROVED' ? 'approved' : 'rejected';
  await enqueuePush({
    employeeIds: [leave.employeeId],
    title: `Leave ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
    body: `Your ${leave.leaveType.toLowerCase()} leave request has been ${statusText}`,
    data: { type: 'leave', leaveId: leave.id },
  });

  await auditLog({
    orgId,
    actorId: reviewerId,
    action: `leave.${statusText}`,
    resource: 'leave',
    resourceId: leaveId,
    oldData: { status: 'PENDING' },
    newData: { status, reviewNote },
    req,
  });

  return updated;
}

/**
 * Cancel a leave (only employee's own, only PENDING)
 */
async function cancelLeave({ leaveId, employeeId, orgId, req }) {
  const prisma = getPrisma();

  const leave = await prisma.leave.findFirst({
    where: { id: leaveId, employeeId, orgId },
  });

  if (!leave) {
    throw Object.assign(new Error('Leave request not found'), { status: 404 });
  }

  if (leave.status !== 'PENDING') {
    throw Object.assign(new Error('Only pending leave requests can be cancelled'), { status: 400 });
  }

  const updated = await prisma.leave.update({
    where: { id: leaveId },
    data: { status: 'CANCELLED' },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'leave.cancel',
    resource: 'leave',
    resourceId: leaveId,
    req,
  });

  return updated;
}

/**
 * Get leave quota for an employee/org/type/year.
 * Checks employee-specific first, then org default.
 */
async function getLeaveQuota(orgId, employeeId, leaveType, year) {
  const prisma = getPrisma();

  // Employee-specific quota
  let quota = await prisma.leaveQuota.findFirst({
    where: { orgId, employeeId, leaveType, year },
  });

  if (!quota) {
    // Org default (employeeId = null)
    quota = await prisma.leaveQuota.findFirst({
      where: { orgId, employeeId: null, leaveType, year },
    });
  }

  return quota;
}

/**
 * Get all leave records for an employee
 */
async function getEmployeeLeaves({ employeeId, orgId, year, status }) {
  const prisma = getPrisma();

  const where = { employeeId, orgId };
  if (status) where.status = status;
  if (year) {
    where.startDate = { gte: new Date(`${year}-01-01`) };
    where.endDate = { lte: new Date(`${year}-12-31`) };
  }

  return prisma.leave.findMany({
    where,
    include: {
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get pending leaves for an org (admin view)
 */
async function getPendingLeaves(orgId) {
  const prisma = getPrisma();

  return prisma.leave.findMany({
    where: { orgId, status: 'PENDING' },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function getAllLeaves({ orgId, status }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (status) where.status = status;

  return prisma.leave.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveQuota,
  getEmployeeLeaves,
  getPendingLeaves,
  getAllLeaves,
};
