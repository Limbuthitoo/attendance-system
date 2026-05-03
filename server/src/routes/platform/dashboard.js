// ─────────────────────────────────────────────────────────────────────────────
// Platform Dashboard Routes — Aggregate platform statistics
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const orgService = require('../../services/organization.service');

const router = Router();

// GET /api/platform/dashboard
router.get('/', async (req, res, next) => {
  try {
    const stats = await orgService.getPlatformStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
