// ─────────────────────────────────────────────────────────────────────────────
// V1 Branch Routes — Org-admin branch management
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth.new');
const branchService = require('../../services/branch.service');

const router = Router();

// GET /api/v1/branches — List branches for the current org
router.get('/', async (req, res, next) => {
  try {
    const branches = await branchService.listBranches(req.orgId);
    res.json({ branches });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/branches/:id — Get branch details
router.get('/:id', async (req, res, next) => {
  try {
    const branch = await branchService.getBranch(req.params.id, req.orgId);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json({ branch });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/branches — Create branch (admin only)
router.post('/', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const branch = await branchService.createBranch({
      orgId: req.orgId,
      data: req.body,
      actorId: req.user.id,
      req,
    });
    res.status(201).json({ branch, message: 'Branch created' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/branches/:id — Update branch (admin only)
router.put('/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch({
      branchId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      actorId: req.user.id,
      req,
    });
    res.json({ branch, message: 'Branch updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/branches/:id — Deactivate branch (admin only)
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await branchService.deactivateBranch({
      branchId: req.params.id,
      orgId: req.orgId,
      actorId: req.user.id,
      req,
    });
    res.json({ message: 'Branch deactivated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
