// ─────────────────────────────────────────────────────────────────────────────
// Attendance Service — Check-in, check-out, shift-aware logic
// Nepal HR compliant: break deduction, early exit, night shift, flexible shift,
// attendance lock, late/early exit tracking
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const {
  getNowInTimezone,
  getTodayDate,
  getTimeMinutes,
  parseTimeToMinutes,
  isLateCheckIn,
  calculateLateMinutes,
  calculateEarlyExitMinutes,
  isAttendanceLocked,
  getEmployeeShift,
  getEmployeeTimezone,
  getAttendanceDate,
} = require('./attendance-helpers');

/**
 * Manual check-in
 */
async function checkIn({ employeeId, orgId, notes, latitude, longitude, req }) {
  const prisma = getPrisma();
  const shift = await getEmployeeShift(employeeId, orgId);
  const timezone = await getEmployeeTimezone(employeeId);
  const today = getAttendanceDate(timezone, shift);
  const now = new Date();

  // Attendance lock check
  if (await isAttendanceLocked(orgId, today)) {
    throw Object.assign(new Error('Attendance is locked for this period (payroll processed)'), { status: 403 });
  }

  // Geofence validation (if location provided)
  if (latitude && longitude) {
    try {
      const { validateLocation } = require('./geofence.service');
      const geoResult = await validateLocation({ orgId, employeeId, latitude, longitude });
      if (!geoResult.allowed) {
        throw Object.assign(new Error(geoResult.error || 'Outside geofence'), { status: 403 });
      }
    } catch (err) {
      if (err.status === 403) throw err;
      // Geofence module not configured — allow check-in
    }
  }

  // Check for existing attendance today
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
  });

  if (existing?.checkIn) {
    throw Object.assign(new Error('Already checked in today'), { status: 400 });
  }

  if (existing?.isLocked) {
    throw Object.assign(new Error('This attendance record is locked'), { status: 403 });
  }

  const late = isLateCheckIn(now, shift, timezone);
  const status = late ? 'LATE' : 'PRESENT';
  const lateMinutes = calculateLateMinutes(now, shift, timezone);

  const attendance = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
    create: {
      orgId,
      employeeId,
      date: new Date(today),
      checkIn: now,
      status,
      lateMinutes: lateMinutes || 0,
      source: 'MANUAL',
      notes: notes || null,
    },
    update: {
      checkIn: now,
      status,
      lateMinutes: lateMinutes || 0,
      source: 'MANUAL',
      notes: notes || null,
    },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'attendance.check_in',
    resource: 'attendance',
    resourceId: attendance.id,
    newData: { checkIn: now.toISOString(), status, lateMinutes },
    req,
  });

  return attendance;
}

/**
 * Manual check-out
 * Deducts break time, tracks early exit, determines final status.
 */
async function checkOut({ employeeId, orgId, notes, req }) {
  const prisma = getPrisma();
  const shift = await getEmployeeShift(employeeId, orgId);
  const timezone = await getEmployeeTimezone(employeeId);
  const today = getAttendanceDate(timezone, shift);
  const now = new Date();

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
  });

  if (!existing?.checkIn) {
    throw Object.assign(new Error('Must check in before checking out'), { status: 400 });
  }

  if (existing.checkOut) {
    throw Object.assign(new Error('Already checked out today'), { status: 400 });
  }

  if (existing.isLocked) {
    throw Object.assign(new Error('This attendance record is locked'), { status: 403 });
  }

  // Calculate raw work hours
  const checkInTime = new Date(existing.checkIn);
  const rawHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

  // Deduct break time
  const breakMinutes = shift.breakMinutes || 0;
  const breakHours = breakMinutes / 60;
  const workHours = Math.max(0, rawHours - breakHours);

  // Calculate early exit minutes
  const earlyExitMinutes = calculateEarlyExitMinutes(now, shift, timezone);

  // Determine status based on working hours
  // If status was MISSING_CHECKOUT (from finalization), reset to original check-in status
  let status = existing.status;
  if (status === 'MISSING_CHECKOUT') {
    // Restore to what it should have been at check-in time
    status = isLateCheckIn(new Date(existing.checkIn), shift, timezone) ? 'LATE' : 'PRESENT';
  }
  const halfDayHours = Number(shift.halfDayHours) || 4;
  const fullDayHours = Number(shift.fullDayHours) || 8;

  if (shift.shiftType === 'FLEXIBLE') {
    // Flexible shift: only hours matter, no fixed times
    if (workHours >= fullDayHours) {
      status = 'PRESENT';
    } else if (workHours >= halfDayHours) {
      status = 'HALF_DAY';
    } else {
      status = 'HALF_DAY';
    }
  } else {
    // Fixed/Night shift: determine status by hours worked
    if (workHours >= fullDayHours) {
      if (status !== 'LATE') status = 'PRESENT';
    } else if (workHours >= halfDayHours) {
      if (earlyExitMinutes > 0 && status !== 'LATE') {
        status = 'EARLY_EXIT';
      }
      // If LATE + early exit, keep LATE (more severe)
    } else {
      status = 'HALF_DAY';
    }
  }

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      workHours: Math.round(workHours * 100) / 100,
      breakMinutes,
      earlyExitMinutes: earlyExitMinutes || 0,
      status,
      notes: notes ? `${existing.notes || ''} ${notes}`.trim() : existing.notes,
    },
  });

  await auditLog({
    orgId,
    actorId: employeeId,
    action: 'attendance.check_out',
    resource: 'attendance',
    resourceId: attendance.id,
    newData: { checkOut: now.toISOString(), workHours, earlyExitMinutes, status },
    req,
  });

  // Auto-calculate overtime on checkout
  try {
    const { calculateOvertime } = require('./overtime.service');
    await calculateOvertime({ orgId, employeeId, attendanceDate: today, workHours });
  } catch { /* overtime module optional */ }

  return attendance;
}

/**
 * Device-triggered attendance (NFC, fingerprint, QR, etc.)
 * Unified handler — determines check-in vs check-out automatically.
 */
async function deviceAttendance({ employeeId, orgId, branchId, deviceId, credentialType, credentialData, source }) {
  const prisma = getPrisma();
  const shift = await getEmployeeShift(employeeId, orgId);
  const timezone = await getEmployeeTimezone(employeeId);
  const today = getAttendanceDate(timezone, shift);
  const now = new Date();

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
  });

  if (existing?.isLocked) {
    return { action: 'locked', attendance: existing };
  }

  let attendance;
  let eventType;

  if (!existing || !existing.checkIn) {
    // CHECK IN
    const late = isLateCheckIn(now, shift, timezone);
    const status = late ? 'LATE' : 'PRESENT';
    const lateMinutes = calculateLateMinutes(now, shift, timezone);

    attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: new Date(today) } },
      create: {
        orgId,
        employeeId,
        branchId,
        date: new Date(today),
        checkIn: now,
        status,
        lateMinutes: lateMinutes || 0,
        source: source || 'NFC',
        notes: `[${source || 'DEVICE'}] Check-in`,
      },
      update: {
        checkIn: now,
        status,
        lateMinutes: lateMinutes || 0,
        source: source || 'NFC',
        notes: `[${source || 'DEVICE'}] Check-in`,
      },
    });
    eventType = 'CHECK_IN';

  } else if (!existing.checkOut) {
    // CHECK OUT — enforce minimum checkout time
    const minCheckout = (shift.minCheckoutMinutes || 2) * 60 * 1000;
    const elapsed = now.getTime() - new Date(existing.checkIn).getTime();

    if (elapsed < minCheckout) {
      return { action: 'too_soon', attendance: existing };
    }

    const rawHours = elapsed / (1000 * 60 * 60);
    const breakMinutes = shift.breakMinutes || 0;
    const workHours = Math.max(0, rawHours - breakMinutes / 60);
    const earlyExitMinutes = calculateEarlyExitMinutes(now, shift, timezone);

    // Reset MISSING_CHECKOUT status (from finalization) to original check-in status
    let status = existing.status;
    if (status === 'MISSING_CHECKOUT') {
      status = isLateCheckIn(new Date(existing.checkIn), shift, timezone) ? 'LATE' : 'PRESENT';
    }
    const halfDayHours = Number(shift.halfDayHours) || 4;
    const fullDayHours = Number(shift.fullDayHours) || 8;

    if (shift.shiftType === 'FLEXIBLE') {
      if (workHours >= fullDayHours) {
        status = 'PRESENT';
      } else if (workHours >= halfDayHours) {
        status = 'HALF_DAY';
      } else {
        status = 'HALF_DAY';
      }
    } else {
      if (workHours >= fullDayHours) {
        if (status !== 'LATE') status = 'PRESENT';
      } else if (workHours >= halfDayHours) {
        if (earlyExitMinutes > 0 && status !== 'LATE') {
          status = 'EARLY_EXIT';
        }
      } else {
        status = 'HALF_DAY';
      }
    }

    attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        workHours: Math.round(workHours * 100) / 100,
        breakMinutes,
        earlyExitMinutes: earlyExitMinutes || 0,
        status,
        notes: `${existing.notes || ''} [${source || 'DEVICE'}] Check-out`.trim(),
      },
    });
    eventType = 'CHECK_OUT';

  } else {
    // Already checked in and out
    return { action: 'duplicate', attendance: existing };
  }

  // Log device event
  await prisma.deviceEvent.create({
    data: {
      orgId,
      branchId,
      deviceId,
      credentialType,
      credentialData,
      employeeId,
      eventType,
      result: 'success',
      attendanceId: attendance.id,
      eventTime: now,
    },
  });

  // Auto-calculate overtime on device checkout
  if (eventType === 'CHECK_OUT') {
    try {
      const { calculateOvertime } = require('./overtime.service');
      const workHrs = Number(attendance.workHours || 0);
      await calculateOvertime({ orgId, employeeId, attendanceDate: today, workHours: workHrs });
    } catch { /* overtime module optional */ }
  }

  return { action: eventType === 'CHECK_IN' ? 'check_in' : 'check_out', attendance };
}

/**
 * Get attendance records for an employee within a date range.
 */
async function getEmployeeAttendance({ employeeId, orgId, startDate, endDate }) {
  const prisma = getPrisma();

  return prisma.attendance.findMany({
    where: {
      orgId,
      employeeId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get today's attendance summary for an org (dashboard).
 */
async function getOrgAttendanceSummary(orgId) {
  const prisma = getPrisma();
  const today = getTodayDate();

  const [totalActive, todayRecords] = await Promise.all([
    prisma.employee.count({ where: { orgId, isActive: true } }),
    prisma.attendance.findMany({
      where: { orgId, date: new Date(today) },
      select: { status: true, checkOut: true },
    }),
  ]);

  const present = todayRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const late = todayRecords.filter((r) => r.status === 'LATE').length;
  const halfDay = todayRecords.filter((r) => r.status === 'HALF_DAY').length;
  const onLeave = todayRecords.filter((r) => r.status === 'ON_LEAVE' || (r.status === 'ABSENT' && r.checkOut === null)).length;
  const absent = todayRecords.filter((r) => r.status === 'ABSENT').length;
  const holiday = todayRecords.filter((r) => r.status === 'HOLIDAY').length;
  const weeklyOff = todayRecords.filter((r) => r.status === 'WEEKLY_OFF').length;
  const missingCheckout = todayRecords.filter((r) => r.status === 'MISSING_CHECKOUT').length;
  const earlyExit = todayRecords.filter((r) => r.status === 'EARLY_EXIT').length;
  const notMarked = totalActive - todayRecords.length;

  return { totalActive, present, late, halfDay, onLeave, absent, holiday, weeklyOff, missingCheckout, earlyExit, notMarked, date: today };
}

/**
 * End-of-day attendance finalization for an org.
 * Uses per-employee WorkSchedule for weekly offs and per-employee Shift for hour credits.
 * - No check-in + holiday → HOLIDAY
 * - No check-in + employee weekly off → WEEKLY_OFF
 * - No check-in + working day → ABSENT
 * - Check-in but no check-out (1st half) → MISSING_CHECKOUT, fullDayHours credited
 * - Check-in but no check-out (2nd half) → MISSING_CHECKOUT, halfDayHours credited
 */
async function finalizeAttendance({ orgId, date }) {
  const prisma = getPrisma();
  const targetDate = date || getTodayDate();
  const targetDateObj = new Date(targetDate);
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayName = dayNames[targetDateObj.getDay()];

  // Get all active employees with their current assignments (shift + workSchedule)
  const activeEmployees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: {
      id: true,
      gender: true,
      assignments: {
        where: { isCurrent: true },
        select: {
          shift: { select: { startTime: true, fullDayHours: true, halfDayHours: true } },
          workSchedule: { select: { workingDays: true } },
        },
        take: 1,
      },
    },
  });

  // Get all attendance records for the date
  const existingRecords = await prisma.attendance.findMany({
    where: { orgId, date: targetDateObj },
    select: { employeeId: true, id: true, checkIn: true, checkOut: true, status: true, notes: true },
  });

  const recordMap = new Map(existingRecords.map((r) => [r.employeeId, r]));

  // Check if this date is a public holiday
  const holidays = await prisma.holiday.findMany({
    where: {
      orgId,
      adDate: { lte: targetDateObj },
      OR: [
        { adDateEnd: { gte: targetDateObj } },
        { adDateEnd: null, adDate: targetDateObj },
      ],
    },
    select: { womenOnly: true },
  });
  const isHolidayForAll = holidays.some((h) => !h.womenOnly);
  const isHolidayForWomen = holidays.some((h) => h.womenOnly);

  // Org-level fallbacks
  const settingsService = require('./settings.service');
  const settings = await settingsService.getOrgSettings(orgId);
  const orgWorkingDays = (settings.working_days || 'mon,tue,wed,thu,fri').split(',').map((d) => d.trim().toLowerCase());

  const defaultShift = await prisma.shift.findFirst({
    where: { orgId, isDefault: true, isActive: true },
  });

  let absentCount = 0;
  let holidayCount = 0;
  let weeklyOffCount = 0;
  let missingCheckoutFullCount = 0;
  let missingCheckoutHalfCount = 0;

  for (const emp of activeEmployees) {
    const record = recordMap.get(emp.id);

    // Get employee-specific schedule and shift (fall back to org defaults)
    const assignment = emp.assignments[0];
    const empWorkingDays = assignment?.workSchedule?.workingDays;
    // workingDays from DB is JSON (array), org fallback is already an array
    const workingDaysArr = Array.isArray(empWorkingDays)
      ? empWorkingDays.map((d) => d.toLowerCase())
      : orgWorkingDays;

    const empShift = assignment?.shift || defaultShift;
    const shiftStartTime = empShift?.startTime || '09:00';
    const fullDayHours = Number(empShift?.fullDayHours) || 8;
    const halfDayHours = Number(empShift?.halfDayHours) || 4;

    // Per-employee weekly off check
    const isEmpWeeklyOff = !workingDaysArr.includes(dayName);

    if (!record) {
      // No record — determine why
      const isEmpHoliday = isHolidayForAll || (isHolidayForWomen && emp.gender === 'female');

      if (isEmpHoliday) {
        await prisma.attendance.create({
          data: { orgId, employeeId: emp.id, date: targetDateObj, status: 'HOLIDAY', source: 'SYSTEM', notes: 'Public holiday' },
        });
        holidayCount++;
      } else if (isEmpWeeklyOff) {
        await prisma.attendance.create({
          data: { orgId, employeeId: emp.id, date: targetDateObj, status: 'WEEKLY_OFF', source: 'SYSTEM', notes: 'Weekly off' },
        });
        weeklyOffCount++;
      } else {
        await prisma.attendance.create({
          data: { orgId, employeeId: emp.id, date: targetDateObj, status: 'ABSENT', source: 'SYSTEM', notes: 'Auto-marked absent (no check-in)' },
        });
        absentCount++;
      }
    } else if (record.checkIn && !record.checkOut) {
      // Checked in but forgot to check out — use employee's shift for cutoff
      const [startH, startM] = shiftStartTime.split(':').map(Number);
      const halfCutoffMinutes = (startH * 60 + startM) + (fullDayHours / 2) * 60;

      const checkInTime = new Date(record.checkIn);
      const checkInParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        hour: '2-digit', minute: '2-digit',
        hour12: false,
      }).formatToParts(checkInTime);

      const checkInH = parseInt(checkInParts.find((p) => p.type === 'hour')?.value || '0');
      const checkInM = parseInt(checkInParts.find((p) => p.type === 'minute')?.value || '0');
      const checkInMinutes = checkInH * 60 + checkInM;

      if (checkInMinutes >= halfCutoffMinutes) {
        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            workHours: halfDayHours,
            status: 'MISSING_CHECKOUT',
            notes: `${record.notes || ''} [SYSTEM] Missing checkout (2nd half, ${halfDayHours}hr credited)`.trim(),
          },
        });
        missingCheckoutHalfCount++;
      } else {
        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            workHours: fullDayHours,
            status: 'MISSING_CHECKOUT',
            notes: `${record.notes || ''} [SYSTEM] Missing checkout (${fullDayHours}hr credited)`.trim(),
          },
        });
        missingCheckoutFullCount++;
      }
    }
    // If checkIn and checkOut both exist → already finalized, skip
  }

  return {
    date: targetDate,
    absentCount,
    holidayCount,
    weeklyOffCount,
    missingCheckoutFullCount,
    missingCheckoutHalfCount,
  };
}

module.exports = {
  getNowInTimezone,
  getTodayDate,
  getTimeMinutes,
  parseTimeToMinutes,
  isLateCheckIn,
  calculateLateMinutes,
  calculateEarlyExitMinutes,
  isAttendanceLocked,
  getEmployeeShift,
  getEmployeeTimezone,
  getAttendanceDate,
  checkIn,
  checkOut,
  deviceAttendance,
  getEmployeeAttendance,
  getOrgAttendanceSummary,
  finalizeAttendance,
};
