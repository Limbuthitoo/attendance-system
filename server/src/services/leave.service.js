// ─────────────────────────────────────────────────────────────────────────────
// Leave Service — Nepal HR Leave Logic
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { enqueuePush, enqueuePushToAdmins } = require('../config/queue');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — day calculation, holiday/weekend exclusion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get working days for an org (e.g., ['mon','tue','wed','thu','fri'])
 */
async function getWorkingDays(orgId) {
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);
  const raw = settings.working_days || 'mon,tue,wed,thu,fri';
  return raw.split(',').map(d => d.trim().toLowerCase());
}

/**
 * Get public holidays for an org between two dates.
 * Returns Set of date strings (YYYY-MM-DD).
 */
async function getHolidaysBetween(orgId, startDate, endDate) {
  const prisma = getPrisma();
  const holidays = await prisma.holiday.findMany({
    where: {
      orgId,
      adDate: { gte: startDate, lte: endDate },
    },
    select: { adDate: true, adDateEnd: true },
  });

  const set = new Set();
  for (const h of holidays) {
    if (!h.adDate) continue;
    const start = new Date(h.adDate);
    const end = h.adDateEnd ? new Date(h.adDateEnd) : start;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
  }
  return set;
}

/**
 * Check if a date is a weekend (non-working day)
 */
function isWeekend(date, workingDays) {
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[date.getDay()];
  return !workingDays.includes(dayName);
}

/**
 * Calculate actual leave days excluding weekends and public holidays.
 * Implements Rule 6 & 7 — public holiday & weekend exclusion.
 */
async function calculateLeaveDays({ orgId, startDate, endDate, isHalfDay }) {
  if (isHalfDay) return 0.5;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const workingDays = await getWorkingDays(orgId);
  const holidays = await getHolidaysBetween(orgId, start, end);

  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    if (isWeekend(d, workingDays)) continue;
    if (holidays.has(dateStr)) continue;
    count++;
  }
  return count;
}

/**
 * Calculate leave days WITH sandwich policy.
 * Rule 18: If leave before & after a holiday/weekend, those are counted too.
 */
async function calculateLeaveDaysWithSandwich({ orgId, startDate, endDate, isHalfDay }) {
  if (isHalfDay) return 0.5;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Simply count calendar days (inclusive) — sandwich means all days count
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY LEAVE
// ─────────────────────────────────────────────────────────────────────────────

async function applyLeave({ employeeId, orgId, leaveType, startDate, endDate, reason, isHalfDay, req }) {
  const prisma = getPrisma();
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw Object.assign(new Error('End date must be after start date'), { status: 400 });
  }

  // Half-day: start & end must be same day
  if (isHalfDay && start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10)) {
    throw Object.assign(new Error('Half-day leave must be on a single day'), { status: 400 });
  }

  // Rule 10: Overlapping leave check
  const overlap = await prisma.leave.findFirst({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
    },
  });
  if (overlap) {
    throw Object.assign(new Error('Leave dates overlap with an existing leave request'), { status: 409 });
  }

  // Get employee details for validation
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, employeeCode: true, gender: true, employmentStatus: true, joinDate: true },
  });

  // Rule 11: Probation restriction
  if (settings.leave_probation_restrict === 'true' && employee.employmentStatus === 'probation') {
    if (leaveType === 'EARNED') {
      throw Object.assign(new Error('Annual/earned leave is restricted during probation period'), { status: 400 });
    }
  }

  // Rule 4: Maternity validation — female only, max 98 days
  if (leaveType === 'MATERNITY') {
    if (employee.gender !== 'female') {
      throw Object.assign(new Error('Maternity leave is only available for female employees'), { status: 400 });
    }
  }

  // Rule 5: Paternity validation — male only, max 15 days
  if (leaveType === 'PATERNITY') {
    if (employee.gender !== 'male') {
      throw Object.assign(new Error('Paternity leave is only available for male employees'), { status: 400 });
    }
  }

  // Calculate actual leave days (excluding weekends & holidays)
  const sandwichEnabled = settings.leave_sandwich_policy === 'true';
  let days;
  if (leaveType === 'MATERNITY' || leaveType === 'PATERNITY') {
    // Maternity/Paternity: count calendar days (inclusive)
    days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  } else if (sandwichEnabled) {
    days = await calculateLeaveDaysWithSandwich({ orgId, startDate: start, endDate: end, isHalfDay });
  } else {
    days = await calculateLeaveDays({ orgId, startDate: start, endDate: end, isHalfDay });
  }

  if (days <= 0) {
    throw Object.assign(new Error('No working days in the selected date range'), { status: 400 });
  }

  // Rule 9: Leave balance validation (skip for UNPAID/OTHER)
  if (!['UNPAID', 'OTHER'].includes(leaveType)) {
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
          new Error(`Insufficient ${leaveType} leave balance. Used: ${usedDays}, Remaining: ${(quota.totalDays - usedDays).toFixed(1)}, Requested: ${days}`),
          { status: 400 }
        );
      }
    }

    // Maternity: cap at configured days
    if (leaveType === 'MATERNITY') {
      const maxDays = parseInt(settings.leave_maternity_days || '98');
      if (days > maxDays) {
        throw Object.assign(new Error(`Maternity leave cannot exceed ${maxDays} days`), { status: 400 });
      }
    }

    // Paternity: cap at configured days
    if (leaveType === 'PATERNITY') {
      const maxDays = parseInt(settings.leave_paternity_days || '15');
      if (days > maxDays) {
        throw Object.assign(new Error(`Paternity leave cannot exceed ${maxDays} days`), { status: 400 });
      }
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
      isHalfDay: isHalfDay || false,
      reason,
    },
  });

  // Notify admins
  await enqueuePushToAdmins({
    orgId,
    title: 'New Leave Application',
    body: `${employee.name} (${employee.employeeCode}) applied for ${days} day(s) ${leaveType.toLowerCase()} leave${isHalfDay ? ' (half-day)' : ''}`,
    data: { type: 'leave', leaveId: leave.id },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'leave.apply',
    resource: 'leave',
    resourceId: leave.id,
    newData: { leaveType, startDate, endDate, days, isHalfDay, reason },
    req,
  });

  return leave;
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW LEAVE
// ─────────────────────────────────────────────────────────────────────────────

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

  // If approved, mark attendance as on leave
  if (status === 'APPROVED') {
    const workingDays = await getWorkingDays(orgId);
    const holidays = await getHolidaysBetween(orgId, leave.startDate, leave.endDate);
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      // Skip weekends and holidays for attendance marking
      if (isWeekend(d, workingDays) || holidays.has(dateStr)) continue;

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
          notes: `On ${leave.leaveType.toLowerCase()} leave${leave.isHalfDay ? ' (half-day)' : ''}`,
        },
        update: {
          status: 'ABSENT',
          source: 'SYSTEM',
          notes: `On ${leave.leaveType.toLowerCase()} leave${leave.isHalfDay ? ' (half-day)' : ''}`,
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

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL LEAVE
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA & BALANCE
// ─────────────────────────────────────────────────────────────────────────────

async function getLeaveQuota(orgId, employeeId, leaveType, year) {
  const prisma = getPrisma();

  let quota = await prisma.leaveQuota.findFirst({
    where: { orgId, employeeId, leaveType, year },
  });

  if (!quota) {
    quota = await prisma.leaveQuota.findFirst({
      where: { orgId, employeeId: null, leaveType, year },
    });
  }

  return quota;
}

/**
 * Get leave balances for an employee — Nepal HR rules.
 * - SICK: 12 days/year (prorated by months worked)
 * - CASUAL: 12 days/year (fixed)
 * - EARNED: 1 day per 20 working days
 * - MATERNITY: 98 days (60 paid) — if female
 * - PATERNITY: 15 days — if male
 */
async function getLeaveBalances({ employeeId, orgId, year }) {
  const prisma = getPrisma();
  const settingsService = require('./settings.service');
  const currentYear = year || new Date().getFullYear();
  const settings = await settingsService.getOrgSettings(orgId);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { gender: true, joinDate: true, employmentStatus: true },
  });

  const sickPerYear = parseInt(settings.leave_sick_days_per_year || '12');
  const casualPerYear = parseInt(settings.leave_casual_days_per_year || '12');
  const maternityDays = parseInt(settings.leave_maternity_days || '98');
  const paternityDays = parseInt(settings.leave_paternity_days || '15');
  const workingDaysPerEarned = parseInt(settings.leave_working_days_per_earned || '20');

  // Calculate months worked this year (for proration)
  let monthsWorked = 12;
  if (employee?.joinDate) {
    const joinDate = new Date(employee.joinDate);
    if (joinDate.getFullYear() === currentYear) {
      monthsWorked = 12 - joinDate.getMonth(); // months remaining in join year
    }
  }

  // Get employee-specific quotas (overrides)
  const employeeQuotas = await prisma.leaveQuota.findMany({
    where: { orgId, employeeId, year: currentYear },
  });
  const quotaMap = {};
  for (const q of employeeQuotas) {
    quotaMap[q.leaveType] = q.totalDays;
  }

  // Calculate earned leave based on actual working days attendance
  let earnedDays = 0;
  if (settings.leave_accrual_enabled === 'true') {
    if (quotaMap.EARNED !== undefined) {
      earnedDays = quotaMap.EARNED;
    } else {
      // Rule 1: 1 day per 20 working days attended
      const attendedDays = await prisma.attendance.count({
        where: {
          employeeId,
          orgId,
          status: { in: ['PRESENT', 'LATE'] },
          date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`),
          },
        },
      });
      earnedDays = Math.floor(attendedDays / workingDaysPerEarned);
    }
  }

  // Build balances
  const leaveTypes = [
    { type: 'SICK', totalDays: quotaMap.SICK ?? Math.round((monthsWorked / 12) * sickPerYear) },
    { type: 'CASUAL', totalDays: quotaMap.CASUAL ?? casualPerYear },
    { type: 'EARNED', totalDays: earnedDays },
  ];

  // Maternity — only for female employees
  if (employee?.gender === 'female') {
    leaveTypes.push({ type: 'MATERNITY', totalDays: quotaMap.MATERNITY ?? maternityDays });
  }

  // Paternity — only for male employees
  if (employee?.gender === 'male') {
    leaveTypes.push({ type: 'PATERNITY', totalDays: quotaMap.PATERNITY ?? paternityDays });
  }

  // Always show UNPAID
  leaveTypes.push({ type: 'UNPAID', totalDays: 0 });

  const balances = [];
  for (const { type, totalDays } of leaveTypes) {
    const used = await prisma.leave.aggregate({
      where: {
        employeeId,
        leaveType: type,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { gte: new Date(`${currentYear}-01-01`) },
        endDate: { lte: new Date(`${currentYear}-12-31`) },
      },
      _sum: { days: true },
    });

    const usedDays = used._sum.days || 0;
    const remaining = Math.max(0, totalDays - usedDays);

    balances.push({
      leaveType: type,
      totalDays,
      usedDays,
      remainingDays: remaining,
    });
  }

  return balances;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ACCRUAL — Nepal Rule: 1 day per 20 working days
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate earned leave for all employees based on attendance.
 * Called by scheduler on 1st of each month (or can be triggered manually).
 */
async function accrueEarnedLeave({ orgId, year }) {
  const prisma = getPrisma();
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);

  if (settings.leave_accrual_enabled !== 'true') return { accrued: 0 };

  const workingDaysPerEarned = parseInt(settings.leave_working_days_per_earned || '20');
  const maxAccumulation = parseFloat(settings.leave_max_accumulation || '90');

  const employees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true },
  });

  let accrued = 0;

  for (const emp of employees) {
    // Count actual working days attended this year
    const attendedDays = await prisma.attendance.count({
      where: {
        employeeId: emp.id,
        orgId,
        status: { in: ['PRESENT', 'LATE'] },
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
    });

    const earnedDays = Math.min(Math.floor(attendedDays / workingDaysPerEarned), maxAccumulation);

    // Upsert the earned leave quota
    await prisma.leaveQuota.upsert({
      where: {
        orgId_employeeId_leaveType_year: {
          orgId,
          employeeId: emp.id,
          leaveType: 'EARNED',
          year,
        },
      },
      create: {
        orgId,
        employeeId: emp.id,
        leaveType: 'EARNED',
        year,
        totalDays: earnedDays,
        usedDays: 0,
      },
      update: {
        totalDays: earnedDays,
      },
    });

    accrued++;
  }

  return { accrued, workingDaysPerEarned, year };
}

// ─────────────────────────────────────────────────────────────────────────────
// CARRY OVER — Rule 13
// ─────────────────────────────────────────────────────────────────────────────

async function carryOverLeave({ orgId, fromYear }) {
  const prisma = getPrisma();
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);

  if (settings.leave_carryover_enabled !== 'true') return { carried: 0 };

  const maxCarryover = parseFloat(settings.leave_carryover_max_days || '45');
  const toYear = fromYear + 1;

  // Carry over EARNED leave only
  const quotas = await prisma.leaveQuota.findMany({
    where: { orgId, leaveType: 'EARNED', year: fromYear, employeeId: { not: null } },
  });

  let carried = 0;

  for (const quota of quotas) {
    const used = await prisma.leave.aggregate({
      where: {
        employeeId: quota.employeeId,
        leaveType: 'EARNED',
        status: 'APPROVED',
        startDate: { gte: new Date(`${fromYear}-01-01`) },
        endDate: { lte: new Date(`${fromYear}-12-31`) },
      },
      _sum: { days: true },
    });

    const usedDays = used._sum.days || 0;
    const unused = Math.max(0, quota.totalDays - usedDays);
    const carryDays = Math.min(unused, maxCarryover);

    if (carryDays > 0) {
      await prisma.leaveQuota.upsert({
        where: {
          orgId_employeeId_leaveType_year: {
            orgId,
            employeeId: quota.employeeId,
            leaveType: 'EARNED',
            year: toYear,
          },
        },
        create: {
          orgId,
          employeeId: quota.employeeId,
          leaveType: 'EARNED',
          year: toYear,
          totalDays: carryDays,
          usedDays: 0,
        },
        update: {
          totalDays: { increment: carryDays },
        },
      });
      carried++;
    }
  }

  return { carried, fromYear, toYear, maxCarryover };
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

async function getLeavePolicySettings(orgId) {
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);

  return {
    accrualEnabled: settings.leave_accrual_enabled === 'true',
    accrualType: 'EARNED',
    workingDaysPerEarned: parseInt(settings.leave_working_days_per_earned || '20'),
    sickDaysPerYear: parseInt(settings.leave_sick_days_per_year || '12'),
    casualDaysPerYear: parseInt(settings.leave_casual_days_per_year || '12'),
    maternityDays: parseInt(settings.leave_maternity_days || '98'),
    maternityPaidDays: parseInt(settings.leave_maternity_paid_days || '60'),
    paternityDays: parseInt(settings.leave_paternity_days || '15'),
    maxAccumulation: parseFloat(settings.leave_max_accumulation || '90'),
    carryoverEnabled: settings.leave_carryover_enabled === 'true',
    carryoverMaxDays: parseFloat(settings.leave_carryover_max_days || '45'),
    sandwichPolicy: settings.leave_sandwich_policy === 'true',
    halfDayEnabled: settings.leave_half_day_enabled === 'true',
    probationRestrict: settings.leave_probation_restrict === 'true',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveQuota,
  getLeaveBalances,
  getEmployeeLeaves,
  getPendingLeaves,
  getAllLeaves,
  accrueEarnedLeave,
  carryOverLeave,
  getLeavePolicySettings,
  calculateLeaveDays,
};
