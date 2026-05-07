// ─────────────────────────────────────────────────────────────────────────────
// Attendance Service — Check-in, check-out, shift-aware logic
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

/**
 * Get the current date/time in a given timezone.
 */
function getNowInTimezone(timezone = 'Asia/Kathmandu') {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
    seconds: get('second'),
    dateString: `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`,
    isoString: now.toISOString(),
  };
}

function getTodayDate(timezone = 'Asia/Kathmandu') {
  return getNowInTimezone(timezone).dateString;
}

/**
 * Determine if a check-in time is late based on shift config.
 */
function isLateCheckIn(checkInDate, shift, timezone = 'Asia/Kathmandu') {
  const [startH, startM] = (shift.startTime || '09:00').split(':').map(Number);
  const threshold = shift.lateThresholdMinutes || 30;

  const lateMinute = startM + threshold;
  const lateH = startH + Math.floor(lateMinute / 60);
  const lateM = lateMinute % 60;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(checkInDate);

  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');

  return h > lateH || (h === lateH && m > lateM);
}

/**
 * Get the effective shift for an employee.
 * Falls back to org default shift if no assignment.
 */
async function getEmployeeShift(employeeId, orgId) {
  const prisma = getPrisma();

  // Try current assignment
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isCurrent: true },
    include: { shift: true },
  });

  if (assignment?.shift) return assignment.shift;

  // Fallback: org default shift
  const defaultShift = await prisma.shift.findFirst({
    where: { orgId, isDefault: true, isActive: true },
  });

  return defaultShift || {
    startTime: '09:00',
    endTime: '18:00',
    lateThresholdMinutes: 30,
    halfDayHours: 4,
    fullDayHours: 8,
    minCheckoutMinutes: 2,
  };
}

/**
 * Get the effective timezone for an employee (branch timezone → org default).
 */
async function getEmployeeTimezone(employeeId) {
  const prisma = getPrisma();

  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isCurrent: true },
    include: { branch: { select: { timezone: true } } },
  });

  return assignment?.branch?.timezone || 'Asia/Kathmandu';
}

/**
 * Manual check-in
 */
async function checkIn({ employeeId, orgId, notes, latitude, longitude, req }) {
  const prisma = getPrisma();
  const shift = await getEmployeeShift(employeeId, orgId);
  const timezone = await getEmployeeTimezone(employeeId);
  const today = getTodayDate(timezone);
  const now = new Date();

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

  const status = isLateCheckIn(now, shift, timezone) ? 'LATE' : 'PRESENT';

  const attendance = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
    create: {
      orgId,
      employeeId,
      date: new Date(today),
      checkIn: now,
      status,
      source: 'MANUAL',
      notes: notes || null,
    },
    update: {
      checkIn: now,
      status,
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
    newData: { checkIn: now.toISOString(), status },
    req,
  });

  return attendance;
}

/**
 * Manual check-out
 */
async function checkOut({ employeeId, orgId, notes, req }) {
  const prisma = getPrisma();
  const shift = await getEmployeeShift(employeeId, orgId);
  const timezone = await getEmployeeTimezone(employeeId);
  const today = getTodayDate(timezone);
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

  // Calculate work hours
  const checkInTime = new Date(existing.checkIn);
  const workHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

  // Determine status
  let status = existing.status;
  const halfDayHours = Number(shift.halfDayHours) || 4;
  if (workHours < halfDayHours && status !== 'LATE') {
    status = 'HALF_DAY';
  }

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      workHours: Math.round(workHours * 100) / 100,
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
    newData: { checkOut: now.toISOString(), workHours, status },
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
  const today = getTodayDate(timezone);
  const now = new Date();

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: new Date(today) } },
  });

  let attendance;
  let eventType;

  if (!existing || !existing.checkIn) {
    // CHECK IN
    const status = isLateCheckIn(now, shift, timezone) ? 'LATE' : 'PRESENT';

    attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: new Date(today) } },
      create: {
        orgId,
        employeeId,
        branchId,
        date: new Date(today),
        checkIn: now,
        status,
        source: source || 'NFC',
        notes: `[${source || 'DEVICE'}] Check-in`,
      },
      update: {
        checkIn: now,
        status,
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

    const workHours = elapsed / (1000 * 60 * 60);
    let status = existing.status;
    const halfDayHours = Number(shift.halfDayHours) || 4;
    if (workHours < halfDayHours && status !== 'LATE') {
      status = 'HALF_DAY';
    }

    attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        workHours: Math.round(workHours * 100) / 100,
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
  const onLeave = todayRecords.filter((r) => r.status === 'ABSENT').length;
  const absent = totalActive - todayRecords.length;

  return { totalActive, present, late, halfDay, onLeave, absent, date: today };
}

/**
 * End-of-day attendance finalization for an org.
 * - Employees with no attendance record → ABSENT
 * - Checked in but not out (1st half) → default fullDayHours, auto-checkout
 * - Checked in but not out (2nd half) → HALF_DAY, halfDayHours, auto-checkout
 */
async function finalizeAttendance({ orgId, date }) {
  const prisma = getPrisma();
  const targetDate = date || getTodayDate();

  // Get all active employees for this org
  const activeEmployees = await prisma.employee.findMany({
    where: { orgId, isActive: true },
    select: { id: true },
  });

  // Get all attendance records for the date
  const existingRecords = await prisma.attendance.findMany({
    where: { orgId, date: new Date(targetDate) },
    select: { employeeId: true, id: true, checkIn: true, checkOut: true, status: true },
  });

  const recordMap = new Map(existingRecords.map((r) => [r.employeeId, r]));

  // Get org default shift for thresholds
  const defaultShift = await prisma.shift.findFirst({
    where: { orgId, isDefault: true, isActive: true },
  });

  const shiftStartTime = defaultShift?.startTime || '09:00';
  const fullDayHours = Number(defaultShift?.fullDayHours) || 8;
  const halfDayHours = Number(defaultShift?.halfDayHours) || 4;

  // Calculate the 2nd-half cutoff: shift start + half of full day hours
  const [startH, startM] = shiftStartTime.split(':').map(Number);
  const halfCutoffMinutes = (startH * 60 + startM) + (fullDayHours / 2) * 60;

  let absentCount = 0;
  let autoCheckoutFullCount = 0;
  let autoCheckoutHalfCount = 0;

  for (const emp of activeEmployees) {
    const record = recordMap.get(emp.id);

    if (!record) {
      // No record at all → mark ABSENT
      await prisma.attendance.create({
        data: {
          orgId,
          employeeId: emp.id,
          date: new Date(targetDate),
          status: 'ABSENT',
          source: 'SYSTEM',
          notes: 'Auto-marked absent (no check-in)',
        },
      });
      absentCount++;
    } else if (record.checkIn && !record.checkOut) {
      // Checked in but forgot to check out
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
        // Checked in at 2nd half → HALF_DAY, 4hr work, no auto-checkout
        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            workHours: halfDayHours,
            status: 'HALF_DAY',
            notes: `${record.notes || ''} [SYSTEM] Forgot checkout (2nd half, ${halfDayHours}hr credited)`.trim(),
          },
        });
        autoCheckoutHalfCount++;
      } else {
        // Checked in at 1st half → default full day hours, no auto-checkout
        await prisma.attendance.update({
          where: { id: record.id },
          data: {
            workHours: fullDayHours,
            status: record.status, // Keep PRESENT or LATE
            notes: `${record.notes || ''} [SYSTEM] Forgot checkout (${fullDayHours}hr credited)`.trim(),
          },
        });
        autoCheckoutFullCount++;
      }
    }
    // If checkIn and checkOut both exist → already finalized, skip
  }

  return { date: targetDate, absentCount, autoCheckoutFullCount, autoCheckoutHalfCount };
}

module.exports = {
  getNowInTimezone,
  getTodayDate,
  isLateCheckIn,
  getEmployeeShift,
  getEmployeeTimezone,
  checkIn,
  checkOut,
  deviceAttendance,
  getEmployeeAttendance,
  getOrgAttendanceSummary,
  finalizeAttendance,
};
