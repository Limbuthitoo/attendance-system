const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT REQUESTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/ess/documents
router.get('/documents', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    const where = { orgId: req.orgId };
    // Non-admin users only see their own requests
    if (req.user.role !== 'org_admin') where.employeeId = req.user.id;
    if (status) where.status = status;

    const requests = await prisma.documentRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        processor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) { next(err); }
});

// POST /api/v1/ess/documents
router.post('/documents', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { type, purpose } = req.body;
    if (!type) return res.status(400).json({ error: 'Document type is required' });

    const request = await prisma.documentRequest.create({
      data: { orgId: req.orgId, employeeId: req.user.id, type, purpose },
    });
    res.status(201).json({ request });
  } catch (err) { next(err); }
});

// PUT /api/v1/ess/documents/:id
router.put('/documents/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, documentUrl, remarks } = req.body;
    const request = await prisma.documentRequest.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: {
        ...(status && { status }),
        ...(documentUrl && { documentUrl }),
        ...(remarks !== undefined && { remarks }),
        ...(status === 'COMPLETED' || status === 'REJECTED' ? { processedBy: req.user.id, processedAt: new Date() } : {}),
      },
    });
    res.json({ request });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Document request not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSE CLAIMS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/ess/expenses
router.get('/expenses', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    const where = { orgId: req.orgId };
    if (req.user.role !== 'org_admin') where.employeeId = req.user.id;
    if (status) where.status = status;

    const claims = await prisma.expenseClaim.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ claims });
  } catch (err) { next(err); }
});

// POST /api/v1/ess/expenses
router.post('/expenses', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { category, description, amount, receiptUrl, expenseDate } = req.body;
    if (!category || !description || !amount) return res.status(400).json({ error: 'category, description, amount required' });

    const claim = await prisma.expenseClaim.create({
      data: { orgId: req.orgId, employeeId: req.user.id, category, description, amount, receiptUrl, expenseDate: expenseDate ? new Date(expenseDate) : new Date() },
    });
    res.status(201).json({ claim });
  } catch (err) { next(err); }
});

// PUT /api/v1/ess/expenses/:id
router.put('/expenses/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, rejectionReason } = req.body;
    const data = {};
    if (status) {
      data.status = status;
      if (status === 'APPROVED') { data.approvedBy = req.user.id; data.approvedAt = new Date(); }
      if (status === 'PAID') data.paidAt = new Date();
      if (status === 'REJECTED') data.rejectionReason = rejectionReason || null;
    }
    const claim = await prisma.expenseClaim.update({
      where: { id: req.params.id, orgId: req.orgId },
      data,
    });
    res.json({ claim });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Expense claim not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ASSETS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/ess/assets
router.get('/assets', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    const where = { orgId: req.orgId };
    if (status) where.status = status;

    const assets = await prisma.asset.findMany({
      where,
      include: { assignments: { where: { isActive: true }, include: { employee: { select: { id: true, name: true } } } } },
      orderBy: { name: 'asc' },
    });
    res.json({ assets });
  } catch (err) { next(err); }
});

// POST /api/v1/ess/assets
router.post('/assets', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, category, assetTag, serialNumber, purchaseDate, purchaseCost, condition } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });

    const asset = await prisma.asset.create({
      data: { orgId: req.orgId, name, category, assetTag, serialNumber, purchaseDate: purchaseDate ? new Date(purchaseDate) : null, purchaseCost, condition },
    });
    res.status(201).json({ asset });
  } catch (err) { next(err); }
});

// PUT /api/v1/ess/assets/:id
router.put('/assets/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const asset = await prisma.asset.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: req.body,
    });
    res.json({ asset });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Asset not found' });
    next(err);
  }
});

// POST /api/v1/ess/assets/:id/assign
router.post('/assets/:id/assign', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, assignedDate, notes } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'employeeId required' });

    const [assignment] = await prisma.$transaction([
      prisma.assetAssignment.create({
        data: { orgId: req.orgId, assetId: req.params.id, employeeId, assignedDate: assignedDate ? new Date(assignedDate) : new Date(), notes },
      }),
      prisma.asset.update({ where: { id: req.params.id }, data: { status: 'ASSIGNED' } }),
    ]);
    res.status(201).json({ assignment });
  } catch (err) { next(err); }
});

// POST /api/v1/ess/assets/:id/return
router.post('/assets/:id/return', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { condition, notes } = req.body;

    await prisma.$transaction([
      prisma.assetAssignment.updateMany({
        where: { assetId: req.params.id, isActive: true },
        data: { isActive: false, returnDate: new Date(), condition: condition || null },
      }),
      prisma.asset.update({ where: { id: req.params.id }, data: { status: 'AVAILABLE', condition: condition || 'good' } }),
    ]);
    res.json({ message: 'Asset returned' });
  } catch (err) { next(err); }
});

// GET /api/v1/ess/my-assets — for employee self-service
router.get('/my-assets', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const assignments = await prisma.assetAssignment.findMany({
      where: { employeeId: req.user.id, isActive: true },
      include: { asset: true },
    });
    res.json({ assignments });
  } catch (err) { next(err); }
});

module.exports = router;
