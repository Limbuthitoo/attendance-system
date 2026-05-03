// ─────────────────────────────────────────────────────────────────────────────
// Centralized environment configuration with validation
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT / Auth
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '2h',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '',

  // SMTP
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  },
  notifyEmail: process.env.NOTIFY_EMAIL || '',

  // Platform seed
  platformAdminEmail: process.env.PLATFORM_ADMIN_EMAIL || 'admin@attendance.app',
  platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD,

  // Legacy migration
  legacyDbPath: process.env.LEGACY_DB_PATH || '',
  legacyOrgName: process.env.LEGACY_ORG_NAME || '',
  legacyOrgSlug: process.env.LEGACY_ORG_SLUG || '',
};

// ── Validate required vars ──────────────────────────────────────────────────
const required = ['databaseUrl', 'jwtSecret'];
const missing = required.filter((key) => !config[key]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('  DATABASE_URL and JWT_SECRET must be set. See .env.example');
  process.exit(1);
}

module.exports = config;
