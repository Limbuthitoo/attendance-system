// ─────────────────────────────────────────────────────────────────────────────
// Settings Routes (v1) — Org settings, shifts, work schedules, assignments, branding
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../../middleware/auth.new');
const settingsService = require('../../services/settings.service');
const prisma = require('../../lib/prisma').getPrisma();

const router = Router();

// ── Branding directory setup ────────────────────────────────────────────────
const brandingDir = path.join(__dirname, '..', '..', '..', 'data', 'branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, brandingDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.params.type}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(png|jpg|jpeg|svg|ico|gif|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET /api/v1/settings — Get org settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.getOrgSettings(req.orgId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings — Update org settings (admin)
router.put('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const settings = await settingsService.updateOrgSettings({
      orgId: req.orgId,
      settings: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ settings, message: 'Settings updated' });
  } catch (err) {
    next(err);
  }
});

// ── Shifts ──────────────────────────────────────────────────────────────────

// GET /api/v1/settings/shifts
router.get('/shifts', async (req, res, next) => {
  try {
    const shifts = await settingsService.listShifts(req.orgId, {
      branchId: req.query.branchId,
    });
    res.json({ shifts });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/shifts/:id
router.get('/shifts/:id', async (req, res, next) => {
  try {
    const shift = await settingsService.getShift(req.params.id, req.orgId);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json({ shift });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/shifts — Create a shift (admin)
router.post('/shifts', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const shift = await settingsService.createShift({
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ shift, message: 'Shift created' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings/shifts/:id — Update shift (admin)
router.put('/shifts/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const shift = await settingsService.updateShift({
      shiftId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ shift, message: 'Shift updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/settings/shifts/:id — Deactivate shift (admin)
router.delete('/shifts/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await settingsService.deactivateShift({
      shiftId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Shift deactivated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Work Schedules ──────────────────────────────────────────────────────────

// GET /api/v1/settings/work-schedules
router.get('/work-schedules', async (req, res, next) => {
  try {
    const schedules = await settingsService.listWorkSchedules(req.orgId);
    res.json({ workSchedules: schedules });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/work-schedules/:id
router.get('/work-schedules/:id', async (req, res, next) => {
  try {
    const schedule = await settingsService.getWorkSchedule(req.params.id, req.orgId);
    if (!schedule) return res.status(404).json({ error: 'Work schedule not found' });
    res.json({ workSchedule: schedule });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/work-schedules — Create a work schedule (admin)
router.post('/work-schedules', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const schedule = await settingsService.createWorkSchedule({
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.status(201).json({ workSchedule: schedule, message: 'Work schedule created' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings/work-schedules/:id — Update work schedule (admin)
router.put('/work-schedules/:id', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const schedule = await settingsService.updateWorkSchedule({
      scheduleId: req.params.id,
      orgId: req.orgId,
      data: req.body,
      adminId: req.user.id,
      req,
    });
    res.json({ workSchedule: schedule, message: 'Work schedule updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/v1/settings/work-schedules/:id — Deactivate work schedule (admin)
router.delete('/work-schedules/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    await settingsService.deactivateWorkSchedule({
      scheduleId: req.params.id,
      orgId: req.orgId,
      adminId: req.user.id,
      req,
    });
    res.json({ message: 'Work schedule deactivated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── Employee Assignment (branch + shift + schedule) ─────────────────────────

// GET /api/v1/settings/assignments — List all current assignments
router.get('/assignments', requireRole('org_admin', 'hr_manager', 'branch_manager'), async (req, res, next) => {
  try {
    const { branchId, shiftId, workScheduleId } = req.query;
    const assignments = await settingsService.listAssignments(req.orgId, {
      branchId, shiftId, workScheduleId,
    });
    res.json({ assignments });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/assignments/employee/me — Current user's own assignment
router.get('/assignments/employee/me', async (req, res, next) => {
  try {
    const assignment = await settingsService.getEmployeeAssignment(req.user.id);
    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/assignments/employee/:id — Current assignment for an employee
router.get('/assignments/employee/:id', async (req, res, next) => {
  try {
    const assignment = await settingsService.getEmployeeAssignment(req.params.id);
    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/settings/assignments/employee/:id/history — Assignment history
router.get('/assignments/employee/:id/history', async (req, res, next) => {
  try {
    const history = await settingsService.getAssignmentHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/assign-employee — Assign employee to branch/shift/schedule
router.post('/assign-employee', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, branchId, shiftId, workScheduleId } = req.body;

    if (!employeeId || !branchId || !shiftId || !workScheduleId) {
      return res.status(400).json({ error: 'employeeId, branchId, shiftId, and workScheduleId are required' });
    }

    const assignment = await settingsService.assignEmployee({
      employeeId,
      branchId,
      shiftId,
      workScheduleId,
      adminId: req.user.id,
      orgId: req.orgId,
      req,
    });

    res.json({ assignment, message: 'Employee assigned' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/bulk-assign — Bulk assign employees
router.post('/bulk-assign', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeIds, branchId, shiftId, workScheduleId } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'employeeIds array is required' });
    }
    if (!branchId || !shiftId || !workScheduleId) {
      return res.status(400).json({ error: 'branchId, shiftId, and workScheduleId are required' });
    }

    const assignments = await settingsService.bulkAssignEmployees({
      employeeIds,
      branchId,
      shiftId,
      workScheduleId,
      adminId: req.user.id,
      orgId: req.orgId,
      req,
    });

    res.json({ assignments, message: `${assignments.length} employee(s) assigned` });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDING — Logo & Favicon (public GET, admin POST/DELETE)
// ═══════════════════════════════════════════════════════════════════════════════

// Serve branding files — public (no auth), called by web Layout on load
router.get('/branding/:type', async (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  try {
    // Try to find org from header; fall back to first org (single-tenant compat)
    const orgId = req.headers['x-org-id'];
    const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';

    const where = { key };
    if (orgId) where.orgId = orgId;

    const setting = await prisma.orgSetting.findFirst({ where });

    if (!setting || !setting.value) {
      return res.status(404).json({ error: `No ${type} uploaded` });
    }

    const filePath = path.join(brandingDir, setting.value);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `${type} file not found` });
    }

    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: `${type} not found` });
  }
});

// Upload branding — admin
router.post('/branding/:type', requireRole('org_admin'), (req, res) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  brandingUpload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum 2MB allowed.' });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';
      await prisma.orgSetting.upsert({
        where: { orgId_key: { orgId: req.orgId, key } },
        update: { value: req.file.filename },
        create: { orgId: req.orgId, key, value: req.file.filename },
      });

      res.json({
        message: `${type} uploaded successfully`,
        filename: req.file.filename,
        url: `/api/v1/settings/branding/${type}`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Delete branding — admin
router.delete('/branding/:type', requireRole('org_admin'), async (req, res, next) => {
  const { type } = req.params;
  if (!['logo', 'favicon'].includes(type)) {
    return res.status(400).json({ error: 'Type must be logo or favicon' });
  }

  try {
    const key = type === 'logo' ? 'branding_logo' : 'branding_favicon';
    const setting = await prisma.orgSetting.findFirst({
      where: { orgId: req.orgId, key },
    });

    if (setting && setting.value) {
      const filePath = path.join(brandingDir, setting.value);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.orgSetting.deleteMany({ where: { orgId: req.orgId, key } });
    res.json({ message: `${type} removed successfully` });
  } catch (err) { next(err); }
});

module.exports = router;
