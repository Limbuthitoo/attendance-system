// ─────────────────────────────────────────────────────────────────────────────
// Redis client (ioredis) — used for caching, pub/sub, and BullMQ
// ─────────────────────────────────────────────────────────────────────────────
const Redis = require('ioredis');
const config = require('./index');

let redis = null;
let subscriber = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,  // required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redis.on('connect', () => console.log('✓ Redis connected'));
    redis.on('error', (err) => console.error('Redis error:', err.message));
  }
  return redis;
}

/**
 * Separate Redis connection for Pub/Sub subscriber
 * (ioredis requires a dedicated connection for subscriptions)
 */
function getSubscriber() {
  if (!subscriber) {
    subscriber = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    subscriber.on('error', (err) => console.error('Redis subscriber error:', err.message));
  }
  return subscriber;
}

/**
 * Publish an event to a Redis channel
 */
async function publishEvent(channel, data) {
  const client = getRedis();
  await client.publish(channel, JSON.stringify(data));
}

/**
 * Cache helper — get or set with TTL
 */
async function cacheGet(key) {
  const client = getRedis();
  const val = await client.get(key);
  return val ? JSON.parse(val) : null;
}

async function cacheSet(key, data, ttlSeconds = 60) {
  const client = getRedis();
  await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
}

async function cacheInvalidate(pattern) {
  const client = getRedis();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}

async function closeRedis() {
  if (redis) await redis.quit();
  if (subscriber) await subscriber.quit();
  redis = null;
  subscriber = null;
}

module.exports = {
  getRedis,
  getSubscriber,
  publishEvent,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  closeRedis,
};
