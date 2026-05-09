// ─────────────────────────────────────────────────────────────────────────────
// Incentive Routes — Plans, calculation, approval, employee view
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const incentiveService = require('../../services/incentive.service');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN MANAGEMENT (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// List all incentive plans
router.get('/plans', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const { status, type } = req.query;
    const plans = await incentiveService.listPlans({ orgId: req.orgId, status, type });
    res.json({ plans });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Get single plan
router.get('/plans/:id', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const plan = await incentiveService.getPlan(req.orgId, req.params.id);
    res.json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Create plan
router.post('/plans', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const plan = await incentiveService.createPlan({
      orgId: req.orgId, data: req.body, adminId: req.user.id, req,
    });
    res.status(201).json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update plan
router.put('/plans/:id', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const plan = await incentiveService.updatePlan({
      orgId: req.orgId, planId: req.params.id, data: req.body, adminId: req.user.id, req,
    });
    res.json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Delete plan
router.delete('/plans/:id', requirePermission('incentive.manage'), async (req, res) => {
  try {
    await incentiveService.deletePlan({
      orgId: req.orgId, planId: req.params.id, adminId: req.user.id, req,
    });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

// Calculate incentives for a plan
router.post('/calculate', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const { planId, year, month } = req.body;
    if (!planId || !year || !month) {
      return res.status(400).json({ error: 'planId, year, and month are required' });
    }
    const result = await incentiveService.calculateIncentives({
      orgId: req.orgId, planId, year: Number(year), month: Number(month),
      adminId: req.user.id, req,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INCENTIVE RECORDS (admin view)
// ═══════════════════════════════════════════════════════════════════════════════

// List incentive records (with filters)
router.get('/', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const { planId, status, employeeId, year, month, page, limit } = req.query;
    const result = await incentiveService.listIncentives({
      orgId: req.orgId, planId, status, employeeId,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE SELF-SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

// My incentives
router.get('/my', async (req, res) => {
  try {
    const { year } = req.query;
    const incentives = await incentiveService.getMyIncentives({
      orgId: req.orgId, employeeId: req.user.id,
      year: year ? Number(year) : undefined,
    });
    res.json({ incentives });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL
// ═══════════════════════════════════════════════════════════════════════════════

// Approve / Reject single incentive
router.post('/:id/review', requirePermission('incentive.approve'), async (req, res) => {
  try {
    const { action, approvedAmount, reviewNote } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }
    const result = await incentiveService.reviewIncentive({
      orgId: req.orgId, incentiveId: req.params.id,
      action, approvedAmount, reviewNote,
      adminId: req.user.id, req,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Bulk approve / reject
router.post('/bulk-review', requirePermission('incentive.approve'), async (req, res) => {
  try {
    const { incentiveIds, action } = req.body;
    if (!Array.isArray(incentiveIds) || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'incentiveIds array and action ("approve"/"reject") are required' });
    }
    const result = await incentiveService.bulkReview({
      orgId: req.orgId, incentiveIds, action, adminId: req.user.id, req,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/adjust', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const { adjustmentType, amount, reason } = req.body;
    if (!adjustmentType || amount === undefined || !reason) {
      return res.status(400).json({ error: 'adjustmentType, amount, and reason are required' });
    }
    const adjustment = await incentiveService.createAdjustment({
      orgId: req.orgId, incentiveId: req.params.id,
      adjustmentType, amount: Number(amount), reason,
      adminId: req.user.id, req,
    });
    res.json(adjustment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY / REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/summary', requirePermission('incentive.manage'), async (req, res) => {
  try {
    const { year, month } = req.query;
    const summary = await incentiveService.getIncentiveSummary({
      orgId: req.orgId,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
    res.json(summary);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
