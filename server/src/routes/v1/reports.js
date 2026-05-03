// ─────────────────────────────────────────────────────────────────────────────
// Report Routes (v1) — Analytics, attendance reports, exports
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth.new');
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

module.exports = router;
