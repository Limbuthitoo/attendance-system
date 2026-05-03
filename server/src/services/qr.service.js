// ─────────────────────────────────────────────────────────────────────────────
// QR Attendance Service — Time-limited QR code generation & verification
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');
const { getPrisma } = require('../lib/prisma');
const { cacheGet, cacheSet, cacheInvalidate } = require('../config/redis');
const { auditLog } = require('../lib/audit');

const QR_TOKEN_BYTES = 32;
const QR_DEFAULT_TTL_SECONDS = 30;
const QR_MAX_TTL_SECONDS = 120;

// ── Admin: Generate a location-bound QR code (displayed on a terminal/TV) ───

/**
 * Generate a rotating QR code for a specific branch/device.
 * This QR is displayed on a screen at the office — employees scan it with their phone.
 *
 * Flow: Admin device shows QR → Employee scans with phone → Server verifies → Attendance recorded.
 */
async function generateLocationQr({ orgId, branchId, deviceId, ttlSeconds }) {
  const ttl = Math.min(ttlSeconds || QR_DEFAULT_TTL_SECONDS, QR_MAX_TTL_SECONDS);
  const token = crypto.randomBytes(QR_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const qrData = {
    token,
    orgId,
    branchId,
    deviceId,
    expiresAt: expiresAt.toISOString(),
  };

  // Store in Redis with TTL (auto-expires)
  const cacheKey = `qr:location:${token}`;
  await cacheSet(cacheKey, qrData, ttl + 5); // +5s grace

  return {
    qrPayload: JSON.stringify({ t: token, o: orgId, b: branchId }),
    token,
    expiresAt,
    ttlSeconds: ttl,
  };
}

/**
 * Verify a location QR scanned by an employee.
 * Returns { valid, qrData } or { valid: false, error }.
 */
async function verifyLocationQr({ token, orgId }) {
  const cacheKey = `qr:location:${token}`;
  const qrData = await cacheGet(cacheKey);

  if (!qrData) {
    return { valid: false, error: 'QR code expired or invalid' };
  }

  if (qrData.orgId !== orgId) {
    return { valid: false, error: 'QR code belongs to a different organization' };
  }

  if (new Date(qrData.expiresAt) < new Date()) {
    await cacheInvalidate(cacheKey);
    return { valid: false, error: 'QR code has expired' };
  }

  return { valid: true, qrData };
}

// ── Employee: Generate a personal QR code (shown on their phone) ────────────

/**
 * Generate a time-limited personal QR code for an employee.
 * They show this to a QR_TERMINAL device at the office.
 *
 * Flow: Employee opens app → Gets personal QR → Shows to terminal → Terminal scans → Attendance.
 */
async function generateEmployeeQr({ employeeId, orgId }) {
  const ttl = QR_DEFAULT_TTL_SECONDS;
  const token = `qr_${crypto.randomBytes(QR_TOKEN_BYTES).toString('hex')}`;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const qrData = {
    token,
    employeeId,
    orgId,
    expiresAt: expiresAt.toISOString(),
  };

  const cacheKey = `qr:employee:${token}`;
  await cacheSet(cacheKey, qrData, ttl + 5);

  return {
    qrPayload: JSON.stringify({ t: token, e: employeeId }),
    token,
    expiresAt,
    ttlSeconds: ttl,
  };
}

/**
 * Verify an employee QR scanned by a terminal device.
 */
async function verifyEmployeeQr({ token, orgId }) {
  const cacheKey = `qr:employee:${token}`;
  const qrData = await cacheGet(cacheKey);

  if (!qrData) {
    return { valid: false, error: 'QR code expired or invalid' };
  }

  if (qrData.orgId !== orgId) {
    return { valid: false, error: 'QR code belongs to a different organization' };
  }

  if (new Date(qrData.expiresAt) < new Date()) {
    await cacheInvalidate(cacheKey);
    return { valid: false, error: 'QR code has expired' };
  }

  // Invalidate after use (single-use token)
  await cacheInvalidate(cacheKey);

  return { valid: true, qrData };
}

// ── Mobile self-check-in: Employee scans location QR with their phone ───────

/**
 * Process a mobile QR check-in.
 * Employee scans the location QR displayed at the office → attendance recorded.
 */
async function mobileQrCheckIn({ employeeId, orgId, qrToken, latitude, longitude }) {
  const verification = await verifyLocationQr({ token: qrToken, orgId });

  if (!verification.valid) {
    return { success: false, error: verification.error };
  }

  const { deviceAttendance } = require('./attendance.service');

  const result = await deviceAttendance({
    employeeId,
    orgId,
    branchId: verification.qrData.branchId,
    deviceId: verification.qrData.deviceId,
    credentialType: 'QR_CODE',
    credentialData: qrToken,
    source: 'QR_CODE',
  });

  // Log the mobile QR event with location metadata
  const prisma = getPrisma();
  if (result.attendance) {
    await prisma.deviceEvent.create({
      data: {
        orgId,
        branchId: verification.qrData.branchId,
        deviceId: verification.qrData.deviceId,
        credentialType: 'QR_CODE',
        credentialData: qrToken,
        employeeId,
        eventType: result.action === 'check_in' ? 'CHECK_IN' : result.action === 'check_out' ? 'CHECK_OUT' : 'UNKNOWN',
        result: 'mobile_qr_checkin',
        attendanceId: result.attendance.id,
        eventTime: new Date(),
        metadata: latitude && longitude ? { latitude, longitude, source: 'mobile_qr' } : { source: 'mobile_qr' },
      },
    });
  }

  return {
    success: result.action === 'check_in' || result.action === 'check_out',
    action: result.action,
    attendance: result.attendance,
  };
}

// ── Utility: List active QR sessions for a device ──────────────────────────

/**
 * Get device event stats for QR attendance today.
 */
async function getQrStats({ orgId, branchId }) {
  const prisma = getPrisma();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const events = await prisma.deviceEvent.count({
    where: {
      orgId,
      branchId: branchId || undefined,
      credentialType: 'QR_CODE',
      eventTime: { gte: todayStart },
      result: { not: 'unknown_credential' },
    },
  });

  return { todayQrEvents: events };
}

module.exports = {
  generateLocationQr,
  verifyLocationQr,
  generateEmployeeQr,
  verifyEmployeeQr,
  mobileQrCheckIn,
  getQrStats,
};
