// ─────────────────────────────────────────────────────────────────────────────
// Payroll Routes (v1) — Payslips, salary structures, config, attendance summary
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const payrollService = require('../../services/payroll.service');
const payrollEngine = require('../../services/payroll-engine.service');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE SUMMARY (legacy — kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/v1/payroll/generate — Generate attendance summary for a month
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

// GET /api/v1/payroll/summaries — Get attendance summaries for a month
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

// GET /api/v1/payroll/export — Export attendance as CSV
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

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/payroll/config — Get payroll configuration
router.get('/config', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const config = await payrollEngine.getPayrollConfig(req.orgId);
    res.json(config);
  } catch (err) { next(err); }
});

// PUT /api/v1/payroll/config — Update payroll configuration
router.put('/config', requireRole('org_admin'), async (req, res, next) => {
  try {
    const config = await payrollEngine.updatePayrollConfig({
      orgId: req.orgId,
      settings: req.body,
      adminId: req.user.id,
      req,
    });
    res.json(config);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SALARY STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/payroll/salary-structures — Get all salary structures
router.get('/salary-structures', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const structures = await payrollEngine.getAllSalaryStructures(req.orgId);
    res.json({ structures });
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/salary-structures/:employeeId — Get employee salary structure
router.get('/salary-structures/:employeeId', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const structure = await payrollEngine.getSalaryStructure(req.orgId, req.params.employeeId);
    res.json(structure || null);
  } catch (err) { next(err); }
});

// POST /api/v1/payroll/salary-structures — Create/update salary structure
router.post('/salary-structures', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, grossSalary, basicSalary, allowances, effectiveFrom } = req.body;
    if (!employeeId || !grossSalary || !basicSalary || !effectiveFrom) {
      return res.status(400).json({ error: 'employeeId, grossSalary, basicSalary, and effectiveFrom are required' });
    }

    const structure = await payrollEngine.upsertSalaryStructure({
      orgId: req.orgId,
      employeeId,
      grossSalary: parseFloat(grossSalary),
      basicSalary: parseFloat(basicSalary),
      allowances: allowances || {},
      effectiveFrom,
      adminId: req.user.id,
      req,
    });
    res.json(structure);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCE SALARY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/payroll/advance-salaries — Get all active advance salaries
router.get('/advance-salaries', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId } = req.query;
    if (employeeId) {
      const advances = await payrollEngine.getActiveAdvanceSalaries(req.orgId, employeeId);
      return res.json({ advances });
    }
    const advances = await payrollEngine.getAllAdvanceSalaries(req.orgId);
    res.json({ advances });
  } catch (err) { next(err); }
});

// POST /api/v1/payroll/advance-salaries — Create an advance salary
router.post('/advance-salaries', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { employeeId, description, totalAmount, monthlyDeduction, startMonth, startYear } = req.body;
    if (!employeeId || !totalAmount || !monthlyDeduction) {
      return res.status(400).json({ error: 'employeeId, totalAmount, and monthlyDeduction are required' });
    }

    const advance = await payrollEngine.createAdvanceSalary({
      orgId: req.orgId,
      employeeId,
      description,
      totalAmount: parseFloat(totalAmount),
      monthlyDeduction: parseFloat(monthlyDeduction),
      startMonth: startMonth || new Date().getMonth() + 1,
      startYear: startYear || new Date().getFullYear(),
      adminId: req.user.id,
      req,
    });
    res.json(advance);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYSLIPS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/v1/payroll/payslips/generate — Generate payslips for a month
router.post('/payslips/generate', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const result = await payrollEngine.generatePayslips({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      adminId: req.user.id,
      req,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/payslips — Get payslips for a month
router.get('/payslips', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month, department, status } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const data = await payrollEngine.getPayslips({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      department,
      status,
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/payslips/my — Get my payslips
router.get('/payslips/my', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const payslips = await payrollEngine.getMyPayslips({
      orgId: req.orgId,
      employeeId: req.user.id,
      year,
    });
    res.json({ payslips });
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/payslips/:employeeId/:year/:month — Get specific payslip
router.get('/payslips/:employeeId/:year/:month', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const payslip = await payrollEngine.getEmployeePayslip({
      orgId: req.orgId,
      employeeId: req.params.employeeId,
      year: parseInt(req.params.year, 10),
      month: parseInt(req.params.month, 10),
    });
    if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
    res.json(payslip);
  } catch (err) { next(err); }
});

// POST /api/v1/payroll/payslips/lock — Lock payroll for a month
router.post('/payslips/lock', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const result = await payrollEngine.lockPayroll({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      adminId: req.user.id,
      req,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/payroll/payslips/unlock — Unlock payroll for a month
router.post('/payslips/unlock', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const result = await payrollEngine.unlockPayroll({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      adminId: req.user.id,
      req,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/payroll/payslips/mark-paid — Mark payroll as paid
router.post('/payslips/mark-paid', requireRole('org_admin'), async (req, res, next) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const result = await payrollEngine.markAsPaid({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      adminId: req.user.id,
      req,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/payroll/payslips/export — Export payslips as CSV
router.get('/payslips/export', requireRole('org_admin', 'hr_manager'), async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month are required' });

    const { header, rows } = await payrollEngine.exportPayslips({
      orgId: req.orgId,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });

    const csvLines = [header.join(',')];
    for (const row of rows) {
      csvLines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payslips-${year}-${String(month).padStart(2, '0')}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) { next(err); }
});

module.exports = router;
