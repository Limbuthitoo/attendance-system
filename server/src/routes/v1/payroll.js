// ─────────────────────────────────────────────────────────────────────────────
// Payroll Routes (v1) — Generate summaries, view, export
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth.new');
const payrollService = require('../../services/payroll.service');

const router = Router();

// POST /api/v1/payroll/generate — Generate payroll for a month
router.post('/generate', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const result = await payrollService.generatePayrollSummary({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      adminId: req.user.id,
      req,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/summaries — Get payroll summaries for a month
router.get('/summaries', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month, department } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const data = await payrollService.getPayrollSummaries({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      department,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/export — Export payroll as CSV
router.get('/export', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const { header, rows } = await payrollService.exportPayroll({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });

    const csvLines = [header.join(',')];
    for (const row of rows) {
      csvLines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${year}-${String(month).padStart(2, '0')}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) { next(err); }
});

module.exports = router;
