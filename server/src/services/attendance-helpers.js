// ─────────────────────────────────────────────────────────────────────────────
// Attendance Helpers — Pure utility functions for time/shift calculations
// Extracted from attendance.service.js for maintainability.
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

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
 * Get time in minutes from a Date in a timezone.
 */
function getTimeMinutes(date, timezone = 'Asia/Kathmandu') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');
  return h * 60 + m;
}

/**
 * Parse "HH:MM" string to minutes since midnight.
 */
function parseTimeToMinutes(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  return h * 60 + m;
}

/**
 * Determine if a check-in time is late based on shift config.
 * For FLEXIBLE shifts, there is no late penalty.
 */
function isLateCheckIn(checkInDate, shift, timezone = 'Asia/Kathmandu') {
  if (shift.shiftType === 'FLEXIBLE') return false;

  const startMinutes = parseTimeToMinutes(shift.startTime);
  const threshold = shift.lateThresholdMinutes || 30;
  const lateCutoff = startMinutes + threshold;

  const actualMinutes = getTimeMinutes(checkInDate, timezone);
  return actualMinutes > lateCutoff;
}

/**
 * Calculate late minutes (how many minutes after grace period).
 */
function calculateLateMinutes(checkInDate, shift, timezone = 'Asia/Kathmandu') {
  if (shift.shiftType === 'FLEXIBLE') return 0;

  const startMinutes = parseTimeToMinutes(shift.startTime);
  const threshold = shift.lateThresholdMinutes || 30;
  const lateCutoff = startMinutes + threshold;

  const actualMinutes = getTimeMinutes(checkInDate, timezone);
  return Math.max(0, actualMinutes - lateCutoff);
}

/**
 * Calculate early exit minutes (how many minutes before shift end).
 */
function calculateEarlyExitMinutes(checkOutDate, shift, timezone = 'Asia/Kathmandu') {
  if (shift.shiftType === 'FLEXIBLE') return 0;

  let endMinutes = parseTimeToMinutes(shift.endTime);
  const startMinutes = parseTimeToMinutes(shift.startTime);

  // Night shift: end time is conceptually next day
  if (shift.shiftType === 'NIGHT' || endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  let actualMinutes = getTimeMinutes(checkOutDate, timezone);
  // If night shift and checkout is in morning (before start), it's next day
  if ((shift.shiftType === 'NIGHT' || endMinutes > 24 * 60) && actualMinutes < startMinutes) {
    actualMinutes += 24 * 60;
  }

  return Math.max(0, endMinutes - actualMinutes);
}

/**
 * Check if a date's attendance is locked (payroll processed).
 */
async function isAttendanceLocked(orgId, date) {
  const prisma = getPrisma();
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const lockedPayslip = await prisma.payslip.findFirst({
    where: {
      orgId,
      year,
      month,
      status: { in: ['LOCKED', 'PAID'] },
    },
    select: { id: true },
  });

  return !!lockedPayslip;
}

/**
 * Get the effective shift for an employee.
 * Falls back to org default shift if no assignment.
 */
async function getEmployeeShift(employeeId, orgId) {
  const prisma = getPrisma();

  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isCurrent: true },
    include: { shift: true },
  });

  if (assignment?.shift) return assignment.shift;

  const defaultShift = await prisma.shift.findFirst({
    where: { orgId, isDefault: true, isActive: true },
  });

  return defaultShift || {
    startTime: '09:00',
    endTime: '18:00',
    shiftType: 'FIXED',
    breakMinutes: 0,
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
 * Determine the attendance date for night shifts.
 * If the shift is a night shift and we're past midnight, the attendance date
 * is the previous day (when the shift started).
 */
function getAttendanceDate(timezone, shift) {
  const now = getNowInTimezone(timezone);
  const today = now.dateString;

  if (shift.shiftType === 'NIGHT' || parseTimeToMinutes(shift.endTime) <= parseTimeToMinutes(shift.startTime)) {
    const currentMinutes = now.hours * 60 + now.minutes;
    const startMinutes = parseTimeToMinutes(shift.startTime);

    // If current time is before start (i.e. we're in the after-midnight portion), use yesterday
    if (currentMinutes < startMinutes) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().slice(0, 10);
    }
  }

  return today;
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
};
