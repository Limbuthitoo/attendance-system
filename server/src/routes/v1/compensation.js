const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ══════════════════════════════════════════════════════════════════════════════
// PAY GRADES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/compensation/pay-grades
router.get('/pay-grades', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const payGrades = await prisma.payGrade.findMany({
      where: { orgId: req.orgId },
      orderBy: { level: 'asc' },
    });
    res.json({ payGrades });
  } catch (err) { next(err); }
});

// POST /api/v1/compensation/pay-grades
router.post('/pay-grades', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, level, minSalary, maxSalary, currency } = req.body;
    if (!name) return res.status(400).json({ error: 'Pay grade name required' });

    const grade = await prisma.payGrade.create({
      data: { orgId: req.orgId, name, level: level || 0, minSalary: minSalary || 0, maxSalary: maxSalary || 0, currency: currency || 'NPR' },
    });
    res.status(201).json({ payGrade: grade });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Pay grade name already exists' });
    next(err);
  }
});

// PUT /api/v1/compensation/pay-grades/:id
router.put('/pay-grades/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const grade = await prisma.payGrade.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: req.body,
    });
    res.json({ payGrade: grade });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pay grade not found' });
    next(err);
  }
});

// DELETE /api/v1/compensation/pay-grades/:id
router.delete('/pay-grades/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.payGrade.delete({ where: { id: req.params.id, orgId: req.orgId } });
    res.json({ message: 'Pay grade deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SALARY REVISIONS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/compensation/salary-revisions
router.get('/salary-revisions', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId } = req.query;
    const where = { orgId: req.orgId };
    if (employeeId) where.employeeId = employeeId;

    const revisions = await prisma.salaryRevision.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json({ revisions });
  } catch (err) { next(err); }
});

// POST /api/v1/compensation/salary-revisions
router.post('/salary-revisions', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, previousGross, newGross, previousBasic, newBasic, effectiveFrom, reason, revisionType } = req.body;
    if (!employeeId || !newGross || !effectiveFrom) return res.status(400).json({ error: 'employeeId, newGross, effectiveFrom required' });

    const revision = await prisma.salaryRevision.create({
      data: { orgId: req.orgId, employeeId, previousGross: previousGross || 0, newGross, previousBasic: previousBasic || 0, newBasic: newBasic || newGross, effectiveFrom: new Date(effectiveFrom), reason, revisionType: revisionType || 'annual', approvedBy: req.user.id },
    });
    res.status(201).json({ revision });
  } catch (err) { next(err); }
});

// PUT /api/v1/compensation/salary-revisions/:id
router.put('/salary-revisions/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.body;
    const revision = await prisma.salaryRevision.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: { status, ...(status === 'APPROVED' && { approvedBy: req.user.id, approvedAt: new Date() }) },
    });

    // Auto-sync: when revision is APPROVED, update the SalaryStructure
    if (status === 'APPROVED') {
      const { upsertSalaryStructure } = require('../../services/payroll-engine.service');
      const config = await require('../../services/payroll-engine.service').getPayrollConfig(req.orgId);
      const basicPct = config.payroll_basic_salary_pct || 60;
      const newBasic = revision.newBasic ? Number(revision.newBasic) : Number(revision.newGross) * basicPct / 100;

      await upsertSalaryStructure({
        orgId: req.orgId,
        employeeId: revision.employeeId,
        grossSalary: Number(revision.newGross),
        basicSalary: newBasic,
        allowances: {},
        effectiveFrom: revision.effectiveFrom,
        adminId: req.user.id,
        req,
      });
    }

    res.json({ revision });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Revision not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BENEFIT PLANS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/compensation/benefits
router.get('/benefits', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const benefits = await prisma.benefitPlan.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: 'asc' },
    });
    res.json({ benefits });
  } catch (err) { next(err); }
});

// POST /api/v1/compensation/benefits
router.post('/benefits', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, category, description, amount, isPercentage, percentageOf } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });

    const benefit = await prisma.benefitPlan.create({
      data: { orgId: req.orgId, name, category, description, amount: amount || null, isPercentage: isPercentage || false, percentageOf },
    });
    res.status(201).json({ benefit });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Benefit plan name already exists' });
    next(err);
  }
});

// PUT /api/v1/compensation/benefits/:id
router.put('/benefits/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const benefit = await prisma.benefitPlan.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: req.body,
    });
    res.json({ benefit });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Benefit plan not found' });
    next(err);
  }
});

// DELETE /api/v1/compensation/benefits/:id
router.delete('/benefits/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.benefitPlan.delete({ where: { id: req.params.id, orgId: req.orgId } });
    res.json({ message: 'Benefit plan deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

module.exports = router;
