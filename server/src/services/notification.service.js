// ─────────────────────────────────────────────────────────────────────────────
// Notification Service — Push notifications, in-app notifications
//
// Dispatch pipeline:
//   Trigger → resolve channel → check org settings → check quiet hours
//   → check employee preferences → apply branding → send
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { getChannelForType, CHANNELS, getAllChannels } = require('../config/notification-channels');
const { cacheGet, cacheSet } = require('../config/redis');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Get org notification settings (cached 5 min)
 */
async function getOrgNotificationSettings(orgId) {
  const cacheKey = `notif:org:${orgId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const prisma = getPrisma();
  const rows = await prisma.orgNotificationSetting.findMany({
    where: { orgId },
  });

  // Index by channel
  const settings = {};
  for (const row of rows) {
    settings[row.channel] = row;
  }
  await cacheSet(cacheKey, settings, 300);
  return settings;
}

/**
 * Get employee notification preferences (cached 5 min)
 */
async function getEmployeeNotifPrefs(employeeId) {
  const cacheKey = `notif:emp:${employeeId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const prisma = getPrisma();
  const rows = await prisma.employeeNotificationPref.findMany({
    where: { employeeId },
  });

  const prefs = {};
  for (const row of rows) {
    prefs[row.channel] = row;
  }
  await cacheSet(cacheKey, prefs, 300);
  return prefs;
}

/**
 * Check if current time is within quiet hours for an org channel.
 * Uses Asia/Kathmandu timezone.
 */
function isQuietHours(orgSetting) {
  if (!orgSetting?.quietHoursStart || !orgSetting?.quietHoursEnd) return false;

  const now = new Date();
  const npTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
  const currentMinutes = npTime.getHours() * 60 + npTime.getMinutes();

  const [startH, startM] = orgSetting.quietHoursStart.split(':').map(Number);
  const [endH, endM] = orgSetting.quietHoursEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g. 13:00 - 15:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Overnight range (e.g. 22:00 - 07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Apply org branding template to notification title.
 * Template can use {{orgName}} and {{title}} placeholders.
 */
function applyTitleTemplate(template, orgName, title) {
  if (!template) return title;
  return template
    .replace(/\{\{orgName\}\}/g, orgName || '')
    .replace(/\{\{title\}\}/g, title);
}

/**
 * Filter employee IDs based on org settings and individual preferences.
 * Returns array of employee IDs that should receive push notifications.
 *
 * @param {string} orgId
 * @param {string[]} employeeIds
 * @param {string} notificationType - e.g. 'LEAVE', 'BIRTHDAY'
 * @returns {{ allowedIds: string[], title: string }}
 */
async function filterByPreferences(orgId, employeeIds, notificationType) {
  if (!employeeIds || employeeIds.length === 0) return [];

  const channel = getChannelForType(notificationType);

  // 1. Check org-level settings
  const orgSettings = await getOrgNotificationSettings(orgId);
  const orgSetting = orgSettings[channel];

  // If org explicitly disabled push for this channel, block all
  if (orgSetting && orgSetting.pushEnabled === false) return [];

  // If in quiet hours, block push (in-app notification still created)
  if (isQuietHours(orgSetting)) return [];

  // 2. Check per-employee preferences
  const allowed = [];
  for (const empId of employeeIds) {
    const prefs = await getEmployeeNotifPrefs(empId);
    const pref = prefs[channel];

    // If employee explicitly disabled push, skip
    if (pref && pref.pushEnabled === false) continue;

    // If employee is muted until a future time, skip
    if (pref?.mutedUntil && new Date(pref.mutedUntil) > new Date()) continue;

    allowed.push(empId);
  }

  return allowed;
}

/**
 * Get branded title for push notification
 */
async function getBrandedTitle(orgId, title) {
  const orgSettings = await getOrgNotificationSettings(orgId);
  const channel = Object.values(orgSettings)[0]; // any channel has the template
  if (!channel?.titleTemplate) return title;

  const prisma = getPrisma();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  return applyTitleTemplate(channel.titleTemplate, org?.name, title);
}

/**
 * Send push notifications to specific employee IDs (called from worker).
 * Now respects org settings and employee preferences.
 */
async function sendPushToEmployees(employeeIds, { title, body, data = {}, orgId, notificationType }) {
  if (!employeeIds || employeeIds.length === 0) return;

  // Apply preference filtering if orgId and type are provided
  let filteredIds = employeeIds;
  let brandedTitle = title;

  if (orgId && notificationType) {
    filteredIds = await filterByPreferences(orgId, employeeIds, notificationType);
    if (filteredIds.length === 0) return;
    brandedTitle = await getBrandedTitle(orgId, title);
  }

  const prisma = getPrisma();

  const tokens = await prisma.pushToken.findMany({
    where: { employeeId: { in: filteredIds } },
    select: { token: true },
    distinct: ['token'],
  });

  if (tokens.length === 0) return;

  // Determine Android channel ID for the notification type
  const channel = notificationType ? getChannelForType(notificationType) : null;
  const channelMeta = channel ? CHANNELS[channel] : null;

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title: brandedTitle,
    body,
    data: { ...data, channel: channelMeta?.androidChannelId },
    ...(channelMeta ? { channelId: channelMeta.androidChannelId } : {}),
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
async function sendPushToAdmins(orgId, { title, body, data = {}, notificationType }) {
  const prisma = getPrisma();

  const admins = await prisma.employeeRole.findMany({
    where: {
      role: { name: 'org_admin' },
      employee: { orgId, isActive: true },
    },
    select: { employeeId: true },
  });

  const ids = admins.map((a) => a.employeeId);
  return sendPushToEmployees(ids, { title, body, data, orgId, notificationType });
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

async function clearNotification({ notificationId, employeeId }) {
  const prisma = getPrisma();

  return prisma.notification.updateMany({
    where: { id: notificationId, employeeId },
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

// ─── Org Notification Settings ────────────────────────────────────────────────

/**
 * Get all org notification settings with defaults for missing channels
 */
async function getOrgNotificationSettingsFull(orgId) {
  const prisma = getPrisma();
  const rows = await prisma.orgNotificationSetting.findMany({ where: { orgId } });

  const allChannels = getAllChannels();
  const settings = {};

  for (const ch of allChannels) {
    const row = rows.find(r => r.channel === ch);
    settings[ch] = {
      channel: ch,
      label: CHANNELS[ch].label,
      description: CHANNELS[ch].description,
      icon: CHANNELS[ch].icon,
      pushEnabled: row ? row.pushEnabled : true,
      emailEnabled: row ? row.emailEnabled : true,
      quietHoursStart: row?.quietHoursStart || null,
      quietHoursEnd: row?.quietHoursEnd || null,
      titleTemplate: row?.titleTemplate || null,
    };
  }
  return settings;
}

/**
 * Update org notification settings for a channel
 */
async function updateOrgNotificationSetting(orgId, channel, data) {
  const prisma = getPrisma();

  const result = await prisma.orgNotificationSetting.upsert({
    where: { orgId_channel: { orgId, channel } },
    create: {
      orgId,
      channel,
      pushEnabled: data.pushEnabled ?? true,
      emailEnabled: data.emailEnabled ?? true,
      quietHoursStart: data.quietHoursStart || null,
      quietHoursEnd: data.quietHoursEnd || null,
      titleTemplate: data.titleTemplate || null,
    },
    update: {
      pushEnabled: data.pushEnabled ?? true,
      emailEnabled: data.emailEnabled ?? true,
      quietHoursStart: data.quietHoursStart || null,
      quietHoursEnd: data.quietHoursEnd || null,
      titleTemplate: data.titleTemplate || null,
    },
  });

  // Invalidate cache
  const { getRedis } = require('../config/redis');
  try { await getRedis().del(`notif:org:${orgId}`); } catch (e) { /* ignore */ }

  return result;
}

/**
 * Bulk update org notification settings (for the settings page)
 */
async function updateOrgNotificationSettingsBulk(orgId, settingsArray) {
  const results = [];
  for (const s of settingsArray) {
    results.push(await updateOrgNotificationSetting(orgId, s.channel, s));
  }
  return results;
}

// ─── Employee Notification Preferences ────────────────────────────────────────

/**
 * Get employee notification preferences with defaults
 */
async function getEmployeeNotifPrefsFull(employeeId) {
  const prisma = getPrisma();
  const rows = await prisma.employeeNotificationPref.findMany({ where: { employeeId } });

  const allChannels = getAllChannels();
  const prefs = {};

  for (const ch of allChannels) {
    const row = rows.find(r => r.channel === ch);
    prefs[ch] = {
      channel: ch,
      label: CHANNELS[ch].label,
      description: CHANNELS[ch].description,
      icon: CHANNELS[ch].icon,
      pushEnabled: row ? row.pushEnabled : true,
      emailEnabled: row ? row.emailEnabled : true,
      mutedUntil: row?.mutedUntil || null,
    };
  }
  return prefs;
}

/**
 * Update employee notification preference for a channel
 */
async function updateEmployeeNotifPref(employeeId, channel, data) {
  const prisma = getPrisma();

  const result = await prisma.employeeNotificationPref.upsert({
    where: { employeeId_channel: { employeeId, channel } },
    create: {
      employeeId,
      channel,
      pushEnabled: data.pushEnabled ?? true,
      emailEnabled: data.emailEnabled ?? true,
      mutedUntil: data.mutedUntil || null,
    },
    update: {
      pushEnabled: data.pushEnabled ?? true,
      emailEnabled: data.emailEnabled ?? true,
      mutedUntil: data.mutedUntil || null,
    },
  });

  // Invalidate cache
  const { getRedis } = require('../config/redis');
  try { await getRedis().del(`notif:emp:${employeeId}`); } catch (e) { /* ignore */ }

  return result;
}

/**
 * Bulk update employee notification preferences
 */
async function updateEmployeeNotifPrefsBulk(employeeId, prefsArray) {
  const results = [];
  for (const p of prefsArray) {
    results.push(await updateEmployeeNotifPref(employeeId, p.channel, p));
  }
  return results;
}

module.exports = {
  sendPushToEmployees,
  sendPushToAdmins,
  createNotification,
  createBulkNotifications,
  getNotifications,
  markAsRead,
  clearNotifications,
  clearNotification,
  registerPushToken,
  removePushToken,
  // Org notification settings
  getOrgNotificationSettingsFull,
  updateOrgNotificationSetting,
  updateOrgNotificationSettingsBulk,
  // Employee preferences
  getEmployeeNotifPrefsFull,
  updateEmployeeNotifPref,
  updateEmployeeNotifPrefsBulk,
  // Helpers
  filterByPreferences,
  getChannelForType,
};
