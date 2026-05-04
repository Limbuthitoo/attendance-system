// ─────────────────────────────────────────────────────────────────────────────
// Employee Routes (v1) — CRUD, profile, assignment
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const employeeService = require('../../services/employee.service');
const authService = require('../../services/auth.service');

const router = Router();

// GET /api/v1/employees — List employees (admin)
router.get('/', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { search, department, isActive, page, limit } = req.query;
    const result = await employeeService.listEmployees({
      orgId: req.orgId,
      search,
      department,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/employees/:id — Get employee detail
router.get('/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const employee = await employeeService.getEmployee(req.params.id, req.orgId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/employees — Create employee (admin)
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee({
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ employee, message: 'Employee created' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/employees/:id — Update employee (admin)
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const employee = await employeeService.updateEmployee({
      employeeId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ employee, message: 'Employee updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/employees/:id/reset-password — Admin reset password
router.post('/:id/reset-password', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required' });
    }

    await authService.adminResetPassword({
      adminId: req.user.id,
      employeeId: req.params.id,
      newPassword,
      req,
    });

    res.json({ message: 'Password reset. Employee must change on next login.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/employees/:id — Permanently delete employee (admin)
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await employeeService.deleteEmployee({
      employeeId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
