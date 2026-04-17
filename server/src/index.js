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

  // Auto-notify designers 7 days before upcoming events
  const { startDesignTaskScheduler } = require('./routes/design-tasks');
  startDesignTaskScheduler();
});
