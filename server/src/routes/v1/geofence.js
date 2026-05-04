// ─────────────────────────────────────────────────────────────────────────────
// Geofence Routes (v1) — Branch geofence config & location validation
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const geofenceService = require('../../services/geofence.service');

const router = Router();

// GET /api/v1/geofence — List all branch geofences (admin map)
router.get('/', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const branches = await geofenceService.listGeofences({ orgId: req.orgId });
    res.json({ branches });
  } catch (err) { next(err); }
});

// GET /api/v1/geofence/:branchId — Get single branch geofence
router.get('/:branchId', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const branch = await geofenceService.getBranchGeofence({ orgId: req.orgId, branchId: req.params.branchId });
    res.json({ branch });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/geofence/:branchId — Update branch geofence settings
router.put('/:branchId', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { latitude, longitude, geofenceRadius, geofenceEnabled } = req.body;
    const branch = await geofenceService.updateBranchGeofence({
      orgId: req.orgId,
      branchId: req.params.branchId,
      latitude,
      longitude,
      geofenceRadius,
      geofenceEnabled,
      adminId: req.user.id,
      req,
    });
    res.json({ branch });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/geofence/validate — Validate employee's current location
router.post('/validate', async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const result = await geofenceService.validateLocation({
      orgId: req.orgId,
      employeeId: req.user.id,
      latitude,
      longitude,
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
