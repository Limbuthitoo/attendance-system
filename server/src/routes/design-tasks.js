const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMail} = require('../mailer');

const router = express.Router();

// All events template (used for seeding a year)
const EVENT_TEMPLATES = [
  { name: 'Nepali New Year (Nawa Barsa)', category: 'national' },
  { name: 'Loktantra Diwas', category: 'national' },
  { name: 'Prajatantra Diwas', category: 'national' },
  { name: 'Ganatantra Diwas', category: 'national' },
  { name: 'Sahid Diwas', category: 'national' },
  { name: 'Bisket Jatra', category: 'festival' },
  { name: 'Buddha Jayanti', category: 'religious' },
  { name: 'Ropain (Asar 15)', category: 'cultural' },
  { name: 'Janai Purnima / Raksha Bandhan', category: 'religious' },
  { name: 'Gai Jatra', category: 'cultural' },
  { name: 'Krishna Janmashtami', category: 'religious' },
  { name: 'Teej (Dar Khane Din)', category: 'festival' },
  { name: 'Haritalika Teej', category: 'festival' },
  { name: 'Sambidhan Diwas', category: 'national' },
  { name: 'Indra Jatra', category: 'cultural' },
  { name: 'Ghatasthapana', category: 'festival' },
  { name: 'Fulpati', category: 'festival' },
  { name: 'Bijaya Dashami', category: 'festival' },
  { name: 'Dhanwantari Jayanti', category: 'religious' },
  { name: 'Kag Tihar', category: 'festival' },
  { name: 'Kukur Tihar', category: 'festival' },
  { name: 'Gai Puja', category: 'festival' },
  { name: 'Gobardhan Puja', category: 'festival' },
  { name: 'Laxmi Puja', category: 'festival' },
  { name: 'Bhai Tika', category: 'festival' },
  { name: 'Chhath Parva', category: 'festival' },
  { name: 'Yomari Punhi', category: 'cultural' },
  { name: 'Uudhauli Parwa', category: 'cultural' },
  { name: 'Christmas Day', category: 'festival' },
  { name: 'Tamu Lhosar', category: 'cultural' },
  { name: 'Sonam Lhosar', category: 'cultural' },
  { name: 'Gyalpo Lhosar', category: 'cultural' },
  { name: 'Prithivi Jayanti', category: 'national' },
  { name: 'Maghe Sankranti', category: 'festival' },
  { name: 'Saraswati Puja', category: 'religious' },
  { name: 'Maha Shivaratri', category: 'religious' },
  { name: 'International Women\'s Day', category: 'national' },
  { name: 'Holi (Fagu Purnima)', category: 'festival' },
  { name: 'Ghode Jatra', category: 'cultural' },
  { name: 'Chaite Dashain', category: 'festival' },
  { name: 'Bibaha Panchami', category: 'religious' },
  { name: 'Bala Chaturdashi Parwa', category: 'religious' },
  { name: 'Guru Nanak Jayanti', category: 'religious' },
  { name: 'Dhanteras', category: 'festival' },
  { name: 'Jitiya Parwa', category: 'cultural' },
  { name: 'Guru Purnima', category: 'religious' },
  { name: 'Labour Day', category: 'national' },
  { name: 'Mother\'s Day', category: 'cultural' },
  { name: 'Father\'s Day', category: 'cultural' },
  { name: 'Topi Diwas', category: 'national' },
  { name: 'Laxmi Prasad Devkota Jayanti', category: 'national' },
  { name: 'Biswakarma Diwas', category: 'cultural' },
];

// GET /design-tasks — list all tasks with filters (admin)
router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { year, status, assigned_to, category } = req.query;

  let sql = `
    SELECT dt.*, e.name as assigned_name, e.email as assigned_email,
           c.name as created_by_name
    FROM design_tasks dt
    LEFT JOIN employees e ON dt.assigned_to = e.id
    LEFT JOIN employees c ON dt.created_by = c.id
    WHERE 1=1
  `;
  const params = [];

  if (year) { sql += ' AND dt.bs_year = ?'; params.push(year); }
  if (status) { sql += ' AND dt.status = ?'; params.push(status); }
  if (assigned_to) { sql += ' AND dt.assigned_to = ?'; params.push(assigned_to); }
  if (category) { sql += ' AND dt.category = ?'; params.push(category); }

  sql += ' ORDER BY dt.event_date IS NULL, dt.event_date ASC, dt.event_name ASC';

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

// GET /design-tasks/my — tasks assigned to current user
router.get('/my', authenticate, (req, res) => {
  const db = getDB();
  const { year } = req.query;

  let sql = `
    SELECT dt.*, c.name as created_by_name
    FROM design_tasks dt
    LEFT JOIN employees c ON dt.created_by = c.id
    WHERE dt.assigned_to = ?
  `;
  const params = [req.user.id];

  if (year) { sql += ' AND dt.bs_year = ?'; params.push(year); }

  sql += ' ORDER BY dt.event_date IS NULL, dt.event_date ASC, dt.event_name ASC';

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

// GET /design-tasks/templates — get all event templates
router.get('/templates', authenticate, requireAdmin, (req, res) => {
  res.json({ templates: EVENT_TEMPLATES });
});

// POST /design-tasks — create single task (admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { event_name, event_date, bs_year, description, category, assigned_to } = req.body;

  if (!event_name) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  const result = db.prepare(`
    INSERT INTO design_tasks (event_name, event_date, bs_year, description, category, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event_name,
    event_date || null,
    bs_year || 2083,
    description || '',
    category || 'festival',
    assigned_to || null,
    req.user.id
  );

  const task = db.prepare('SELECT * FROM design_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ task });
});

// POST /design-tasks/seed — bulk create all events for a year (admin)
router.post('/seed', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { bs_year, assigned_to } = req.body;
  const year = bs_year || 2083;

  // Check if already seeded for this year
  const existing = db.prepare('SELECT COUNT(*) as c FROM design_tasks WHERE bs_year = ?').get(year).c;
  if (existing > 0) {
    return res.status(400).json({ error: `Events already exist for BS ${year}. Delete them first if you want to re-seed.` });
  }

  const stmt = db.prepare(`
    INSERT INTO design_tasks (event_name, bs_year, category, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((templates) => {
    for (const t of templates) {
      stmt.run(t.name, year, t.category, assigned_to || null, req.user.id);
    }
  });

  insertMany(EVENT_TEMPLATES);

  const tasks = db.prepare('SELECT * FROM design_tasks WHERE bs_year = ? ORDER BY event_name').all(year);
  res.status(201).json({ tasks, count: tasks.length });
});

// PUT /design-tasks/:id — update task (admin)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { event_name, event_date, description, category, status, assigned_to } = req.body;
  const task = db.prepare('SELECT * FROM design_tasks WHERE id = ?').get(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  db.prepare(`
    UPDATE design_tasks SET
      event_name = COALESCE(?, event_name),
      event_date = ?,
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      status = COALESCE(?, status),
      assigned_to = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    event_name || null,
    event_date !== undefined ? event_date : task.event_date,
    description !== undefined ? description : null,
    category || null,
    status || null,
    assigned_to !== undefined ? assigned_to : task.assigned_to,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT dt.*, e.name as assigned_name, e.email as assigned_email
    FROM design_tasks dt
    LEFT JOIN employees e ON dt.assigned_to = e.id
    WHERE dt.id = ?
  `).get(req.params.id);

  res.json({ task: updated });
});

// DELETE /design-tasks/:id — delete single task (admin)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const task = db.prepare('SELECT * FROM design_tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  db.prepare('DELETE FROM design_tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

// DELETE /design-tasks/year/:year — delete all tasks for a year (admin)
router.delete('/year/:year', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const result = db.prepare('DELETE FROM design_tasks WHERE bs_year = ?').run(req.params.year);
  res.json({ message: `Deleted ${result.changes} tasks for BS ${req.params.year}` });
});

// POST /design-tasks/:id/notify — send notification email for single task (admin)
router.post('/:id/notify', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const task = db.prepare(`
    SELECT dt.*, e.name as assigned_name, e.email as assigned_email
    FROM design_tasks dt
    LEFT JOIN employees e ON dt.assigned_to = e.id
    WHERE dt.id = ?
  `).get(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!task.assigned_to) {
    return res.status(400).json({ error: 'No designer assigned to this task' });
  }
  if (!task.assigned_email) {
    return res.status(400).json({ error: 'Assigned employee has no email address' });
  }

  const { message } = req.body;
  const daysUntil = task.event_date
    ? Math.ceil((new Date(task.event_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const appUrl = process.env.CORS_ORIGIN || 'https://hr.bijaysubbalimbu.com.np';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">🎨 Design Task Notification</h2>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Archisys Innovations</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 16px;">Hello <strong>${task.assigned_name}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">Please prepare the design for the following event:</p>
        
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #2563eb;">
          <h3 style="margin: 0 0 8px; color: #0f172a; font-size: 17px;">${task.event_name}</h3>
          ${task.event_date ? `<p style="margin: 4px 0; color: #64748b; font-size: 14px;">📅 Date: <strong>${formatDate(task.event_date)}</strong>${daysUntil !== null ? ` (${daysUntil > 0 ? daysUntil + ' days away' : daysUntil === 0 ? 'Today!' : Math.abs(daysUntil) + ' days ago'})` : ''}</p>` : ''}
          ${task.description ? `<p style="margin: 4px 0; color: #64748b; font-size: 14px;">📝 ${task.description}</p>` : ''}
        </div>

        ${message ? `<div style="background: #fffbeb; border-radius: 8px; padding: 12px 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Note from admin:</strong> ${message}</p>
        </div>` : ''}

        <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; text-align: center;">——<br>Archisys Innovations HR System</p>
      </div>
    </div>
  `;

  sendMail({
    to: task.assigned_email,
    subject: `🎨 Design Task: ${task.event_name}`,
    html,
  });

  // Mark as notified
  db.prepare(`
    UPDATE design_tasks SET notification_sent = 1, notification_date = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  res.json({ message: `Notification sent to ${task.assigned_name} (${task.assigned_email})` });
});

// POST /design-tasks/notify-bulk — notify all pending tasks with dates (admin)
router.post('/notify-bulk', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const { task_ids, message } = req.body;

  if (!task_ids || !task_ids.length) {
    return res.status(400).json({ error: 'No task IDs provided' });
  }

  const placeholders = task_ids.map(() => '?').join(',');
  const tasks = db.prepare(`
    SELECT dt.*, e.name as assigned_name, e.email as assigned_email
    FROM design_tasks dt
    LEFT JOIN employees e ON dt.assigned_to = e.id
    WHERE dt.id IN (${placeholders}) AND dt.assigned_to IS NOT NULL
  `).all(...task_ids);

  let sent = 0;
  const appUrl = process.env.CORS_ORIGIN || 'https://hr.bijaysubbalimbu.com.np';

  for (const task of tasks) {
    if (!task.assigned_email) continue;

    const daysUntil = task.event_date
      ? Math.ceil((new Date(task.event_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">🎨 Design Task Notification</h2>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Archisys Innovations</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #334155; font-size: 15px;">Hello <strong>${task.assigned_name}</strong>,</p>
          <p style="color: #334155; font-size: 15px;">Please prepare the design for:</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #2563eb;">
            <h3 style="margin: 0 0 8px; color: #0f172a; font-size: 17px;">${task.event_name}</h3>
            ${task.event_date ? `<p style="margin: 4px 0; color: #64748b; font-size: 14px;">📅 ${formatDate(task.event_date)}${daysUntil !== null ? ` (${daysUntil > 0 ? daysUntil + ' days away' : 'Today!'})` : ''}</p>` : ''}
          </div>
          ${message ? `<p style="color: #92400e; font-size: 14px; background: #fffbeb; padding: 12px; border-radius: 8px;"><strong>Note:</strong> ${message}</p>` : ''}
          <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; text-align: center;">——<br>Archisys Innovations HR System</p>
        </div>
      </div>
    `;

    sendMail({
      to: task.assigned_email,
      subject: `🎨 Design Task: ${task.event_name}`,
      html,
    });

    db.prepare(`
      UPDATE design_tasks SET notification_sent = 1, notification_date = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(task.id);

    sent++;
  }

  res.json({ message: `Notifications sent to ${sent} task(s)` });
});

// PUT /design-tasks/:id/status — quick status update (designer or admin)
router.put('/:id/status', authenticate, (req, res) => {
  const db = getDB();
  const { status } = req.body;

  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const task = db.prepare('SELECT * FROM design_tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only admin or assigned designer can update
  if (req.user.role !== 'admin' && task.assigned_to !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  db.prepare('UPDATE design_tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(status, req.params.id);

  const updated = db.prepare('SELECT * FROM design_tasks WHERE id = ?').get(req.params.id);
  res.json({ task: updated });
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

module.exports = router;
