// ─────────────────────────────────────────────────────────────────────────────
// Platform Billing Routes — Invoice management
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { getPrisma } = require('../../lib/prisma');
const { requireSuperAdmin } = require('../../middleware/platformAuth');

// GET /api/platform/billing — list invoices with filters
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { orgId, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          plan: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      invoices,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/billing/stats — billing summary
router.get('/stats', async (req, res, next) => {
  try {
    const prisma = getPrisma();

    const [
      totalRevenue,
      pendingAmount,
      overdueCount,
      monthlyBreakdown,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
      prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      prisma.invoice.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingAmount: pendingAmount._sum.amount || 0,
      overdueCount,
      byStatus: Object.fromEntries(
        monthlyBreakdown.map((g) => [g.status, { count: g._count, amount: g._sum.amount || 0 }])
      ),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/billing/:id — single invoice
router.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, code: true, price: true, currency: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/billing — create invoice
router.post('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const {
      orgId, planId, amount, currency = 'NPR',
      billingPeriodStart, billingPeriodEnd, dueDate, notes,
    } = req.body;

    if (!orgId || !amount || !billingPeriodStart || !billingPeriodEnd || !dueDate) {
      return res.status(400).json({ error: 'orgId, amount, billingPeriodStart, billingPeriodEnd, and dueDate are required' });
    }

    // Generate invoice number: INV-YYYYMM-XXXX
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: prefix } },
    });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        orgId,
        planId: planId || null,
        amount: parseInt(amount),
        currency,
        billingPeriodStart: new Date(billingPeriodStart),
        billingPeriodEnd: new Date(billingPeriodEnd),
        dueDate: new Date(dueDate),
        notes: notes || '',
        createdBy: req.platformUser.id,
      },
      include: {
        organization: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/billing/:id — update invoice
router.put('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { amount, dueDate, notes, status } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const updateData = {};
    if (amount !== undefined) updateData.amount = parseInt(amount);
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (notes !== undefined) updateData.notes = notes;
    if (status) updateData.status = status;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/billing/:id/pay — mark as paid
router.put('/:id/pay', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { paymentMethod, paymentRef } = req.body;

    const existing = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { organization: true },
    });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: paymentMethod || null,
        paymentRef: paymentRef || null,
      },
    });

    // If org was EXPIRED or TRIAL, activate it upon payment
    const org = existing.organization;
    if (['EXPIRED', 'TRIAL'].includes(org.subscriptionStatus)) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: 'ACTIVE', isActive: true },
      });
    }

    res.json({ invoice, message: 'Invoice marked as paid' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/platform/billing/:id — delete invoice (only if pending)
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });
    if (existing.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot delete a paid invoice' });
    }

    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
