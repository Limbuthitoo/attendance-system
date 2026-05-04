// ─────────────────────────────────────────────────────────────────────────────
// Platform Device Management — Superadmin manages devices across all orgs
// Mounted at /api/platform/devices
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { getPrisma } = require('../../lib/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { cacheInvalidate } = require('../../config/redis');

const router = Router();

// GET /  — List all devices across all orgs
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { orgId, deviceType, search } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (deviceType) where.deviceType = deviceType;

    const devices = await prisma.device.findMany({
      where,
      select: {
        id: true,
        orgId: true,
        deviceType: true,
        deviceSerial: true,
        name: true,
        brand: true,
        model: true,
        location: true,
        firmwareVersion: true,
        lastHeartbeatAt: true,
        isActive: true,
        createdAt: true,
        org: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map org to organization for frontend consistency
    const mapped = devices.map(d => ({
      ...d,
      organization: d.org,
      org: undefined,
    }));

    res.json({ devices: mapped });
  } catch (err) {
    next(err);
  }
});

// POST /  — Register a device and assign to an org
router.post('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { orgId, branchId, deviceType, deviceSerial, name, brand, model, location } = req.body;

    if (!orgId || !deviceType || !deviceSerial) {
      return res.status(400).json({ error: 'orgId, deviceType, and deviceSerial are required' });
    }

    // Verify org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Check duplicate serial
    const existing = await prisma.device.findUnique({ where: { deviceSerial } });
    if (existing) return res.status(409).json({ error: 'Device serial already registered' });

    // Generate API key
    const apiKey = `dev_${crypto.randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    const device = await prisma.device.create({
      data: {
        orgId,
        branchId: branchId || null,
        deviceType,
        deviceSerial,
        name: name || null,
        brand: brand || null,
        model: model || null,
        location: location || null,
        apiKeyHash,
      },
    });

    res.status(201).json({ device, apiKey });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/deactivate
router.put('/:id/deactivate', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    await cacheInvalidate(`device:auth:${device.deviceSerial}`);
    res.json({ device });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/reactivate
router.put('/:id/reactivate', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json({ device });
  } catch (err) {
    next(err);
  }
});

// POST /:id/rotate-key
router.post('/:id/rotate-key', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const device = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const newApiKey = `dev_${crypto.randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(newApiKey, 12);

    await prisma.device.update({
      where: { id: req.params.id },
      data: { apiKeyHash },
    });

    await cacheInvalidate(`device:auth:${device.deviceSerial}`);
    res.json({ apiKey: newApiKey });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
