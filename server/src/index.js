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
const noticesRoutes = require('./routes/notices');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initDB();

// Trust first proxy (nginx) so rate limiter sees real client IPs
app.set('trust proxy', 1);

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

// Health check (before rate limiter)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', company: 'Archisys Innovations' });
});

// Serve branding assets (logo/favicon) without rate limiting
app.use('/api/settings/branding', settingsRoutes);

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
app.use('/api/notices', writeLimiter, noticesRoutes);
app.use('/api/notifications', writeLimiter, notificationsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log(`Archisys Attendance Server running on port ${PORT}`);

  // Auto-notify designers 7 days before upcoming events
  const { startDesignTaskScheduler } = require('./routes/design-tasks');
  startDesignTaskScheduler();

  // Auto-notify employees who forgot to check out (daily at 8:00 PM NPT)
  startForgotCheckoutScheduler();
});

// ── Forgot-checkout reminder scheduler ──────────────────────────
function startForgotCheckoutScheduler() {
  const { getNowInTimezone, getTodayDate, getOfficeSettings } = require('./settings');

  const DAY_MAP = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  const TARGET_HOUR = 20; // 8:00 PM NPT
  const TARGET_MINUTE = 0;

  const scheduleAt8PM = () => {
    const now = new Date();
    const settings = getOfficeSettings();
    const tz = settings.timezone || 'Asia/Kathmandu';

    // Get current time in office timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const curH = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const curM = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

    const nowMinutes = curH * 60 + curM;
    const targetMinutes = TARGET_HOUR * 60 + TARGET_MINUTE;
    let delayMinutes = targetMinutes - nowMinutes;
    if (delayMinutes <= 0) delayMinutes += 1440; // next day

    console.log(`⏰ Forgot-checkout reminder scheduled in ${Math.round(delayMinutes / 60)}h ${delayMinutes % 60}m`);

    setTimeout(() => {
      checkForgotCheckout();
      setInterval(checkForgotCheckout, 24 * 60 * 60 * 1000);
    }, delayMinutes * 60 * 1000);
  };

  const checkForgotCheckout = async () => {
    try {
      const settings = getOfficeSettings();
      const workingDays = (settings.working_days || 'mon,tue,wed,thu,fri').split(',').map(d => d.trim().toLowerCase());
      const today = getTodayDate();

      // Check if today is a working day
      const dayOfWeek = DAY_MAP[new Date().getDay()];
      if (!workingDays.includes(dayOfWeek)) {
        console.log('📋 Forgot-checkout: not a working day, skipping');
        return;
      }

      const db = getDB();

      // Find employees who checked in today but haven't checked out
      const forgotCheckout = db.prepare(`
        SELECT a.employee_id, e.name
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.date = ? AND a.check_in IS NOT NULL AND a.check_out IS NULL AND e.is_active = 1
      `).all(today);

      if (forgotCheckout.length === 0) {
        console.log('📋 Forgot-checkout: no one forgot to check out today');
        return;
      }

      const ids = forgotCheckout.map(r => r.employee_id);
      console.log(`📋 Forgot-checkout: notifying ${ids.length} employees`);

      await sendPushToEmployees(ids, {
        title: 'Forgot to Check Out?',
        body: 'You checked in today but haven\'t checked out yet. Please check out before leaving.',
        data: { type: 'checkout_reminder' },
      });

      // Also store in-app notifications
      const insertNotif = db.prepare(`
        INSERT INTO notifications (employee_id, title, body, type, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      const txn = db.transaction(() => {
        for (const emp of forgotCheckout) {
          insertNotif.run(
            emp.employee_id,
            'Forgot to Check Out?',
            'You checked in today but haven\'t checked out yet. Please check out before leaving.',
            'checkout_reminder'
          );
        }
      });
      txn();
    } catch (err) {
      console.error('Forgot-checkout scheduler error:', err);
    }
  };

  scheduleAt8PM();
}

// Graceful shutdown
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
