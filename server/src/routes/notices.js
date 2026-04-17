const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendPushToEmployees } = require('../push');

// All routes require authentication
router.use(authenticate);

// GET /notices — list notices (everyone sees all, newest first)
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { limit = 50, offset = 0 } = req.query;
    const notices = db.prepare(`
      SELECT n.*, e.name as published_by_name
      FROM notices n
      LEFT JOIN employees e ON n.published_by = e.id
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(Number(limit), Number(offset));

    const total = db.prepare('SELECT COUNT(*) as c FROM notices').get().c;
    res.json({ notices, total });
  } catch (err) {
    console.error('Get notices error:', err);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// GET /notices/:id — single notice
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const notice = db.prepare(`
      SELECT n.*, e.name as published_by_name
      FROM notices n
      LEFT JOIN employees e ON n.published_by = e.id
      WHERE n.id = ?
    `).get(req.params.id);

    if (!notice) return res.status(404).json({ error: 'Notice not found' });

    // Mark related notification as read for this employee
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE employee_id = ? AND reference_type = 'notice' AND reference_id = ? AND is_read = 0
    `).run(req.user.id, notice.id);

    res.json({ notice });
  } catch (err) {
    console.error('Get notice error:', err);
    res.status(500).json({ error: 'Failed to fetch notice' });
  }
});

// POST /notices — admin publishes a notice → creates notifications + sends push
router.post('/', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const db = getDB();
    const { title, body, type = 'general', target = 'all' } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const validTypes = ['general', 'official', 'event', 'urgent'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid notice type' });
    }

    // Insert notice
    const result = db.prepare(`
      INSERT INTO notices (title, body, type, target, published_by) VALUES (?, ?, ?, ?, ?)
    `).run(title, body, type, target, req.user.id);

    const noticeId = result.lastInsertRowid;

    // Determine target employees
    let employeeIds;
    if (target === 'all') {
      employeeIds = db.prepare("SELECT id FROM employees WHERE is_active = 1").all().map(e => e.id);
    } else {
      // target is comma-separated employee IDs
      employeeIds = target.split(',').map(id => Number(id.trim())).filter(Boolean);
    }

    // Create notification for each target employee
    const insertNotif = db.prepare(`
      INSERT INTO notifications (employee_id, title, body, type, reference_type, reference_id)
      VALUES (?, ?, ?, 'notice', 'notice', ?)
    `);

    const typeEmoji = { general: '📢', official: '📋', event: '🎉', urgent: '🚨' };
    const pushTitle = `${typeEmoji[type] || '📢'} ${type === 'urgent' ? 'URGENT: ' : ''}${title}`;

    db.transaction(() => {
      for (const empId of employeeIds) {
        insertNotif.run(empId, title, body, noticeId);
      }
    })();

    // Send push notification
    sendPushToEmployees(employeeIds, {
      title: pushTitle,
      body: body.length > 150 ? body.substring(0, 147) + '...' : body,
      data: { type: 'notice', noticeId, screen: 'Notices' },
    });

    res.status(201).json({ notice: { id: noticeId, title, body, type, target }, notified: employeeIds.length });
  } catch (err) {
    console.error('Create notice error:', err);
    res.status(500).json({ error: 'Failed to publish notice' });
  }
});

// DELETE /notices/:id — admin deletes a notice
router.delete('/:id', (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const db = getDB();
    const notice = db.prepare('SELECT id FROM notices WHERE id = ?').get(req.params.id);
    if (!notice) return res.status(404).json({ error: 'Notice not found' });

    db.transaction(() => {
      db.prepare("DELETE FROM notifications WHERE reference_type = 'notice' AND reference_id = ?").run(notice.id);
      db.prepare('DELETE FROM notices WHERE id = ?').run(notice.id);
    })();

    res.json({ message: 'Notice deleted' });
  } catch (err) {
    console.error('Delete notice error:', err);
    res.status(500).json({ error: 'Failed to delete notice' });
  }
});

module.exports = router;
