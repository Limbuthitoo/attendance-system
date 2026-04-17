const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /notifications — list notifications for current user
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { limit = 50, offset = 0, unread_only } = req.query;

    let where = 'WHERE n.employee_id = ? AND n.is_cleared = 0';
    const params = [req.user.id];

    if (unread_only === '1' || unread_only === 'true') {
      where += ' AND n.is_read = 0';
    }

    const notifications = db.prepare(`
      SELECT n.* FROM notifications n
      ${where}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as c FROM notifications
      WHERE employee_id = ? AND is_read = 0 AND is_cleared = 0
    `).get(req.user.id).c;

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count — just the count
router.get('/unread-count', (req, res) => {
  try {
    const db = getDB();
    const count = db.prepare(`
      SELECT COUNT(*) as c FROM notifications
      WHERE employee_id = ? AND is_read = 0 AND is_cleared = 0
    `).get(req.user.id).c;

    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// PUT /notifications/:id/read — mark single notification as read
router.put('/:id/read', (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE id = ? AND employee_id = ?
    `).run(req.params.id, req.user.id);

    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PUT /notifications/read-all — mark all as read
router.put('/read-all', (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE employee_id = ? AND is_read = 0 AND is_cleared = 0
    `).run(req.user.id);

    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /notifications/:id — clear (hide) single notification
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      UPDATE notifications SET is_cleared = 1 WHERE id = ? AND employee_id = ?
    `).run(req.params.id, req.user.id);

    res.json({ message: 'Notification cleared' });
  } catch (err) {
    console.error('Clear notification error:', err);
    res.status(500).json({ error: 'Failed to clear notification' });
  }
});

// DELETE /notifications — clear all notifications
router.delete('/', (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      UPDATE notifications SET is_cleared = 1
      WHERE employee_id = ? AND is_cleared = 0
    `).run(req.user.id);

    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    console.error('Clear all error:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
