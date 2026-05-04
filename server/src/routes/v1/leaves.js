// ─────────────────────────────────────────────────────────────────────────────
// Leave Routes (v1) — Apply, review, cancel, history
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const leaveService = require('../../services/leave.service');
const { addSnakeCase, lowercaseEnum } = require('../../lib/compat');

const router = Router();

// Transform leave for response — add snake_case aliases + lowercase enums
function transformLeave(l) {
  if (!l) return l;
  const t = addSnakeCase(l);
  if (t.status) { t.status = lowercaseEnum(t.status); }
  if (t.leaveType) { t.leave_type = lowercaseEnum(t.leaveType); t.leaveType = lowercaseEnum(t.leaveType); }
  // Convert dates to plain YYYY-MM-DD strings for backward compat
  if (t.startDate instanceof Date) {
    const ds = t.startDate.toISOString().slice(0, 10);
    t.start_date = ds; t.startDate = ds;
  }
  if (t.endDate instanceof Date) {
    const ds = t.endDate.toISOString().slice(0, 10);
    t.end_date = ds; t.endDate = ds;
  }
  if (t.createdAt instanceof Date) t.created_at = t.createdAt.toISOString();
  if (t.updatedAt instanceof Date) t.updated_at = t.updatedAt.toISOString();
  // Flatten employee name for backward compat
  if (t.employee) {
    t.name = t.employee.name;
    t.emp_code = t.employee.employeeCode || t.employee.employee_code;
    t.department = t.employee.department;
  }
  if (t.reviewer) {
    t.reviewer_name = t.reviewer.name;
  }
  return t;
}

// POST /api/v1/leaves — Apply for leave
router.post('/', async (req, res, next) => {
  try {
    // Accept both camelCase and snake_case
    const leaveType = req.body.leaveType || req.body.leave_type;
    const startDate = req.body.startDate || req.body.start_date;
    const endDate = req.body.endDate || req.body.end_date;
    const reason = req.body.reason;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'leaveType, startDate, endDate, and reason are required' });
    }

    // Normalize leave type to uppercase enum
    const normalizedType = leaveType.toUpperCase();

    const leave = await leaveService.applyLeave({
      employeeId: req.user.id,
      orgId: req.orgId,
      leaveType: normalizedType,
      startDate,
      endDate,
      reason,
      req,
    });

    res.status(201).json({ leave: transformLeave(leave), message: 'Leave request submitted' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/leaves/my — Current user's leaves
router.get('/my', async (req, res, next) => {
  try {
    const { year, status } = req.query;
    const leaves = await leaveService.getEmployeeLeaves({
      employeeId: req.user.id,
      orgId: req.orgId,
      year: year ? parseInt(year) : null,
      status: status ? status.toUpperCase() : null,
    });
    res.json({ leaves: leaves.map(transformLeave) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leaves/all — Admin: all leaves (with optional status filter)
router.get('/all', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const leaves = await leaveService.getAllLeaves({
      orgId: req.orgId,
      status: status ? status.toUpperCase() : null,
    });
    res.json({ leaves: leaves.map(transformLeave) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leaves/pending — Admin: pending leaves
router.get('/pending', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const leaves = await leaveService.getPendingLeaves(req.orgId);
    res.json({ leaves: leaves.map(transformLeave) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/leaves/:id/review — Admin: approve/reject
router.put('/:id/review', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    // Accept both camelCase and snake_case, both upper and lowercase status
    const rawStatus = req.body.status || '';
    const status = rawStatus.toUpperCase();
    const reviewNote = req.body.reviewNote || req.body.review_note;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }

    const leave = await leaveService.reviewLeave({
      leaveId: req.params.id,
      orgId: req.orgId,
      reviewerId: req.user.id,
      status,
      reviewNote,
      req,
    });

    res.json({ leave: transformLeave(leave), message: `Leave ${status.toLowerCase()}` });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/leaves/:id — Cancel own pending leave
router.delete('/:id', async (req, res, next) => {
  try {
    await leaveService.cancelLeave({
      leaveId: req.params.id,
      employeeId: req.user.id,
      orgId: req.orgId,
      req,
    });
    res.json({ message: 'Leave request cancelled' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
