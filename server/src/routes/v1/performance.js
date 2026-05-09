// ─────────────────────────────────────────────────────────────────────────────
// Performance / KPI Routes
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const perfService = require('../../services/performance.service');

const router = Router();

// ── KPI Definitions ──────────────────────────────────────────────────────────

router.get('/kpis', async (req, res) => {
  try {
    const kpis = await perfService.listKpis({ orgId: req.orgId, department: req.query.department });
    res.json({ kpis });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/kpis', requirePermission('performance.manage'), async (req, res) => {
  try {
    const kpi = await perfService.createKpi({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ kpi });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/kpis/:id', requirePermission('performance.manage'), async (req, res) => {
  try {
    const kpi = await perfService.updateKpi({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ kpi });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/kpis/:id', requirePermission('performance.manage'), async (req, res) => {
  try {
    await perfService.deleteKpi({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── KPI Scores ───────────────────────────────────────────────────────────────

router.get('/scores', async (req, res) => {
  try {
    const scores = await perfService.listScores({ orgId: req.orgId, ...req.query });
    res.json({ scores });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/scores', requirePermission('performance.manage'), async (req, res) => {
  try {
    const score = await perfService.upsertScore({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.json({ score });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Review Cycles ────────────────────────────────────────────────────────────

router.get('/cycles', async (req, res) => {
  try {
    const cycles = await perfService.listCycles({ orgId: req.orgId, year: req.query.year });
    res.json({ cycles });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/cycles', requirePermission('performance.manage'), async (req, res) => {
  try {
    const cycle = await perfService.createCycle({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ cycle });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/cycles/:id', requirePermission('performance.manage'), async (req, res) => {
  try {
    const cycle = await perfService.updateCycle({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ cycle });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Performance Reviews ──────────────────────────────────────────────────────

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await perfService.listReviews({ orgId: req.orgId, cycleId: req.query.cycleId, employeeId: req.query.employeeId });
    res.json({ reviews });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/reviews', requirePermission('performance.manage'), async (req, res) => {
  try {
    const review = await perfService.createReview({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ review });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/reviews/:id', requirePermission('performance.manage'), async (req, res) => {
  try {
    const review = await perfService.updateReview({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ review });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
