const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMail} = require('../mailer');
const { sendPushToEmployees } = require('../push');

const router = express.Router();

// BS 2083 events with correct dates from Hamro Patro
const EVENT_TEMPLATES_2083 = [
  // Baisakh
  { name: 'Naya Barsha 2083 / Bisket Jatra', ad_date: '2026-04-14', category: 'national' },
  { name: 'Mata Tirtha Aunsi (Mother\'s Day)', ad_date: '2026-04-17', category: 'cultural' },
  { name: 'Loktantra Diwas (Democracy Day)', ad_date: '2026-04-24', category: 'national' },
  { name: 'Buddha Jayanti / Ubhauli Parwa', ad_date: '2026-05-01', category: 'religious' },
  { name: 'International Labour Day', ad_date: '2026-05-01', category: 'national' },
  // Jestha
  { name: 'Ganatantra Diwas (Republic Day)', ad_date: '2026-05-29', category: 'national' },
  { name: 'World Environment Day', ad_date: '2026-06-05', category: 'national' },
  // Asadh
  { name: 'International Yoga Day / Father\'s Day', ad_date: '2026-06-21', category: 'cultural' },
  { name: 'Dahi Chiura Khane / Asar 15 (Ropain)', ad_date: '2026-06-29', category: 'cultural' },
  { name: 'Bhanubhakta Jayanti', ad_date: '2026-07-13', category: 'national' },
  // Shrawan
  { name: 'Shrawan Sankranti', ad_date: '2026-07-17', category: 'cultural' },
  { name: 'Guru Purnima', ad_date: '2026-07-29', category: 'religious' },
  // Bhadra
  { name: 'Nag Panchami', ad_date: '2026-08-17', category: 'religious' },
  { name: 'Janai Purnima / Raksha Bandhan', ad_date: '2026-08-28', category: 'religious' },
  { name: 'Gai Jatra', ad_date: '2026-08-29', category: 'cultural' },
  { name: 'Krishna Janmashtami', ad_date: '2026-09-04', category: 'religious' },
  { name: 'Kushe Aunsi (Father\'s Day)', ad_date: '2026-09-11', category: 'cultural' },
  { name: 'Haritalika Teej', ad_date: '2026-09-14', category: 'festival' },
  // Ashoj
  { name: 'Biswakarma Puja', ad_date: '2026-09-17', category: 'cultural' },
  { name: 'Sambidhan Diwas (Constitution Day)', ad_date: '2026-09-19', category: 'national' },
  { name: 'Indra Jatra', ad_date: '2026-09-25', category: 'cultural' },
  { name: 'Jitiya Parwa', ad_date: '2026-10-04', category: 'cultural' },
  { name: 'Ghatasthapana (Navratri)', ad_date: '2026-10-11', category: 'festival' },
  { name: 'Fulpati', ad_date: '2026-10-17', category: 'festival' },
  // Kartik
  { name: 'Maha Navami', ad_date: '2026-10-20', category: 'festival' },
  { name: 'Vijaya Dashami (Dashain)', ad_date: '2026-10-21', category: 'festival' },
  { name: 'Dhanteras', ad_date: '2026-11-06', category: 'festival' },
  { name: 'Kag Tihar', ad_date: '2026-11-07', category: 'festival' },
  { name: 'Laxmi Puja / Kukur Tihar', ad_date: '2026-11-08', category: 'festival' },
  { name: 'Gai Puja', ad_date: '2026-11-09', category: 'festival' },
  { name: 'Gobardhan Puja / Mha Puja / Nepal Sambat', ad_date: '2026-11-10', category: 'festival' },
  { name: 'Bhai Tika', ad_date: '2026-11-11', category: 'festival' },
  { name: 'Chhath Parva', ad_date: '2026-11-15', category: 'festival' },
  // Mangsir
  { name: 'Bala Chaturdashi', ad_date: '2026-12-07', category: 'religious' },
  { name: 'Bibaha Panchami', ad_date: '2026-12-14', category: 'religious' },
  // Poush
  { name: 'Yomari Punhi / Udhauli Parwa', ad_date: '2026-12-24', category: 'cultural' },
  { name: 'Christmas Day', ad_date: '2026-12-25', category: 'festival' },
  { name: 'Tamu Lhosar', ad_date: '2026-12-30', category: 'cultural' },
  { name: 'English New Year 2027 / Topi Diwas', ad_date: '2027-01-01', category: 'national' },
  { name: 'Prithvi Jayanti / Rastriya Ekta Diwas', ad_date: '2027-01-11', category: 'national' },
  // Magh
  { name: 'Maghe Sankranti / Ghiu Chaku', ad_date: '2027-01-15', category: 'festival' },
  { name: 'Shahid Diwas (Martyrs\' Day)', ad_date: '2027-01-30', category: 'national' },
  { name: 'Sonam Lhosar', ad_date: '2027-02-07', category: 'cultural' },
  { name: 'Saraswati Puja / Basanta Panchami', ad_date: '2027-02-11', category: 'religious' },
  // Falgun
  { name: 'Prajatantra Diwas (Democracy Day)', ad_date: '2027-02-19', category: 'national' },
  { name: 'International Mother Language Day', ad_date: '2027-02-21', category: 'national' },
  { name: 'Maha Shivaratri', ad_date: '2027-03-06', category: 'religious' },
  { name: 'International Women\'s Day', ad_date: '2027-03-08', category: 'national' },
  { name: 'Gyalpo Lhosar', ad_date: '2027-03-09', category: 'cultural' },
  // Chaitra
  { name: 'Fagu Purnima (Holi)', ad_date: '2027-03-21', category: 'festival' },
  { name: 'Ghode Jatra', ad_date: '2027-04-06', category: 'cultural' },
  { name: 'Ram Navami / Chaite Dashain', ad_date: '2027-04-07', category: 'festival' },
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
  res.json({ templates: EVENT_TEMPLATES_2083 });
});

// GET /design-tasks/calendar-events — events for calendar view (designer sees own, admin sees all)
router.get('/calendar-events', authenticate, (req, res) => {
  const db = getDB();
  const { year, month } = req.query; // month in AD format: YYYY-MM

  let sql = `
    SELECT dt.id, dt.event_name, dt.event_date, dt.category, dt.status,
           dt.description, dt.bs_year, dt.assigned_to
    FROM design_tasks dt
    WHERE dt.event_date IS NOT NULL
  `;
  const params = [];

  // Non-admin users only see their own assigned events
  if (req.user.role !== 'admin') {
    sql += ' AND dt.assigned_to = ?';
    params.push(req.user.id);
  }

  if (year) {
    sql += ' AND dt.bs_year = ?';
    params.push(year);
  }

  if (month) {
    sql += ' AND dt.event_date LIKE ?';
    params.push(month + '%');
  }

  sql += ' ORDER BY dt.event_date ASC';

  const events = db.prepare(sql).all(...params);
  res.json({ events });
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

  // Push notification to assigned designer
  if (assigned_to) {
    sendPushToEmployees([Number(assigned_to)], {
      title: '🎨 New Design Task',
      body: `You've been assigned: ${event_name}`,
      data: { type: 'design_task', taskId: task.id },
    });
  }

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
    INSERT INTO design_tasks (event_name, event_date, bs_year, category, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((templates) => {
    for (const t of templates) {
      stmt.run(t.name, t.ad_date || null, year, t.category, assigned_to || null, req.user.id);
    }
  });

  insertMany(EVENT_TEMPLATES_2083);

  const tasks = db.prepare('SELECT * FROM design_tasks WHERE bs_year = ? ORDER BY event_name').all(year);

  // Push notification to assigned designer
  if (assigned_to) {
    sendPushToEmployees([Number(assigned_to)], {
      title: '🎨 Design Tasks Assigned',
      body: `${tasks.length} event designs for BS ${year} have been assigned to you`,
      data: { type: 'design_tasks_seed', year },
    });
  }

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

  // Push notification to designer
  sendPushToEmployees([task.assigned_to], {
    title: '🎨 Design Task',
    body: `Please prepare design for: ${task.event_name}`,
    data: { type: 'design_task_notify', taskId: task.id },
  });

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

    // Push notification to designer
    sendPushToEmployees([task.assigned_to], {
      title: '🎨 Design Task',
      body: `Please prepare design for: ${task.event_name}`,
      data: { type: 'design_task_notify', taskId: task.id },
    });

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
