// ─────────────────────────────────────────────────────────────────────────────
// Device Service — Unified device management (NFC, Fingerprint, QR, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { cacheInvalidate } = require('../config/redis');

/**
 * Register a new device
 * Returns the plaintext API key (shown once, then only hash stored).
 */
async function registerDevice({ orgId, branchId, deviceType, deviceSerial, name, location, adminId, req }) {
  const prisma = getPrisma();

  // Block if org subscription is not active
  const { requireActiveSubscription } = require('../lib/subscription');
  await requireActiveSubscription(orgId);

  // Check org device limit
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxDevices: true },
  });
  const currentCount = await prisma.device.count({ where: { orgId } });
  if (currentCount >= org.maxDevices) {
    throw Object.assign(new Error(`Device limit reached (${org.maxDevices}). Upgrade your plan.`), { status: 403 });
  }

  // Generate a unique API key for this device
  const apiKey = `dev_${crypto.randomBytes(32).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(apiKey, 12);

  const device = await prisma.device.create({
    data: {
      orgId,
      branchId: branchId || null,
      deviceType,
      deviceSerial,
      name: name || null,
      location: location || null,
      apiKeyHash,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'device.register',
    resource: 'device',
    resourceId: device.id,
    newData: { deviceType, deviceSerial, name, location },
    req,
  });

  return {
    device,
    apiKey, // Return plaintext key ONCE for the admin to save
  };
}

/**
 * Deactivate a device
 */
async function deactivateDevice({ deviceId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const device = await prisma.device.update({
    where: { id: deviceId },
    data: { isActive: false },
  });

  // Invalidate device auth cache
  await cacheInvalidate(`device:auth:${device.deviceSerial}`);

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'device.deactivate',
    resource: 'device',
    resourceId: deviceId,
    req,
  });

  return device;
}

/**
 * Rotate a device's API key
 */
async function rotateDeviceKey({ deviceId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const device = await prisma.device.findFirst({
    where: { id: deviceId, orgId },
  });
  if (!device) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const newApiKey = `dev_${crypto.randomBytes(32).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(newApiKey, 12);

  await prisma.device.update({
    where: { id: deviceId },
    data: { apiKeyHash },
  });

  await cacheInvalidate(`device:auth:${device.deviceSerial}`);

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'device.rotate_key',
    resource: 'device',
    resourceId: deviceId,
    req,
  });

  return { apiKey: newApiKey };
}

/**
 * Record device heartbeat
 */
async function recordHeartbeat(deviceId) {
  const prisma = getPrisma();
  await prisma.device.update({
    where: { id: deviceId },
    data: { lastHeartbeatAt: new Date() },
  });
}

/**
 * List devices for an org
 */
async function listDevices({ orgId, branchId, deviceType }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (branchId) where.branchId = branchId;
  if (deviceType) where.deviceType = deviceType;

  return prisma.device.findMany({
    where,
    select: {
      id: true,
      deviceType: true,
      deviceSerial: true,
      name: true,
      location: true,
      firmwareVersion: true,
      lastHeartbeatAt: true,
      isActive: true,
      createdAt: true,
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Handle device event (unified tap/scan from any device type).
 * This is the main entry point when a device reports a credential scan.
 */
async function handleDeviceEvent({ deviceId, orgId, branchId, credentialType, credentialData }) {
  const prisma = getPrisma();

  // Look up the credential
  const credential = await prisma.employeeCredential.findFirst({
    where: {
      credentialType,
      credentialData,
      isActive: true,
    },
    include: {
      employee: {
        select: { id: true, orgId: true, name: true, isActive: true },
      },
    },
  });

  if (!credential) {
    // Log unknown credential
    await prisma.deviceEvent.create({
      data: {
        orgId,
        branchId,
        deviceId,
        credentialType,
        credentialData,
        eventType: 'UNKNOWN',
        result: 'unknown_credential',
        eventTime: new Date(),
      },
    });
    return { success: false, error: 'Unknown credential', action: 'unknown' };
  }

  if (!credential.employee.isActive) {
    await prisma.deviceEvent.create({
      data: {
        orgId,
        branchId,
        deviceId,
        credentialType,
        credentialData,
        employeeId: credential.employee.id,
        eventType: 'REJECTED',
        result: 'inactive_employee',
        eventTime: new Date(),
      },
    });
    return { success: false, error: 'Employee is inactive', action: 'rejected' };
  }

  if (credential.employee.orgId !== orgId) {
    await prisma.deviceEvent.create({
      data: {
        orgId,
        branchId,
        deviceId,
        credentialType,
        credentialData,
        eventType: 'REJECTED',
        result: 'wrong_organization',
        eventTime: new Date(),
      },
    });
    return { success: false, error: 'Employee belongs to a different organization', action: 'rejected' };
  }

  // Map credential type to attendance source
  const sourceMap = {
    NFC_CARD: 'NFC',
    FINGERPRINT: 'FINGERPRINT',
    QR_CODE: 'QR_CODE',
    FACE_ID: 'FACE_ID',
    PIN: 'MANUAL',
  };

  const { deviceAttendance } = require('./attendance.service');
  const result = await deviceAttendance({
    employeeId: credential.employee.id,
    orgId,
    branchId,
    deviceId,
    credentialType,
    credentialData,
    source: sourceMap[credentialType] || 'MANUAL',
  });

  return {
    success: true,
    action: result.action,
    employee: { id: credential.employee.id, name: credential.employee.name },
    attendance: result.attendance,
  };
}

/**
 * Assign a credential to an employee
 */
async function assignCredential({ orgId, employeeId, credentialType, credentialData, label, adminId, req }) {
  const prisma = getPrisma();

  const credential = await prisma.employeeCredential.create({
    data: {
      orgId,
      employeeId,
      credentialType,
      credentialData,
      label: label || null,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'credential.assign',
    resource: 'employee_credential',
    resourceId: credential.id,
    newData: { credentialType, employeeId, label },
    req,
  });

  return credential;
}

/**
 * Deactivate a credential
 */
async function deactivateCredential({ credentialId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const credential = await prisma.employeeCredential.update({
    where: { id: credentialId },
    data: { isActive: false, deactivatedAt: new Date() },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'credential.deactivate',
    resource: 'employee_credential',
    resourceId: credentialId,
    req,
  });

  return credential;
}

/**
 * List credentials for an org, optionally filtered by employee or type
 */
async function listCredentials({ orgId, employeeId, credentialType }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (employeeId) where.employeeId = employeeId;
  if (credentialType) where.credentialType = credentialType;

  return prisma.employeeCredential.findMany({
    where,
    select: {
      id: true,
      credentialType: true,
      credentialData: true,
      label: true,
      isActive: true,
      assignedAt: true,
      deactivatedAt: true,
      employee: { select: { id: true, name: true, employeeId: true } },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get single device details
 */
async function getDevice({ deviceId, orgId }) {
  const prisma = getPrisma();

  const device = await prisma.device.findFirst({
    where: { id: deviceId, orgId },
    select: {
      id: true,
      deviceType: true,
      deviceSerial: true,
      name: true,
      location: true,
      firmwareVersion: true,
      lastHeartbeatAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { id: true, name: true, code: true } },
      _count: { select: { deviceEvents: true } },
    },
  });

  if (!device) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  return device;
}

/**
 * Update device info (name, location, branch assignment)
 */
async function updateDevice({ deviceId, orgId, name, location, branchId, adminId, req }) {
  const prisma = getPrisma();

  const device = await prisma.device.findFirst({ where: { id: deviceId, orgId } });
  if (!device) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (location !== undefined) data.location = location;
  if (branchId !== undefined) data.branchId = branchId || null;

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data,
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'device.update',
    resource: 'device',
    resourceId: deviceId,
    oldData: { name: device.name, location: device.location, branchId: device.branchId },
    newData: data,
    req,
  });

  return updated;
}

/**
 * Reactivate a deactivated device
 */
async function reactivateDevice({ deviceId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const device = await prisma.device.findFirst({ where: { id: deviceId, orgId } });
  if (!device) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  if (device.isActive) {
    throw Object.assign(new Error('Device is already active'), { status: 400 });
  }

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: { isActive: true },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'device.reactivate',
    resource: 'device',
    resourceId: deviceId,
    req,
  });

  return updated;
}

/**
 * List device events with pagination and filters
 */
async function listDeviceEvents({ orgId, deviceId, employeeId, eventType, startDate, endDate, page = 1, limit = 50 }) {
  const prisma = getPrisma();

  const where = { orgId };
  if (deviceId) where.deviceId = deviceId;
  if (employeeId) where.employeeId = employeeId;
  if (eventType) where.eventType = eventType;
  if (startDate || endDate) {
    where.eventTime = {};
    if (startDate) where.eventTime.gte = new Date(startDate);
    if (endDate) where.eventTime.lte = new Date(endDate);
  }

  const [events, total] = await Promise.all([
    prisma.deviceEvent.findMany({
      where,
      select: {
        id: true,
        credentialType: true,
        eventType: true,
        result: true,
        eventTime: true,
        metadata: true,
        device: { select: { id: true, name: true, deviceType: true, deviceSerial: true, location: true } },
        employee: { select: { id: true, name: true, employeeId: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { eventTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.deviceEvent.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  registerDevice,
  deactivateDevice,
  rotateDeviceKey,
  recordHeartbeat,
  listDevices,
  handleDeviceEvent,
  assignCredential,
  deactivateCredential,
  listCredentials,
  getDevice,
  updateDevice,
  reactivateDevice,
  listDeviceEvents,
};
