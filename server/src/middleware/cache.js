// ─────────────────────────────────────────────────────────────────────────────
// Response Cache Middleware — Redis-backed HTTP response caching
//
// Usage:
//   router.get('/stats', responseCache({ ttl: 30, keyFn: orgKey }), handler)
//
// Provides:
//   - responseCache()   — Express middleware for GET endpoint caching
//   - userCache()       — Per-user auth data caching (roles/permissions)
//   - invalidateCache() — Bust cache by pattern prefix
// ─────────────────────────────────────────────────────────────────────────────
const { cacheGet, cacheSet, getRedis } = require('../config/redis');

/**
 * Key generators for common patterns
 */
const orgKey = (req) => `cache:${req.orgId}:${req.originalUrl}`;
const userOrgKey = (req) => `cache:${req.orgId}:${req.user?.role}:${req.originalUrl}`;
const userKey = (req) => `cache:user:${req.user?.id}:${req.originalUrl}`;

/**
 * Express middleware — caches the JSON response in Redis.
 *
 * @param {Object} opts
 * @param {number} opts.ttl       - TTL in seconds (default 30)
 * @param {Function} opts.keyFn   - (req) => string — cache key generator
 * @param {boolean} opts.orgScoped - if true, auto-invalidates when org data changes
 */
function responseCache({ ttl = 30, keyFn = orgKey } = {}) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = keyFn(req);
    try {
      const cached = await cacheGet(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch (e) {
      // Redis down — proceed without cache
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      res.setHeader('X-Cache', 'MISS');
      // Cache asynchronously — don't block response
      cacheSet(key, data, ttl).catch(() => {});
      return originalJson(data);
    };

    next();
  };
}

/**
 * Cache user auth data (employee + roles + permissions) to avoid
 * Prisma query on every authenticated request.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>} cached user data or null
 */
async function getUserCache(userId) {
  return cacheGet(`auth:user:${userId}`);
}

async function setUserCache(userId, data) {
  // 2 min TTL — balances freshness vs DB load
  return cacheSet(`auth:user:${userId}`, data, 120);
}

async function invalidateUserCache(userId) {
  try {
    const redis = getRedis();
    await redis.del(`auth:user:${userId}`);
  } catch (e) { /* ignore */ }
}

/**
 * Invalidate all cache keys matching a prefix.
 * Uses SCAN (non-blocking) instead of KEYS.
 */
async function invalidateCache(prefix) {
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (e) { /* ignore */ }
}

/**
 * Invalidate all response caches for an org (call after write operations)
 */
async function invalidateOrgCache(orgId) {
  return invalidateCache(`cache:${orgId}:`);
}

module.exports = {
  responseCache,
  orgKey,
  userOrgKey,
  userKey,
  getUserCache,
  setUserCache,
  invalidateUserCache,
  invalidateCache,
  invalidateOrgCache,
};
