// ─────────────────────────────────────────────────────────────────────────────
// Platform Plan Routes — CRUD for subscription plans
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireSuperAdmin } = require('../../middleware/platformAuth');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// GET /api/platform/plans — List all plans
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { organizations: true } },
      },
    });
    res.json({
      plans: plans.map((p) => ({
        ...p,
        organizationCount: p._count.organizations,
        _count: undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/plans/:id — Get single plan
router.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { organizations: true } } },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({
      plan: { ...plan, organizationCount: plan._count.organizations, _count: undefined },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/plans — Create plan
router.post('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, code, description, price, currency, billingCycle, maxEmployees, maxBranches, maxDevices, trialDays, features, sortOrder, backupRetentionDays } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required' });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        code: code.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        description: description || '',
        price: parseInt(price) || 0,
        currency: currency || 'NPR',
        billingCycle: billingCycle || 'monthly',
        maxEmployees: parseInt(maxEmployees) || 10,
        maxBranches: parseInt(maxBranches) || 1,
        maxDevices: parseInt(maxDevices) || 2,
        trialDays: parseInt(trialDays) || 0,
        features: features || [],
        sortOrder: parseInt(sortOrder) || 0,
        backupRetentionDays: parseInt(backupRetentionDays) || 7,
      },
    });
    res.status(201).json({ plan, message: 'Plan created' });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Plan name or code already exists' });
    }
    next(err);
  }
});

// PUT /api/platform/plans/:id — Update plan
router.put('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const data = {};
    const { name, description, price, currency, billingCycle, maxEmployees, maxBranches, maxDevices, trialDays, features, sortOrder, isActive, backupRetentionDays } = req.body;

    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseInt(price);
    if (currency !== undefined) data.currency = currency;
    if (billingCycle !== undefined) data.billingCycle = billingCycle;
    if (maxEmployees !== undefined) data.maxEmployees = parseInt(maxEmployees);
    if (maxBranches !== undefined) data.maxBranches = parseInt(maxBranches);
    if (maxDevices !== undefined) data.maxDevices = parseInt(maxDevices);
    if (trialDays !== undefined) data.trialDays = parseInt(trialDays);
    if (features !== undefined) data.features = features;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (backupRetentionDays !== undefined) data.backupRetentionDays = parseInt(backupRetentionDays);

    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ plan, message: 'Plan updated' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Plan not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Plan name or code already exists' });
    next(err);
  }
});

// DELETE /api/platform/plans/:id — Delete plan (only if no orgs use it)
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const count = await prisma.organization.count({ where: { planId: req.params.id } });
    if (count > 0) {
      return res.status(409).json({
        error: `Cannot delete plan — ${count} organization(s) are using it. Reassign them first.`,
      });
    }
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Plan not found' });
    next(err);
  }
});

module.exports = router;
