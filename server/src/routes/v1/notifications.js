// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes (v1) — In-app notifications
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const notificationService = require('../../services/notification.service');

const router = Router();

// GET /api/v1/notifications
router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, page, limit } = req.query;
    const result = await notificationService.getNotifications({
      employeeId: req.user.id,
      orgId: req.orgId,
      unreadOnly: unreadOnly === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
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

module.exports = router;
