// ─────────────────────────────────────────────────────────────────────────────
// Policy Routes (v1) — CRUD for organization policies
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// GET /api/v1/policies — List all active policies (all employees can view)
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { category } = req.query;

    const where = { orgId: req.orgId, isActive: true };
    if (category) where.category = category.toUpperCase();

    const policies = await prisma.policy.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policies/all — Admin: list all including inactive
router.get('/all', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const policies = await prisma.policy.findMany({
      where: { orgId: req.orgId },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/policies/:id — Get single policy
router.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const policy = await prisma.policy.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: { creator: { select: { id: true, name: true } } },
    });

    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/policies — Create policy (admin only)
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { title, category, content, isActive, sortOrder } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({ error: 'title, category, and content are required' });
    }

    const policy = await prisma.policy.create({
      data: {
        orgId: req.orgId,
        title,
        category: category.toUpperCase(),
        content,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
        createdBy: req.user.id,
      },
    });

    res.status(201).json({ policy });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/policies/:id — Update policy (admin only)
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { title, category, content, isActive, sortOrder } = req.body;

    const existing = await prisma.policy.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });

    if (!existing) return res.status(404).json({ error: 'Policy not found' });

    const policy = await prisma.policy.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category: category.toUpperCase() }),
        ...(content !== undefined && { content }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    res.json({ policy });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/policies/:id — Delete policy (admin only)
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();

    const existing = await prisma.policy.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });

    if (!existing) return res.status(404).json({ error: 'Policy not found' });

    await prisma.policy.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
