// ─────────────────────────────────────────────────────────────────────────────
// NFC Routes (v1) — NFC reader compatibility layer
// Bridges the old nfc-reader protocol to the new multi-tenant device service.
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/auth.new');
const { authenticateDevice } = require('../../middleware/deviceAuth.new');
const { tenantContext } = require('../../middleware/tenantContext');
const deviceService = require('../../services/device.service');
const prisma = require('../../lib/prisma').getPrisma();
const EventEmitter = require('events');

const router = Router();

// In-memory event bus for real-time SSE tap events
const nfcEventBus = new EventEmitter();
nfcEventBus.setMaxListeners(50);

// ─── Reader Heartbeat ───────────────────────────────────────────────────────

router.post('/heartbeat', authenticateDevice, async (req, res, next) => {
  try {
    const { device_id, reader_connected } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id required' });

    await deviceService.recordHeartbeat({
      deviceId: req.device.id,
      metadata: { reader_connected: !!reader_connected },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Reader Status (admin) ──────────────────────────────────────────────────

router.get('/reader-status', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { orgId: req.orgId, deviceType: 'NFC_READER', isActive: true },
      select: {
        id: true,
        deviceSerial: true,
        name: true,
        location: true,
        lastHeartbeat: true,
      },
    });

    const now = Date.now();
    const STALE_MS = 15000;
    const readers = devices.map(d => {
      const online = d.lastHeartbeat && (now - d.lastHeartbeat.getTime()) < STALE_MS;
      return {
        device_id: d.deviceSerial,
        name: d.name,
        online,
        reader_connected: online,
        last_seen: d.lastHeartbeat?.toISOString() || null,
      };
    });

    res.json({ readers, anyReaderConnected: readers.some(r => r.reader_connected) });
  } catch (err) { next(err); }
});

// ─── SSE: Real-time tap events (admin) ──────────────────────────────────────

router.get('/events', authenticate, tenantContext, requireRole('org_admin'), (req, res) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Type-Options');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();
  res.write(':\n\n');

  const orgId = req.orgId;
  const onTap = (data) => {
    if (data.orgId === orgId) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  nfcEventBus.on('nfc:tap', onTap);

  const keepAlive = setInterval(() => { res.write(':\n\n'); }, 15000);

  req.on('close', () => {
    nfcEventBus.off('nfc:tap', onTap);
    clearInterval(keepAlive);
  });
});

// ─── Recent Tap (polling fallback) ──────────────────────────────────────────

router.get('/recent-tap', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const since = req.query.since || new Date(Date.now() - 10000).toISOString();
    const tap = await prisma.deviceEvent.findFirst({
      where: {
        orgId: req.orgId,
        credentialType: 'NFC_CARD',
        eventTime: { gt: new Date(since) },
      },
      orderBy: { eventTime: 'desc' },
      include: { employee: { select: { name: true } } },
    });

    res.json({ tap: tap || null });
  } catch (err) { next(err); }
});

// ─── NFC Tap Ingestion (from reader service) ───────────────────────────────

router.post('/tap', authenticateDevice, async (req, res, next) => {
  try {
    const { cardUid, deviceId: deviceSerial, timestamp } = req.body;

    if (!cardUid || typeof cardUid !== 'string') {
      return res.status(400).json({ status: 'ERROR', error: 'cardUid is required' });
    }

    const device = req.device; // from authenticateDevice middleware
    const tapTime = timestamp || new Date().toISOString();

    const result = await deviceService.handleDeviceEvent({
      deviceId: device.id,
      orgId: device.orgId,
      branchId: device.branchId,
      credentialType: 'NFC_CARD',
      credentialData: cardUid.toUpperCase(),
    });

    // Build backward-compatible response for old nfc-reader client
    let status, message, payload;

    if (!result.success) {
      if (result.action === 'unknown') {
        status = 'UNKNOWN_CARD';
        message = 'Card not registered';
      } else {
        status = 'INACTIVE_CARD';
        message = result.error;
      }
      payload = { status, message, cardUid, time: tapTime, deviceId: deviceSerial };
    } else {
      const empName = result.employee?.name || 'Employee';
      if (result.action === 'CHECK_IN') {
        status = 'CHECKED_IN';
        message = `${empName} checked in`;
      } else if (result.action === 'CHECK_OUT') {
        status = 'CHECKED_OUT';
        message = `${empName} checked out`;
      } else {
        status = 'DUPLICATE_IGNORED';
        message = `${empName} already completed today`;
      }
      payload = {
        status,
        message,
        employee: empName,
        time: tapTime,
        deviceId: deviceSerial,
      };
    }

    // Emit SSE event
    nfcEventBus.emit('nfc:tap', { ...payload, orgId: device.orgId });

    res.json(payload);
  } catch (err) { next(err); }
});

// ─── NFC Card Management (uses device credential system) ────────────────────

router.get('/cards', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const cards = await prisma.employeeCredential.findMany({
      where: { orgId: req.orgId, credentialType: 'NFC_CARD' },
      include: {
        employee: { select: { name: true, employeeCode: true, department: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      cards: cards.map(c => ({
        id: c.id,
        card_uid: c.credentialData,
        employee_id: c.employeeId,
        name: c.employee.name,
        emp_code: c.employee.employeeCode,
        department: c.employee.department,
        label: c.label,
        is_active: c.isActive,
        assigned_at: c.assignedAt,
        deactivated_at: c.deactivatedAt,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/cards/employee/:employeeId', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const cards = await prisma.employeeCredential.findMany({
      where: {
        employeeId: req.params.employeeId,
        credentialType: 'NFC_CARD',
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({ cards });
  } catch (err) { next(err); }
});

router.post('/cards', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { card_uid, employee_id, label } = req.body;
    if (!card_uid || !employee_id) {
      return res.status(400).json({ error: 'card_uid and employee_id are required' });
    }

    const credential = await deviceService.assignCredential({
      orgId: req.orgId,
      employeeId: employee_id,
      credentialType: 'NFC_CARD',
      credentialData: card_uid.toUpperCase(),
      label,
      adminId: req.user.id,
      req,
    });

    res.status(201).json({ message: 'Card assigned', card: credential });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Card UID already assigned to an employee' });
    }
    next(err);
  }
});

router.put('/cards/:id/deactivate', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    await deviceService.deactivateCredential({
      credentialId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Card deactivated' });
  } catch (err) { next(err); }
});

router.put('/cards/:id/activate', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    await prisma.employeeCredential.update({
      where: { id: req.params.id },
      data: { isActive: true, deactivatedAt: null },
    });
    res.json({ message: 'Card activated' });
  } catch (err) { next(err); }
});

router.delete('/cards/:id', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    await prisma.employeeCredential.delete({ where: { id: req.params.id } });
    res.json({ message: 'Card removed' });
  } catch (err) { next(err); }
});

// ─── NFC Reader Devices (admin — uses device service) ───────────────────────

router.get('/readers', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const readers = await prisma.device.findMany({
      where: { orgId: req.orgId, deviceType: 'NFC_READER' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ readers });
  } catch (err) { next(err); }
});

// ─── Tap Log (admin) ───────────────────────────────────────────────────────

router.get('/tap-log', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { date, limit: queryLimit } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const rowLimit = Math.min(parseInt(queryLimit) || 100, 500);

    const startOfDay = new Date(`${targetDate}T00:00:00Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59Z`);

    const logs = await prisma.deviceEvent.findMany({
      where: {
        orgId: req.orgId,
        credentialType: 'NFC_CARD',
        eventTime: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        employee: { select: { name: true, employeeCode: true } },
      },
      orderBy: { eventTime: 'desc' },
      take: rowLimit,
    });

    res.json({
      logs: logs.map(l => ({
        id: l.id,
        card_uid: l.credentialData,
        device_id: l.deviceId,
        employee_id: l.employeeId,
        name: l.employee?.name,
        emp_code: l.employee?.employeeCode,
        result: l.result,
        tap_time: l.eventTime,
      })),
      date: targetDate,
    });
  } catch (err) { next(err); }
});

// ─── Write Jobs (provisioning) ─────────────────────────────────────────────

router.post('/write-jobs', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const { employee_id, device_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required' });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employee_id, orgId: req.orgId, isActive: true },
      select: { id: true, employeeCode: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Active employee not found' });
    }

    // Cancel existing pending jobs
    await prisma.deviceWriteJob.updateMany({
      where: { employeeId: employee_id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    const job = await prisma.deviceWriteJob.create({
      data: {
        employeeId: employee_id,
        dataToWrite: employee.employeeCode,
        deviceId: device_id || null,
      },
    });

    res.status(201).json({
      message: `Write job queued — place card on reader for ${employee.name}`,
      job,
    });
  } catch (err) { next(err); }
});

router.get('/write-jobs', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status.toUpperCase();

    const jobs = await prisma.deviceWriteJob.findMany({
      where,
      include: {
        device: { select: { name: true, deviceSerial: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ jobs });
  } catch (err) { next(err); }
});

router.put('/write-jobs/:id/cancel', authenticate, tenantContext, requireRole('org_admin'), async (req, res, next) => {
  try {
    const job = await prisma.deviceWriteJob.findFirst({
      where: { id: req.params.id, status: 'PENDING' },
    });
    if (!job) return res.status(404).json({ error: 'Pending write job not found' });

    await prisma.deviceWriteJob.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json({ message: 'Write job cancelled' });
  } catch (err) { next(err); }
});

// Reader service: check card
router.get('/check-card/:uid', authenticateDevice, async (req, res, next) => {
  try {
    const card = await prisma.employeeCredential.findFirst({
      where: {
        credentialType: 'NFC_CARD',
        credentialData: req.params.uid.toUpperCase(),
        isActive: true,
      },
      include: { employee: { select: { name: true, employeeCode: true } } },
    });

    if (card) {
      return res.json({
        assigned: true,
        employee: card.employee.name,
        emp_code: card.employee.employeeCode,
        employee_id: card.employeeId,
      });
    }
    res.json({ assigned: false });
  } catch (err) { next(err); }
});

// Reader service: poll pending write jobs
router.get('/write-jobs/pending', authenticateDevice, async (req, res, next) => {
  try {
    const deviceId = req.query.device_id;
    const where = { status: 'PENDING' };
    if (deviceId) {
      // Match by device serial or accept jobs with no device assigned
      const device = await prisma.device.findFirst({ where: { deviceSerial: deviceId } });
      if (device) {
        where.OR = [{ deviceId: device.id }, { deviceId: null }];
      }
    }

    const job = await prisma.deviceWriteJob.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });

    res.json({ job: job || null });
  } catch (err) { next(err); }
});

// Reader service: report write result
router.put('/write-jobs/:id/complete', authenticateDevice, async (req, res, next) => {
  try {
    const { card_uid, success, error_message } = req.body;

    const job = await prisma.deviceWriteJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Write job not found' });

    if (success && card_uid) {
      const existingCard = await prisma.employeeCredential.findFirst({
        where: {
          credentialType: 'NFC_CARD',
          credentialData: card_uid.toUpperCase(),
          isActive: true,
        },
        include: { employee: { select: { name: true } } },
      });

      if (existingCard && existingCard.employeeId !== job.employeeId) {
        await prisma.deviceWriteJob.update({
          where: { id: req.params.id },
          data: { status: 'FAILED', errorMessage: `Card already assigned to ${existingCard.employee.name}`, completedAt: new Date() },
        });
        return res.status(409).json({
          status: 'ALREADY_ASSIGNED',
          error: `Card ${card_uid} is already assigned to ${existingCard.employee.name}`,
        });
      }

      await prisma.deviceWriteJob.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED', resultData: card_uid, completedAt: new Date() },
      });

      // Auto-assign card
      if (!existingCard) {
        const device = req.device;
        await prisma.employeeCredential.create({
          data: {
            orgId: device.orgId,
            employeeId: job.employeeId,
            credentialType: 'NFC_CARD',
            credentialData: card_uid.toUpperCase(),
            label: 'Auto-provisioned',
          },
        });
      }

      return res.json({ status: 'completed', message: 'Card written and registered', card_uid });
    } else {
      await prisma.deviceWriteJob.update({
        where: { id: req.params.id },
        data: { status: 'FAILED', errorMessage: error_message || 'Unknown error', completedAt: new Date() },
      });
      return res.json({ status: 'failed', message: error_message || 'Write failed' });
    }
  } catch (err) { next(err); }
});

module.exports = router;
