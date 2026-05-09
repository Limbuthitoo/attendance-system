// ─────────────────────────────────────────────────────────────────────────────
// CRM Microservice Entry Point
// Extracted from main monolith — runs as independent Express app
// Shares same DB (crm schema) and Redis event bus
// ─────────────────────────────────────────────────────────────────────────────
const config = require('./config');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { disconnectPrisma } = require('./lib/prisma');
const { closeRedis } = require('./config/redis');

const { authenticate } = require('./middleware/auth');
const { tenantContext } = require('./middleware/tenantContext');
const { requireModule } = require('./middleware/moduleGuard');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3011;
const SERVICE_NAME = 'crm-service';

// ── Middleware ──────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(cookieParser());

const corsOrigin = config.corsOrigin;
app.use(cors({
  origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : false,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { eventBus } = require('./lib/eventBus');
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    eventBus: eventBus.status(),
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
const crmRoutes = require('./routes/v1/crm');

app.use('/api/v1/crm', apiLimiter, authenticate, tenantContext, requireModule('crm'), crmRoutes);
app.use('/api/crm', apiLimiter, authenticate, tenantContext, requireModule('crm'), crmRoutes);

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Process-level error handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error(`[${SERVICE_NAME}] Uncaught exception:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${SERVICE_NAME}] Unhandled rejection:`, reason);
  process.exit(1);
});

// ── Initialize + start ─────────────────────────────────────────────────────
require('./services/crm.service');

const { eventBus } = require('./lib/eventBus');
eventBus.connectRedis().catch(() => {});

const server = app.listen(PORT, () => {
  console.log(`✓ ${SERVICE_NAME} running on port ${PORT} [${config.nodeEnv}]`);
  console.log(`  CRM:    http://localhost:${PORT}/api/v1/crm`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${SERVICE_NAME}] Received ${signal}, shutting down...`);
  server.close(async () => {
    try {
      await closeRedis();
      await disconnectPrisma();
      console.log(`✓ [${SERVICE_NAME}] All connections closed`);
      process.exit(0);
    } catch (err) {
      console.error(`[${SERVICE_NAME}] Shutdown error:`, err);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
