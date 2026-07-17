// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes (v1) — In-app notifications + notification preferences
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const notificationService = require('../../services/notification.service');
const { CHANNELS, getAllChannels } = require('../../config/notification-channels');

const router = Router();

// GET /api/v1/notifications
router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, unread_only: unreadOnlySnake, page, offset, limit } = req.query;
    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedPage = page
      ? parseInt(page, 10) || 1
      : Math.floor((parseInt(offset, 10) || 0) / parsedLimit) + 1;
    const result = await notificationService.getNotifications({
      employeeId: req.user.id,
      orgId: req.orgId,
      unreadOnly: unreadOnly === 'true' || unreadOnlySnake === 'true' || unreadOnlySnake === '1',
      page: parsedPage,
      limit: parsedLimit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/read
router.put('/read', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    await notificationService.markAsRead({ notificationIds: ids, employeeId: req.user.id });
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/read-all
router.put('/read-all', async (req, res, next) => {
  try {
    const prisma = require('../../lib/prisma').getPrisma();
    await prisma.notification.updateMany({
      where: { employeeId: req.user.id, orgId: req.orgId, isRead: false, isCleared: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/:id/read — compatibility for older mobile builds
router.put('/:id/read', async (req, res, next) => {
  try {
    await notificationService.markAsRead({ notificationIds: [req.params.id], employeeId: req.user.id });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/unread-count — Just the unread count
router.get('/unread-count', async (req, res, next) => {
  try {
    const prisma = require('../../lib/prisma').getPrisma();
    const count = await prisma.notification.count({
      where: { employeeId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notifications — Clear all notifications
router.delete('/', async (req, res, next) => {
  try {
    await notificationService.clearNotifications({ employeeId: req.user.id });
    res.json({ message: 'Notifications cleared' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notifications/:id — Clear a single notification
router.delete('/:id', async (req, res, next) => {
  try {
    await notificationService.clearNotification({ notificationId: req.params.id, employeeId: req.user.id });
    res.json({ message: 'Notification cleared' });
  } catch (err) {
    next(err);
  }
});

// ─── Notification Channels Metadata ─────────────────────────────────────────

// GET /api/v1/notifications/channels — List all available channels
router.get('/channels', (req, res) => {
  const channels = getAllChannels().map(ch => ({
    channel: ch,
    ...CHANNELS[ch],
  }));
  res.json({ channels });
});

// ─── Employee Notification Preferences ──────────────────────────────────────

// GET /api/v1/notifications/preferences — My notification preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const prefs = await notificationService.getEmployeeNotifPrefsFull(req.user.id);
    res.json({ preferences: prefs });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/preferences — Update my notification preferences
router.put('/preferences', async (req, res, next) => {
  try {
    const { preferences } = req.body;
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'preferences array is required' });
    }

    // Validate channels
    const validChannels = new Set(getAllChannels());
    for (const p of preferences) {
      if (!validChannels.has(p.channel)) {
        return res.status(400).json({ error: `Invalid channel: ${p.channel}` });
      }
    }

    await notificationService.updateEmployeeNotifPrefsBulk(req.user.id, preferences);
    const updated = await notificationService.getEmployeeNotifPrefsFull(req.user.id);
    res.json({ preferences: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Org Notification Settings (admin only) ─────────────────────────────────

// GET /api/v1/notifications/org-settings — Get org notification settings
router.get('/org-settings', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const settings = await notificationService.getOrgNotificationSettingsFull(req.orgId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/notifications/org-settings — Update org notification settings
router.put('/org-settings', requirePermission('settings.update'), async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'settings array is required' });
    }

    const validChannels = new Set(getAllChannels());
    for (const s of settings) {
      if (!validChannels.has(s.channel)) {
        return res.status(400).json({ error: `Invalid channel: ${s.channel}` });
      }
    }

    await notificationService.updateOrgNotificationSettingsBulk(req.orgId, settings);
    const updated = await notificationService.getOrgNotificationSettingsFull(req.orgId);
    res.json({ settings: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
