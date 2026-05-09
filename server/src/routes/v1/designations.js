// ─────────────────────────────────────────────────────────────────────────────
// Designation Routes (v1)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');

const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// GET /api/v1/designations
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const designations = await prisma.designation.findMany({
      where: { orgId: req.orgId },
      orderBy: [{ sortOrder: 'asc' }, { level: 'asc' }, { name: 'asc' }],
    });
    res.json({ designations });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/designations
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, level, sortOrder } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Designation name is required' });
    }
    const designation = await prisma.designation.create({
      data: {
        orgId: req.orgId,
        name: name.trim(),
        level: level || 0,
        sortOrder: sortOrder || 0,
      },
    });
    res.status(201).json({ designation });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A designation with this name already exists' });
    }
    next(err);
  }
});

// PUT /api/v1/designations/:id
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, level, isActive, sortOrder } = req.body;
    const designation = await prisma.designation.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(level !== undefined && { level }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json({ designation });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A designation with this name already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Designation not found' });
    }
    next(err);
  }
});

// DELETE /api/v1/designations/:id
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const desig = await prisma.designation.findUnique({ where: { id: req.params.id } });
    if (!desig) return res.status(404).json({ error: 'Designation not found' });

    const empCount = await prisma.employee.count({
      where: { orgId: req.orgId, designation: desig.name, isActive: true },
    });
    if (empCount > 0) {
      return res.status(400).json({ error: `Cannot delete: ${empCount} active employee(s) with this designation` });
    }

    await prisma.designation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Designation deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Designation not found' });
    }
    next(err);
  }
});

module.exports = router;
