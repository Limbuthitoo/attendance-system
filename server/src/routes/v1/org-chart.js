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
      },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });

    // Build tree grouped by department
    const deptMap = new Map();
    employees.forEach(emp => {
      const dept = emp.department || 'General';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { id: `dept-${dept}`, name: dept, department: dept, designation: 'Department', children: [] });
      }
      deptMap.get(dept).children.push({ ...emp, children: [] });
    });

    const tree = Array.from(deptMap.values());

    res.json({ tree, flat: employees });
  } catch (err) { next(err); }
});

// PUT /api/v1/org-chart/:employeeId/department
router.put('/:employeeId/department', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { department, designation } = req.body;

    const data = {};
    if (department !== undefined) data.department = department;
    if (designation !== undefined) data.designation = designation;

    const employee = await prisma.employee.update({
      where: { id: req.params.employeeId, orgId: req.orgId },
      data,
      select: { id: true, name: true, department: true, designation: true },
    });
    res.json({ employee });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Employee not found' });
    next(err);
  }
});

module.exports = router;
