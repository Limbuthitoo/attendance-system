// ─────────────────────────────────────────────────────────────────────────────
// Platform Organization Routes — CRUD, subscription, modules
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireSuperAdmin } = require('../../middleware/platformAuth');
const orgService = require('../../services/organization.service');
const branchService = require('../../services/branch.service');

const router = Router();

// GET /api/platform/organizations — List all organizations
router.get('/', async (req, res, next) => {
  try {
    const { search, status, plan, page, limit } = req.query;
    const result = await orgService.listOrganizations({
      search,
      status,
      plan,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/organizations/:id — Get organization details
router.get('/:id', async (req, res, next) => {
  try {
    const org = await orgService.getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/organizations — Create organization
router.post('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug, domain, plan, adminEmail, adminPassword, adminName } = req.body;

    if (!name || !adminEmail || !adminPassword) {
      return res.status(400).json({
        error: 'name, adminEmail, and adminPassword are required',
      });
    }

    const result = await orgService.createOrganization({
      name,
      slug,
      domain,
      plan: plan || 'TRIAL',
      adminEmail,
      adminPassword,
      adminName,
      platformUserId: req.platformUser.id,
    });

    res.status(201).json({
      organization: result.org,
      branch: result.branch,
      admin: { id: result.admin.id, email: result.admin.email },
      message: 'Organization created with default branch, shift, schedule, and admin user.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/platform/organizations/:id — Update organization
router.put('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const org = await orgService.updateOrganization({
      orgId: req.params.id,
      data: req.body,
      platformUserId: req.platformUser.id,
    });
    res.json({ organization: org, message: 'Organization updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/platform/organizations/:id/suspend
router.put('/:id/suspend', requireSuperAdmin, async (req, res, next) => {
  try {
    await orgService.suspendOrganization({
      orgId: req.params.id,
      platformUserId: req.platformUser.id,
    });
    res.json({ message: 'Organization suspended' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/organizations/:id/reactivate
router.put('/:id/reactivate', requireSuperAdmin, async (req, res, next) => {
  try {
    await orgService.reactivateOrganization({
      orgId: req.params.id,
      platformUserId: req.platformUser.id,
    });
    res.json({ message: 'Organization reactivated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/organizations/:id/modules — Set enabled modules
router.put('/:id/modules', requireSuperAdmin, async (req, res, next) => {
  try {
    const { moduleCodes } = req.body;
    if (!moduleCodes || !Array.isArray(moduleCodes)) {
      return res.status(400).json({ error: 'moduleCodes array is required' });
    }

    const modules = await orgService.setOrgModules({
      orgId: req.params.id,
      moduleCodes,
      platformUserId: req.platformUser.id,
    });
    res.json({ modules, message: 'Modules updated' });
  } catch (err) {
    next(err);
  }
});

// ── Branch management (platform-level) ──────────────────────────────────────

// GET /api/platform/organizations/:id/branches
router.get('/:id/branches', async (req, res, next) => {
  try {
    const branches = await branchService.listBranches(req.params.id);
    res.json({ branches });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/organizations/:id/branches
router.post('/:id/branches', requireSuperAdmin, async (req, res, next) => {
  try {
    const branch = await branchService.createBranch({
      orgId: req.params.id,
      data: req.body,
      actorId: req.platformUser.id,
      actorType: 'platform_user',
    });
    res.status(201).json({ branch, message: 'Branch created' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
