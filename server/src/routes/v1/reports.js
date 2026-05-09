// ─────────────────────────────────────────────────────────────────────────────
// Report Routes (v1) — Analytics, attendance reports, exports
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const reportService = require('../../services/report.service');

const router = Router();

// GET /api/v1/reports/attendance-summary
router.get('/attendance-summary', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, branchId, department } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const data = await reportService.getAttendanceSummary({
      orgId: req.orgId,
      startDate,
      endDate,
      branchId,
      departmentFilter: department,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/v1/reports/department
router.get('/department', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const data = await reportService.getDepartmentReport({ orgId: req.orgId, startDate, endDate });
    res.json({ departments: data });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/daily-trend
router.get('/daily-trend', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const data = await reportService.getDailyTrend({ orgId: req.orgId, startDate, endDate, branchId });
    res.json({ trend: data });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/late-arrivals
router.get('/late-arrivals', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, minLateCount } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const data = await reportService.getLateArrivals({
      orgId: req.orgId,
      startDate,
      endDate,
      minLateCount: parseInt(minLateCount, 10) || 3,
    });
    res.json({ employees: data });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/leaves
router.get('/leaves', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year } = req.query;
    const data = await reportService.getLeaveReport({ orgId: req.orgId, year: parseInt(year, 10) || new Date().getFullYear() });
    res.json({ employees: data });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/export/attendance
router.get('/export/attendance', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const { header, rows } = await reportService.exportAttendance({ orgId: req.orgId, startDate, endDate, branchId });

    // Return as CSV
    const csvLines = [header.join(',')];
    for (const row of rows) {
      csvLines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${startDate}-to-${endDate}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) { next(err); }
});

// POST /api/v1/reports/generate — Async report generation (queued)
router.post('/generate', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { type, params } = req.body;
    const validTypes = ['attendance-summary', 'attendance-export', 'payroll-export', 'leave-report', 'late-arrivals', 'department-summary'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }
    const { enqueueReport } = require('../../config/queue');
    const jobId = await enqueueReport({ orgId: req.orgId, type, params: params || {}, requestedBy: req.user.id });
    res.json({ success: true, jobId, message: 'Report generation queued. You will be notified when ready.' });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/download/:filename — Download generated report file
router.get('/download/:filename', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const filename = req.params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, ''); // Sanitize
    const filepath = path.join(__dirname, '../../../data/reports', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Report file not found or expired' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (err) { next(err); }
});

module.exports = router;
