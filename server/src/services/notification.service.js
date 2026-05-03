// ─────────────────────────────────────────────────────────────────────────────
// Notification Service — Push notifications, in-app notifications
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications to specific employee IDs (called from worker).
 */
async function sendPushToEmployees(employeeIds, { title, body, data = {} }) {
  if (!employeeIds || employeeIds.length === 0) return;

  const prisma = getPrisma();

  const tokens = await prisma.pushToken.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { token: true },
    distinct: ['token'],
  });

  if (tokens.length === 0) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  // Expo accepts batches of up to 100
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await res.json();
      if (result.data) {
        for (let j = 0; j < result.data.length; j++) {
          const receipt = result.data[j];
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            await prisma.pushToken.deleteMany({ where: { token: chunk[j].to } });
          }
        }
      }
    } catch (err) {
      console.error('Push notification failed:', err.message);
    }
  }
}

/**
 * Send push to all admins (org_admin role) of an organization.
 */
async function sendPushToAdmins(orgId, { title, body, data = {} }) {
  const prisma = getPrisma();

  const admins = await prisma.employeeRole.findMany({
    where: {
      role: { name: 'org_admin' },
      employee: { orgId, isActive: true },
    },
    select: { employeeId: true },
  });

  const ids = admins.map((a) => a.employeeId);
  return sendPushToEmployees(ids, { title, body, data });
}

/**
 * Create an in-app notification
 */
async function createNotification({ orgId, employeeId, title, body, type = 'NOTICE', referenceType, referenceId }) {
  const prisma = getPrisma();

  return prisma.notification.create({
    data: {
      orgId,
      employeeId,
      title,
      body,
      type,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
    },
  });
}

/**
 * Create in-app notifications for multiple employees
 */
async function createBulkNotifications({ orgId, employeeIds, title, body, type = 'NOTICE', referenceType, referenceId }) {
  const prisma = getPrisma();

  const data = employeeIds.map((employeeId) => ({
    orgId,
    employeeId,
    title,
    body,
    type,
    referenceType: referenceType || null,
    referenceId: referenceId || null,
  }));

  return prisma.notification.createMany({ data });
}

/**
 * Get notifications for an employee
 */
async function getNotifications({ employeeId, orgId, unreadOnly = false, page = 1, limit = 50 }) {
  const prisma = getPrisma();

  const where = { employeeId, orgId, isCleared: false };
  if (unreadOnly) where.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { employeeId, orgId, isRead: false, isCleared: false } }),
  ]);

  return { notifications, total, unreadCount, page };
}

/**
 * Mark notification(s) as read
 */
async function markAsRead({ notificationIds, employeeId }) {
  const prisma = getPrisma();

  return prisma.notification.updateMany({
    where: { id: { in: notificationIds }, employeeId },
    data: { isRead: true },
  });
}

/**
 * Clear (soft-delete) notifications
 */
async function clearNotifications({ employeeId }) {
  const prisma = getPrisma();

  return prisma.notification.updateMany({
    where: { employeeId },
    data: { isCleared: true },
  });
}

/**
 * Register a push token
 */
async function registerPushToken({ employeeId, token, deviceName }) {
  const prisma = getPrisma();

  await prisma.pushToken.upsert({
    where: { employeeId_token: { employeeId, token } },
    create: { employeeId, token, deviceName: deviceName || null },
    update: { deviceName: deviceName || null },
  });
}

/**
 * Remove a push token (on logout)
 */
async function removePushToken({ employeeId, token }) {
  const prisma = getPrisma();
  await prisma.pushToken.deleteMany({ where: { employeeId, token } });
}

module.exports = {
  sendPushToEmployees,
  sendPushToAdmins,
  createNotification,
  createBulkNotifications,
  getNotifications,
  markAsRead,
  clearNotifications,
  registerPushToken,
  removePushToken,
};
