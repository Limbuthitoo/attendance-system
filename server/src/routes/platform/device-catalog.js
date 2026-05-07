// ─────────────────────────────────────────────────────────────────────────────
// Platform Device Catalog — Categories, Brands, Models, Adapters
// Mounted at /api/platform/device-catalog
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /categories — List all device categories
router.get('/categories', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.deviceCategory.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// POST /categories — Create a device category
router.post('/categories', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { key, name, icon } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: 'key and name are required' });
    }

    const existing = await prisma.deviceCategory.findUnique({ where: { key } });
    if (existing) return res.status(409).json({ error: 'Category key already exists' });

    const category = await prisma.deviceCategory.create({
      data: { key: key.toUpperCase(), name, icon: icon || null },
    });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

// PUT /categories/:id — Update a category
router.put('/categories/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, icon, isActive } = req.body;
    const category = await prisma.deviceCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

// DELETE /categories/:id — Delete (only if no models)
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const count = await prisma.deviceModel.count({ where: { categoryId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing models' });
    }
    await prisma.deviceCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /brands — List all device brands
router.get('/brands', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const brands = await prisma.deviceBrand.findMany({
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ brands });
  } catch (err) {
    next(err);
  }
});

// POST /brands — Create a device brand
router.post('/brands', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, website } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const existing = await prisma.deviceBrand.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: 'Brand already exists' });

    const brand = await prisma.deviceBrand.create({
      data: { name, website: website || null },
    });
    res.status(201).json({ brand });
  } catch (err) {
    next(err);
  }
});

// PUT /brands/:id — Update a brand
router.put('/brands/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, website, isActive } = req.body;
    const brand = await prisma.deviceBrand.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(website !== undefined && { website }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json({ brand });
  } catch (err) {
    next(err);
  }
});

// DELETE /brands/:id — Delete (only if no models)
router.delete('/brands/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const count = await prisma.deviceModel.count({ where: { brandId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete brand with existing models' });
    }
    await prisma.deviceBrand.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /models — List all device models (with category & brand)
router.get('/models', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { categoryId, brandId } = req.query;

    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    const models = await prisma.deviceModel.findMany({
      where,
      include: {
        category: { select: { id: true, key: true, name: true, icon: true } },
        brand: { select: { id: true, name: true } },
        _count: { select: { devices: true } },
      },
      orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

// GET /models/:id — Get single model detail
router.get('/models/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const model = await prisma.deviceModel.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        brand: true,
        devices: {
          select: {
            id: true, name: true, deviceSerial: true, healthStatus: true,
            isActive: true, org: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json({ model });
  } catch (err) {
    next(err);
  }
});

// POST /models — Create a device model
router.post('/models', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const {
      categoryId, brandId, name, adapterKey, connectionType, syncMode,
      setupSchema, eventMappingSchema, capabilities, supportedActions,
    } = req.body;

    if (!categoryId || !brandId || !name || !connectionType) {
      return res.status(400).json({ error: 'categoryId, brandId, name, and connectionType are required' });
    }

    // Validate foreign keys
    const [category, brand] = await Promise.all([
      prisma.deviceCategory.findUnique({ where: { id: categoryId } }),
      prisma.deviceBrand.findUnique({ where: { id: brandId } }),
    ]);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const model = await prisma.deviceModel.create({
      data: {
        categoryId,
        brandId,
        name,
        adapterKey: adapterKey || null,
        connectionType,
        syncMode: syncMode || 'PUSH',
        setupSchema: setupSchema || null,
        eventMappingSchema: eventMappingSchema || null,
        capabilities: capabilities || null,
        supportedActions: supportedActions || [],
      },
      include: { category: true, brand: true },
    });
    res.status(201).json({ model });
  } catch (err) {
    next(err);
  }
});

// PUT /models/:id — Update a device model
router.put('/models/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const {
      name, adapterKey, connectionType, syncMode, setupSchema,
      eventMappingSchema, capabilities, supportedActions, isActive,
    } = req.body;

    const model = await prisma.deviceModel.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(adapterKey !== undefined && { adapterKey }),
        ...(connectionType !== undefined && { connectionType }),
        ...(syncMode !== undefined && { syncMode }),
        ...(setupSchema !== undefined && { setupSchema }),
        ...(eventMappingSchema !== undefined && { eventMappingSchema }),
        ...(capabilities !== undefined && { capabilities }),
        ...(supportedActions !== undefined && { supportedActions }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true, brand: true },
    });
    res.json({ model });
  } catch (err) {
    next(err);
  }
});

// DELETE /models/:id — Delete (only if no devices assigned)
router.delete('/models/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const count = await prisma.device.count({ where: { modelId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete model with assigned devices' });
    }
    await prisma.deviceModel.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE HEALTH OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

// GET /health — Aggregated health stats across all devices
router.get('/health', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const [total, byHealth, byType] = await Promise.all([
      prisma.device.count({ where: { isActive: true } }),
      prisma.device.groupBy({
        by: ['healthStatus'],
        where: { isActive: true },
        _count: true,
      }),
      prisma.device.groupBy({
        by: ['deviceType'],
        where: { isActive: true },
        _count: true,
      }),
    ]);

    res.json({
      total,
      byHealth: Object.fromEntries(byHealth.map(h => [h.healthStatus, h._count])),
      byType: Object.fromEntries(byType.map(t => [t.deviceType, t._count])),
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RAW LOGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /raw-logs — Paginated raw logs (for debugging)
router.get('/raw-logs', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { orgId, deviceId, status, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (deviceId) where.deviceId = deviceId;
    if (status) where.processingStatus = status;

    const [logs, total] = await Promise.all([
      prisma.deviceRawLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
        include: {
          device: { select: { id: true, name: true, deviceSerial: true } },
          org: { select: { id: true, name: true } },
        },
      }),
      prisma.deviceRawLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
