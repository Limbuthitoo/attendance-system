// ─────────────────────────────────────────────────────────────────────────────
// Attendance SaaS — Main Server Entry Point (v2)
// ─────────────────────────────────────────────────────────────────────────────
const config = require('./config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { errorHandler } = require('./middleware/errorHandler');
const { disconnectPrisma } = require('./lib/prisma');
const { closeRedis } = require('./config/redis');
const { closeQueues } = require('./config/queue');

const v1Routes = require('./routes/v1');
const platformRoutes = require('./routes/platform');
const { initModules, getEventSubscriptions } = require('./modules');

const app = express();

// Ensure data directories exist
const dataDir = path.join(__dirname, '..', 'data');
const dirs = ['apk', 'branding'].map(d => path.join(dataDir, d));
for (const dir of dirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Trust first proxy (nginx) so rate limiter sees real client IPs
app.set('trust proxy', 1);

// ── Security & performance middleware ───────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(cookieParser());

// ── CORS ────────────────────────────────────────────────────────────────────
const corsOrigin = config.corsOrigin;
if (!corsOrigin && config.isProd) {
  console.error('✗ FATAL: CORS_ORIGIN must be set in production! Rejecting all cross-origin requests.');
}
app.use(cors({
  origin: corsOrigin
    ? corsOrigin.split(',').map((s) => s.trim())
    : false,
  credentials: true,
}));

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── XSS sanitization ───────────────────────────────────────────────────────
const sanitizeInput = require('./middleware/sanitize');
app.use(sanitizeInput);

// ── CSRF protection ────────────────────────────────────────────────────────
const { csrfSetToken, csrfValidate } = require('./middleware/csrf');
app.use(csrfSetToken);
app.use(csrfValidate);

// ── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Default per-IP key generator handles IPv6 correctly
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { eventBus } = require('./lib/eventBus');
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    eventBus: eventBus.status(),
  });
});

// ── Serve branding assets (no rate limit, no auth) ──────────────────────────
// Only branding GET routes are public; full settings router is mounted via v1 with auth
const { Router } = require('express');
const brandingPublicRouter = Router();
const brandingDir = path.join(__dirname, '..', 'data', 'branding');
brandingPublicRouter.get('/branding/:type', async (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  try {
    const prisma = require('./lib/prisma').getPrisma();
    const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';

    // Determine orgId: from auth token, x-org-id header, or org slug query param
    let orgId = null;
    // Try auth token first (for logged-in users)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = require('jsonwebtoken').verify(authHeader.slice(7), require('./config').jwtSecret);
        if (decoded.id) {
          const emp = await prisma.employee.findUnique({ where: { id: decoded.id }, select: { orgId: true } });
          if (emp) orgId = emp.orgId;
        }
      } catch {}
    }
    // Fallback: x-org-id header
    if (!orgId && req.headers['x-org-id']) {
      orgId = req.headers['x-org-id'];
    }
    // Fallback: ?org=slug query param
    if (!orgId && req.query.org) {
      const org = await prisma.organization.findUnique({
        where: { slug: req.query.org },
        select: { id: true },
      });
      if (org) orgId = org.id;
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Organization context required. Use ?org=slug or login first.' });
    }

    const setting = await prisma.orgSetting.findFirst({
      where: { key, orgId },
    });
    if (!setting) return res.status(404).json({ error: `No ${type} configured` });
    const filePath = path.join(brandingDir, setting.value);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load branding' });
  }
});
app.use('/api/v1/settings', brandingPublicRouter);
app.use('/api/settings', brandingPublicRouter);  // backward compat for old clients

// ── NFC routes — exempt from general rate limiter (high-frequency device) ───
const nfcRouter = require('./routes/v1/nfc');
app.use('/api/v1/nfc', nfcRouter);
app.use('/api/nfc', nfcRouter); // backward compat

// ── API v1 routes ───────────────────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', apiLimiter, v1Routes);

// ── Platform portal routes (super-admin) ────────────────────────────────────
app.use('/api/platform/auth', authLimiter);
app.use('/api/platform', apiLimiter, platformRoutes);

// ── Backward compatibility: /api/* → v1 routes ─────────────────────────────
// Old clients (mobile, NFC reader) use /api/auth, /api/attendance, etc.
// Mount the same v1Routes at /api so old paths work without redirect.
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter, (req, res, next) => {
  // Skip paths already handled by /api/v1 or /api/platform
  if (req.path.startsWith('/v1') || req.path.startsWith('/platform') || req.path === '/health') {
    return next('route');
  }
  next();
}, v1Routes);

// ── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ── Process-level error handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// ── Start server ────────────────────────────────────────────────────────────
// Initialize all modules (registers event subscriptions)
initModules();

// Connect event bus to Redis pub/sub (graceful fallback to in-process)
const { eventBus } = require('./lib/eventBus');
eventBus.connectRedis().catch(() => {});

const server = app.listen(config.port, () => {
  console.log(`✓ Attendance SaaS API running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`  API v1:     http://localhost:${config.port}/api/v1`);
  console.log(`  Platform:   http://localhost:${config.port}/api/platform`);
  console.log(`  Health:     http://localhost:${config.port}/api/health`);
  const subs = getEventSubscriptions();
  if (Object.keys(subs).length > 0) {
    console.log(`  Events:     ${Object.entries(subs).map(([e, m]) => `${e} → [${m.join(', ')}]`).join(', ')}`);
  }
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  server.close(async () => {
    try {
      await closeQueues();
      await closeRedis();
      await disconnectPrisma();
      console.log('✓ All connections closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 15000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app; // for testing
