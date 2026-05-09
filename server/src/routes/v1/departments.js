// ─────────────────────────────────────────────────────────────────────────────
// Department & Designation Routes (v1)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');

const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ── Departments ──────────────────────────────────────────────────────────────

// GET /api/v1/departments
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const departments = await prisma.department.findMany({
      where: { orgId: req.orgId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/departments
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, code, parentId, headId, sortOrder } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }
    const department = await prisma.department.create({
      data: {
        orgId: req.orgId,
        name: name.trim(),
        code: code?.trim() || null,
        parentId: parentId || null,
        headId: headId || null,
        sortOrder: sortOrder || 0,
      },
    });
    res.status(201).json({ department });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A department with this name already exists' });
    }
    next(err);
  }
});

// PUT /api/v1/departments/:id
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, code, parentId, headId, isActive, sortOrder } = req.body;
    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(headId !== undefined && { headId: headId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json({ department });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A department with this name already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Department not found' });
    }
    next(err);
  }
});

// DELETE /api/v1/departments/:id
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    // Check if any employees use this department
    const dept = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const empCount = await prisma.employee.count({
      where: { orgId: req.orgId, department: dept.name, isActive: true },
    });
    if (empCount > 0) {
      return res.status(400).json({ error: `Cannot delete: ${empCount} active employee(s) in this department` });
    }

    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Department not found' });
    }
    next(err);
  }
});

module.exports = router;
