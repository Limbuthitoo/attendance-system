const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// GET /api/v1/separation
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    const where = { orgId: req.orgId };
    if (status) where.status = status;

    const separations = await prisma.separation.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, department: true } },
        _count: { select: { clearanceItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ separations });
  } catch (err) { next(err); }
});

// POST /api/v1/separation
router.post('/', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, type, reason, lastWorkingDate, noticePeriodDays } = req.body;
    if (!employeeId || !type) return res.status(400).json({ error: 'employeeId and type required' });

    const separation = await prisma.separation.create({
      data: {
        orgId: req.orgId,
        employeeId,
        type,
        reason: reason || null,
        lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
        noticePeriodDays: noticePeriodDays || 30,
      },
    });
    res.status(201).json({ separation });
  } catch (err) { next(err); }
});

// PUT /api/v1/separation/:id
router.put('/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, exitInterviewDone, exitInterviewNotes } = req.body;
    const separation = await prisma.separation.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: {
        ...(status && { status }),
        ...(exitInterviewDone !== undefined && { exitInterviewDone }),
        ...(exitInterviewNotes !== undefined && { exitInterviewNotes }),
      },
    });
    res.json({ separation });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Separation not found' });
    next(err);
  }
});

// ── Clearance Items ──

// GET /api/v1/separation/:id/clearance
router.get('/:id/clearance', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const items = await prisma.clearanceItem.findMany({
      where: { separationId: req.params.id },
      include: { approver: { select: { id: true, name: true } } },
      orderBy: { department: 'asc' },
    });
    res.json({ items });
  } catch (err) { next(err); }
});

// POST /api/v1/separation/:id/clearance
router.post('/:id/clearance', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { department, itemName, description } = req.body;
    if (!department || !itemName) return res.status(400).json({ error: 'department and itemName required' });

    const item = await prisma.clearanceItem.create({
      data: { separationId: req.params.id, department, itemName, description: description || null },
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

// PUT /api/v1/separation/clearance/:itemId
router.put('/clearance/:itemId', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, remarks } = req.body;
    const item = await prisma.clearanceItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(status && { status }),
        ...(remarks !== undefined && { remarks }),
        ...(status === 'CLEARED' && { approvedBy: req.user.id, approvedAt: new Date() }),
      },
    });
    res.json({ item });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Clearance item not found' });
    next(err);
  }
});

// ── Final Settlement ──

// GET /api/v1/separation/:id/settlement
router.get('/:id/settlement', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const settlement = await prisma.finalSettlement.findFirst({
      where: { separationId: req.params.id },
    });
    res.json({ settlement });
  } catch (err) { next(err); }
});

// POST /api/v1/separation/:id/settlement
router.post('/:id/settlement', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { basicDues, leaveEncashment, gratuity, bonus, noticePeriodRecovery, advanceRecovery, otherDeductions, otherEarnings, tds } = req.body;

    const earnings = (basicDues || 0) + (leaveEncashment || 0) + (gratuity || 0) + (bonus || 0) + (otherEarnings || 0);
    const deductions = (noticePeriodRecovery || 0) + (advanceRecovery || 0) + (otherDeductions || 0) + (tds || 0);
    const netPayable = earnings - deductions;

    const settlement = await prisma.finalSettlement.create({
      data: {
        separationId: req.params.id,
        basicDues: basicDues || 0,
        leaveEncashment: leaveEncashment || 0,
        gratuity: gratuity || 0,
        bonus: bonus || 0,
        noticePeriodRecovery: noticePeriodRecovery || 0,
        advanceRecovery: advanceRecovery || 0,
        otherDeductions: otherDeductions || 0,
        otherEarnings: otherEarnings || 0,
        tds: tds || 0,
        netPayable,
      },
    });
    res.status(201).json({ settlement });
  } catch (err) { next(err); }
});

// PUT /api/v1/separation/settlement/:id
router.put('/settlement/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, paidAt } = req.body;
    const settlement = await prisma.finalSettlement.update({
      where: { id: req.params.id },
      data: { ...(status && { status }), ...(paidAt && { paidAt: new Date(paidAt) }) },
    });
    res.json({ settlement });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Settlement not found' });
    next(err);
  }
});

module.exports = router;
