// ─────────────────────────────────────────────────────────────────────────────
// Bonus Routes — Plans, calculation, approval, employee view
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const bonusService = require('../../services/bonus.service');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN MANAGEMENT (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/plans', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const { type, status, fiscalYear } = req.query;
    const plans = await bonusService.listPlans({ orgId: req.orgId, type, status, fiscalYear });
    res.json({ plans });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/plans/:id', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const plan = await bonusService.getPlan(req.orgId, req.params.id);
    res.json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/plans', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const plan = await bonusService.createPlan({ orgId: req.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/plans/:id', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const plan = await bonusService.updatePlan({ orgId: req.orgId, planId: req.params.id, data: req.body, adminId: req.user.id, req });
    res.json({ plan });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/plans/:id', requirePermission('bonus.manage'), async (req, res) => {
  try {
    await bonusService.deletePlan({ orgId: req.orgId, planId: req.params.id, adminId: req.user.id, req });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/plans/:id/calculate', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const { fiscalYear, bonusMonth } = req.body;
    const result = await bonusService.calculateBonuses({
      orgId: req.orgId, planId: req.params.id, fiscalYear, bonusMonth,
      adminId: req.user.id, req,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BONUS RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/records', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const { fiscalYear, bonusMonth, status, planId, department } = req.query;
    const records = await bonusService.listBonuses({ orgId: req.orgId, fiscalYear, bonusMonth, status, planId, department });
    res.json({ records });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/my', async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    const bonuses = await bonusService.getMyBonuses({ orgId: req.orgId, employeeId: req.user.id, fiscalYear });
    res.json({ bonuses });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/records/:id/review', requirePermission('bonus.approve'), async (req, res) => {
  try {
    const { action, notes } = req.body;
    const bonus = await bonusService.reviewBonus({ orgId: req.orgId, bonusId: req.params.id, action, adminId: req.user.id, notes, req });
    res.json({ bonus });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/records/bulk-review', requirePermission('bonus.approve'), async (req, res) => {
  try {
    const { bonusIds, action } = req.body;
    const result = await bonusService.bulkReview({ orgId: req.orgId, bonusIds, action, adminId: req.user.id, req });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/records/mark-paid', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const { bonusIds } = req.body;
    const result = await bonusService.markPaid({ orgId: req.orgId, bonusIds, adminId: req.user.id, req });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/summary', requirePermission('bonus.manage'), async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    const summary = await bonusService.getSummary({ orgId: req.orgId, fiscalYear });
    res.json(summary);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
