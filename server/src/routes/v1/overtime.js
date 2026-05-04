// ─────────────────────────────────────────────────────────────────────────────
// Overtime Routes (v1) — Policies, records, approvals
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const overtimeService = require('../../services/overtime.service');

const router = Router();

// ── Policies ────────────────────────────────────────────────────────────────

// GET /api/v1/overtime/policies
router.get('/policies', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const policies = await overtimeService.listPolicies({ orgId: req.orgId });
    res.json({ policies });
  } catch (err) { next(err); }
});

// POST /api/v1/overtime/policies
router.post('/policies', requireRole('org_admin'), async (req, res, next) => {
  try {
    const policy = await overtimeService.createPolicy({
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ policy });
  } catch (err) { next(err); }
});

// PUT /api/v1/overtime/policies/:id
router.put('/policies/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const policy = await overtimeService.updatePolicy({
      orgId: req.orgId,
      policyId: req.params.id,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ policy });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Records ─────────────────────────────────────────────────────────────────

// GET /api/v1/overtime/records
router.get('/records', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, status, startDate, endDate, page, limit } = req.query;
    const data = await overtimeService.listOvertimeRecords({
      orgId: req.orgId,
      employeeId,
      status,
      startDate,
      endDate,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/v1/overtime/my
router.get('/my', async (req, res, next) => {
  try {
    const { startDate, endDate, page, limit } = req.query;
    const data = await overtimeService.listOvertimeRecords({
      orgId: req.orgId,
      employeeId: req.user.id,
      startDate,
      endDate,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });
    res.json(data);
  } catch (err) { next(err); }
});

// PUT /api/v1/overtime/records/:id/review
router.put('/records/:id/review', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }
    const record = await overtimeService.reviewOvertime({
      orgId: req.orgId,
      recordId: req.params.id,
      status,
      adminId: req.user.id,
      req,
    });
    res.json({ record });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/overtime/summary
router.get('/summary', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const data = await overtimeService.getOvertimeSummary({ orgId: req.orgId, startDate, endDate });
    res.json({ employees: data });
  } catch (err) { next(err); }
});

module.exports = router;
