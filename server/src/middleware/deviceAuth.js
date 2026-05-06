// ─────────────────────────────────────────────────────────────────────────────
// Device Authentication Middleware — Per-device API keys (bcrypt hashed)
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../lib/prisma');
const { cacheGet, cacheSet } = require('../config/redis');

/**
 * Authenticate a physical device (NFC reader, fingerprint scanner, QR terminal, etc.)
 *
 * Expects headers:
 *   x-device-serial: <device serial/MAC>
 *   x-api-key: <plaintext API key>
 *
 * Populates req.device with { id, orgId, branchId, deviceType, deviceSerial }
 */
async function authenticateDevice(req, res, next) {
  const deviceSerial = req.headers['x-device-serial'];
  const apiKey = req.headers['x-api-key'];

  if (!deviceSerial || !apiKey) {
    return res.status(401).json({ error: 'Device serial and API key required' });
  }

  try {
    // Check cache first (avoid DB + bcrypt on every request)
    const cacheKey = `device:auth:${deviceSerial}`;
    let cachedDevice = null;
    try {
      cachedDevice = await cacheGet(cacheKey);
    } catch (_) { /* Redis unavailable — fall through to DB */ }

    if (!cachedDevice) {
      const prisma = getPrisma();
      cachedDevice = await prisma.device.findUnique({
        where: { deviceSerial },
        select: {
          id: true,
          orgId: true,
          branchId: true,
          deviceType: true,
          deviceSerial: true,
          apiKeyHash: true,
          isActive: true,
        },
      });

      if (!cachedDevice) {
        return res.status(401).json({ error: 'Unknown device' });
      }

      try { await cacheSet(cacheKey, cachedDevice, 300); } catch (_) { /* Redis unavailable */ }
    }

    if (!cachedDevice.isActive) {
      return res.status(403).json({ error: 'Device is deactivated' });
    }

    // Verify API key (bcrypt compare)
    const valid = await bcrypt.compare(apiKey, cachedDevice.apiKeyHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const { apiKeyHash, ...deviceInfo } = cachedDevice;
    req.device = deviceInfo;
    next();
  } catch (err) {
    console.error('Device auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authenticateDevice };
