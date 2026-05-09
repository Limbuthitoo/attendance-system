const { Router } = require('express');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// GET /api/v1/org-chart
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const employees = await prisma.employee.findMany({
      where: { orgId: req.orgId, isActive: true },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        department: true,
        designation: true,
        reportingManagerId: true,
      },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });

    // Build tree structure
    const map = new Map();
    const roots = [];

    employees.forEach(emp => {
      map.set(emp.id, { ...emp, children: [] });
    });

    employees.forEach(emp => {
      const node = map.get(emp.id);
      if (emp.reportingManagerId && map.has(emp.reportingManagerId)) {
        map.get(emp.reportingManagerId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    res.json({ tree: roots, flat: employees });
  } catch (err) { next(err); }
});

// PUT /api/v1/org-chart/:employeeId/manager
router.put('/:employeeId/manager', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { managerId } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.employeeId, orgId: req.orgId },
      data: { reportingManagerId: managerId || null },
      select: { id: true, name: true, reportingManagerId: true },
    });
    res.json({ employee });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Employee not found' });
    next(err);
  }
});

module.exports = router;
