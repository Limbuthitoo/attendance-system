const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// GET /api/v1/festival-advances
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, fiscalYear } = req.query;
    const where = { orgId: req.orgId };
    if (status) where.status = status;
    if (fiscalYear) where.fiscalYear = fiscalYear;

    const advances = await prisma.festivalAdvance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ advances });
  } catch (err) { next(err); }
});

// POST /api/v1/festival-advances
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, amount, fiscalYear, festivalName, deductionMonths } = req.body;
    if (!employeeId || !amount) return res.status(400).json({ error: 'employeeId and amount are required' });

    const months = deductionMonths || 10;
    const amtDecimal = parseFloat(amount);
    const monthlyDeduction = Math.ceil(amtDecimal / months * 100) / 100;

    const advance = await prisma.festivalAdvance.create({
      data: {
        orgId: req.orgId,
        employeeId,
        amount: amtDecimal,
        fiscalYear: fiscalYear || '',
        festivalName: festivalName || 'Dashain',
        deductionMonths: months,
        monthlyDeduction,
        remainingAmount: amtDecimal,
      },
    });
    res.status(201).json({ advance });
  } catch (err) { next(err); }
});

// PUT /api/v1/festival-advances/:id
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, deductedAmount } = req.body;
    const advance = await prisma.festivalAdvance.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: { ...(status && { status }), ...(deductedAmount !== undefined && { deductedAmount }) },
    });
    res.json({ advance });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

module.exports = router;
