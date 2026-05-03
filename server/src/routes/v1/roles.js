// ─────────────────────────────────────────────────────────────────────────────
// V1 Role Routes — Org-admin RBAC management
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth.new');
const roleService = require('../../services/role.service');

const router = Router();

// GET /api/v1/roles — List all roles (system + org)
router.get('/', async (req, res, next) => {
  try {
    const roles = await roleService.listRoles(req.orgId);
    res.json({ roles });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/roles/permissions — List all available permissions
router.get('/permissions', (req, res) => {
  res.json(roleService.getAvailablePermissions());
});

// POST /api/v1/roles — Create a custom role (admin only)
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'name and permissions array are required' });
    }

    const role = await roleService.createRole({
      orgId: req.orgId,
      name,
      description,
      permissions,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ role, message: 'Role created' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/roles/:id — Update a custom role
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const role = await roleService.updateRole({
      roleId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ role, message: 'Role updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/roles/:id — Delete a custom role
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await roleService.deleteRole({
      roleId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Role deleted' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/roles/assign — Assign role to employee
router.post('/assign', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, roleId, branchId } = req.body;
    if (!employeeId || !roleId) {
      return res.status(400).json({ error: 'employeeId and roleId are required' });
    }

    const assignment = await roleService.assignRoleToEmployee({
      employeeId,
      roleId,
      branchId,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ assignment, message: 'Role assigned' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/roles/remove — Remove role from employee
router.post('/remove', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, roleId, branchId } = req.body;
    if (!employeeId || !roleId) {
      return res.status(400).json({ error: 'employeeId and roleId are required' });
    }

    await roleService.removeRoleFromEmployee({
      employeeId,
      roleId,
      branchId,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Role removed' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/roles/employee/:id — Get roles for an employee
router.get('/employee/:id', async (req, res, next) => {
  try {
    const roles = await roleService.getEmployeeRoles(req.params.id);
    res.json({ roles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
