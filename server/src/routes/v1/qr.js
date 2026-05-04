// ─────────────────────────────────────────────────────────────────────────────
// QR Attendance Routes (v1) — QR code generation, verification & mobile check-in
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');
const { authenticateDevice } = require('../../middleware/deviceAuth');
const { tenantContext } = require('../../middleware/tenantContext');
const qrService = require('../../services/qr.service');
const deviceService = require('../../services/device.service');

const router = Router();

// ── Device-authenticated routes (QR terminal displays rotating code) ────────

/**
 * POST /api/v1/qr/generate-location
 * Called by a QR_TERMINAL device to get a fresh QR code to display.
 * The device shows this QR on a screen; employees scan it with their phone.
 */
router.post('/generate-location', authenticateDevice, tenantContext, async (req, res, next) => {
  try {
    if (req.device.deviceType !== 'QR_TERMINAL') {
      return res.status(403).json({ error: 'Only QR_TERMINAL devices can generate location QR codes' });
    }

    const { ttlSeconds } = req.body;

    const result = await qrService.generateLocationQr({
      orgId: req.device.orgId,
      branchId: req.device.branchId,
      deviceId: req.device.id,
      ttlSeconds,
    });

    // Record heartbeat for the device
    await deviceService.recordHeartbeat(req.device.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/qr/verify-employee
 * Called by a QR_TERMINAL device when it scans an employee's personal QR code.
 */
router.post('/verify-employee', authenticateDevice, tenantContext, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const verification = await qrService.verifyEmployeeQr({
      token,
      orgId: req.device.orgId,
    });

    if (!verification.valid) {
      return res.status(400).json({ error: verification.error, success: false });
    }

    // Process attendance via unified device event handler
    const result = await deviceService.handleDeviceEvent({
      deviceId: req.device.id,
      orgId: req.device.orgId,
      branchId: req.device.branchId,
      credentialType: 'QR_CODE',
      credentialData: verification.qrData.token,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Employee-authenticated routes (mobile app) ─────────────────────────────

/**
 * POST /api/v1/qr/my-code
 * Employee requests a personal QR code to show on their phone screen.
 * A QR_TERMINAL scans this code.
 */
router.post('/my-code', authenticate, tenantContext, async (req, res, next) => {
  try {
    const result = await qrService.generateEmployeeQr({
      employeeId: req.user.id,
      orgId: req.orgId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/qr/scan
 * Employee scanned a location QR code from their mobile app.
 * Records attendance based on the QR token.
 */
router.post('/scan', authenticate, tenantContext, async (req, res, next) => {
  try {
    const { qrToken, latitude, longitude } = req.body;
    if (!qrToken) {
      return res.status(400).json({ error: 'qrToken is required' });
    }

    // Extract token from QR payload (could be raw token or JSON payload)
    let token = qrToken;
    try {
      const parsed = JSON.parse(qrToken);
      if (parsed.t) token = parsed.t;
    } catch {
      // Not JSON, use as-is
    }

    const result = await qrService.mobileQrCheckIn({
      employeeId: req.user.id,
      orgId: req.orgId,
      qrToken: token,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Admin routes ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/qr/stats
 * QR attendance stats for today.
 */
router.get('/stats', authenticate, tenantContext, requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { branchId } = req.query;
    const stats = await qrService.getQrStats({ orgId: req.orgId, branchId });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
