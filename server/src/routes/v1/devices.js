// ─────────────────────────────────────────────────────────────────────────────
// Device Routes (v1) — Unified device management + event ingestion
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/auth.new');
const { authenticateDevice } = require('../../middleware/deviceAuth.new');
const { tenantContext } = require('../../middleware/tenantContext');
const deviceService = require('../../services/device.service');
const { getAdapter, getAdapterByCredentialType, listAdapters } = require('../../adapters');
const { publishEvent } = require('../../config/redis');

const router = Router();

// ── Device-authenticated routes (called by physical devices) ────────────────

// POST /api/v1/devices/event — Device reports a credential scan
router.post('/event', authenticateDevice, tenantContext, async (req, res, next) => {
  try {
    const { credentialType, credentialData } = req.body;

    if (!credentialType || !credentialData) {
      return res.status(400).json({ error: 'credentialType and credentialData are required' });
    }

    // Validate credential through the appropriate adapter
    try {
      const adapter = getAdapterByCredentialType(credentialType);
      const validation = adapter.validateCredential(credentialData);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    } catch {
      // Unknown credential type — let handleDeviceEvent deal with it
    }

    const result = await deviceService.handleDeviceEvent({
      deviceId: req.device.id,
      orgId: req.device.orgId,
      branchId: req.device.branchId,
      credentialType,
      credentialData,
    });

    // Publish real-time event for admin dashboards
    if (result.success) {
      await publishEvent(`org:${req.device.orgId}:device-events`, {
        deviceId: req.device.id,
        action: result.action,
        employee: result.employee,
        timestamp: new Date().toISOString(),
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/devices/heartbeat — Device reports it's alive
router.post('/heartbeat', authenticateDevice, async (req, res, next) => {
  try {
    await deviceService.recordHeartbeat(req.device.id);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

// ── Admin-authenticated routes (web dashboard) ─────────────────────────────

// GET /api/v1/devices — List devices for the org
router.get('/', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { branchId, deviceType } = req.query;
    const devices = await deviceService.listDevices({
      orgId: req.orgId,
      branchId,
      deviceType,
    });
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/devices — Register a new device
router.post('/', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { branchId, deviceType, deviceSerial, name, location } = req.body;

    if (!deviceType || !deviceSerial) {
      return res.status(400).json({ error: 'deviceType and deviceSerial are required' });
    }

    const result = await deviceService.registerDevice({
      orgId: req.orgId,
      branchId,
      deviceType,
      deviceSerial,
      name,
      location,
      adminId: req.user.id,
      req,
    });

    res.status(201).json({
      device: result.device,
      apiKey: result.apiKey, // IMPORTANT: shown once only
      message: 'Device registered. Save the API key — it will not be shown again.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/devices/:id/deactivate
router.put('/:id/deactivate', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    await deviceService.deactivateDevice({
      deviceId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Device deactivated' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/devices/:id/rotate-key
router.post('/:id/rotate-key', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const result = await deviceService.rotateDeviceKey({
      deviceId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({
      apiKey: result.apiKey,
      message: 'API key rotated. Save the new key — it will not be shown again.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Credential management ────────────────────────────────────────────────────

// POST /api/v1/devices/credentials — Assign credential to employee
router.post('/credentials', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, credentialType, credentialData, label } = req.body;

    if (!employeeId || !credentialType || !credentialData) {
      return res.status(400).json({ error: 'employeeId, credentialType, and credentialData are required' });
    }

    // Validate credential through adapter
    try {
      const adapter = getAdapterByCredentialType(credentialType);
      const validation = adapter.validateCredential(credentialData);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const credential = await deviceService.assignCredential({
      orgId: req.orgId,
      employeeId,
      credentialType,
      credentialData,
      label,
      adminId: req.user.id,
      req,
    });

    res.status(201).json({ credential, message: 'Credential assigned' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/devices/credentials — List credentials (optionally filtered by employee)
router.get('/credentials', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, credentialType } = req.query;
    const credentials = await deviceService.listCredentials({
      orgId: req.orgId,
      employeeId,
      credentialType,
    });
    res.json({ credentials });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/devices/credentials/:id — Deactivate a credential
router.delete('/credentials/:id', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    await deviceService.deactivateCredential({
      credentialId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Credential deactivated' });
  } catch (err) {
    next(err);
  }
});

// ── Device detail & update ──────────────────────────────────────────────────

// GET /api/v1/devices/:id — Get single device details
router.get('/:id', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const device = await deviceService.getDevice({ deviceId: req.params.id, orgId: req.orgId });
    res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/devices/:id — Update device info (name, location, branch)
router.put('/:id', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { name, location, branchId } = req.body;
    const device = await deviceService.updateDevice({
      deviceId: req.params.id,
      orgId: req.orgId,
      name,
      location,
      branchId,
      adminId: req.user.id,
      req,
    });
    res.json({ device });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/v1/devices/:id/reactivate
router.put('/:id/reactivate', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const device = await deviceService.reactivateDevice({
      deviceId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ device, message: 'Device reactivated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Device events (audit) ──────────────────────────────────────────────────

// GET /api/v1/devices/events/list — Device event log
router.get('/events/list', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { deviceId, employeeId, eventType, startDate, endDate, page = 1, limit = 50 } = req.query;
    const events = await deviceService.listDeviceEvents({
      orgId: req.orgId,
      deviceId,
      employeeId,
      eventType,
      startDate,
      endDate,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ── Adapter info ────────────────────────────────────────────────────────────

// GET /api/v1/devices/adapters/info — List supported device types & capabilities
router.get('/adapters/info', authenticate, tenantContext, async (req, res, next) => {
  try {
    res.json({ adapters: listAdapters() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
