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
    let device = await cacheGet(cacheKey);

    if (!device) {
      const prisma = getPrisma();
      device = await prisma.device.findUnique({
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

      if (!device) {
        return res.status(401).json({ error: 'Unknown device' });
      }
    }

    if (!device.isActive) {
      return res.status(403).json({ error: 'Device is deactivated' });
    }

    // Verify API key (bcrypt compare)
    const valid = await bcrypt.compare(apiKey, device.apiKeyHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Cache the device record (5 min) — excludes apiKeyHash for safety
    const { apiKeyHash, ...deviceInfo } = device;
    await cacheSet(cacheKey, deviceInfo, 300);

    req.device = deviceInfo;
    next();
  } catch (err) {
    console.error('Device auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authenticateDevice };
