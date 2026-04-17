require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { initDB, getDB } = require('./db');
const { sendPushToEmployees } = require('./push');
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const employeeRoutes = require('./routes/employees');
const dashboardRoutes = require('./routes/dashboard');
const nfcRoutes = require('./routes/nfc');
const settingsRoutes = require('./routes/settings');
const holidaysRoutes = require('./routes/holidays');
const appUpdateRoutes = require('./routes/app-update');
const designTasksRoutes = require('./routes/design-tasks');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initDB();

// Security & performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS — restrict in production
const corsOrigin = process.env.CORS_ORIGIN || '';
if (!corsOrigin) {
  console.warn('⚠  WARNING: CORS_ORIGIN is not set — allowing all origins. Set CORS_ORIGIN env var to restrict in production (e.g. CORS_ORIGIN=https://yourdomain.com)');
}
app.use(cors({
  origin: corsOrigin
    ? corsOrigin.split(',').map(s => s.trim())
    : true, // allow all origins when not configured (backward compat)
  credentials: true,
}));

// Request body limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting — auth routes (strict: prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // tighter limit for auth
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting — general API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting — write/mutation routes (more restrictive)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all /api routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/attendance', writeLimiter, attendanceRoutes);
app.use('/api/leaves', writeLimiter, leaveRoutes);
app.use('/api/employees', writeLimiter, employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/nfc', nfcRoutes);
app.use('/api/settings', writeLimiter, settingsRoutes);
app.use('/api/holidays', writeLimiter, holidaysRoutes);
app.use('/api/app-update', appUpdateRoutes);
app.use('/api/design-tasks', writeLimiter, designTasksRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', company: 'Archisys Innovations' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Archisys Attendance Server running on port ${PORT}`);

  // Daily cron: send push notification to designers for events happening tomorrow
  const checkDesignTaskNotifications = () => {
    try {
      const db = getDB();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

      // Find events happening tomorrow that haven't been notified yet
      const tasks = db.prepare(`
        SELECT dt.*, e.name as assigned_name
        FROM design_tasks dt
        LEFT JOIN employees e ON dt.assigned_to = e.id
        WHERE dt.event_date = ? AND dt.notification_sent = 0 AND dt.assigned_to IS NOT NULL
      `).all(tomorrowStr);

      for (const task of tasks) {
        sendPushToEmployees([task.assigned_to], {
          title: '🎨 Design Reminder - Tomorrow!',
          body: `${task.event_name} is tomorrow. Please prepare the design.`,
          data: { type: 'design_task_reminder', taskId: task.id },
        });

        // Mark as notified
        db.prepare(`
          UPDATE design_tasks SET notification_sent = 1, notification_date = datetime('now')
          WHERE id = ?
        `).run(task.id);

        console.log(`📢 Notified designer for: ${task.event_name} (${tomorrowStr})`);
      }

      if (tasks.length > 0) {
        console.log(`✅ Sent ${tasks.length} design task reminder(s) for ${tomorrowStr}`);
      }
    } catch (err) {
      console.error('Design task notification cron error:', err);
    }
  };

  // Run every hour (checks for tomorrow's events)
  setInterval(checkDesignTaskNotifications, 60 * 60 * 1000);
  // Also run once on startup after a short delay
  setTimeout(checkDesignTaskNotifications, 10000);
});
