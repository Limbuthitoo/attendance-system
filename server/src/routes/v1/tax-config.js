const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// GET /api/v1/tax-config
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const configs = await prisma.taxConfig.findMany({
      where: { orgId: req.orgId },
      orderBy: { fiscalYear: 'desc' },
    });
    res.json({ configs });
  } catch (err) { next(err); }
});

// POST /api/v1/tax-config
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { fiscalYear, ssfEmployeeRate, ssfEmployerRate, citEmployeeRate, citEmployerRate, pfEmployeeRate, pfEmployerRate, taxSlabs, marriedTaxSlabs, gratuityEnabled, gratuityRate } = req.body;
    if (!fiscalYear) return res.status(400).json({ error: 'fiscalYear is required' });

    const config = await prisma.taxConfig.create({
      data: {
        orgId: req.orgId,
        fiscalYear,
        ssfEmployeeRate: ssfEmployeeRate || 11,
        ssfEmployerRate: ssfEmployerRate || 20,
        citEmployeeRate: citEmployeeRate || 0,
        citEmployerRate: citEmployerRate || 0,
        pfEmployeeRate: pfEmployeeRate || 10,
        pfEmployerRate: pfEmployerRate || 10,
        taxSlabs: taxSlabs || [],
        marriedTaxSlabs: marriedTaxSlabs || [],
        gratuityEnabled: gratuityEnabled !== undefined ? gratuityEnabled : true,
        gratuityRate: gratuityRate || 8.33,
      },
    });
    res.status(201).json({ config });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Config for this fiscal year already exists' });
    next(err);
  }
});

// PUT /api/v1/tax-config/:id
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { ssfEmployeeRate, ssfEmployerRate, citEmployeeRate, citEmployerRate, pfEmployeeRate, pfEmployerRate, taxSlabs, marriedTaxSlabs, gratuityEnabled, gratuityRate } = req.body;
    const data = {};
    if (ssfEmployeeRate !== undefined) data.ssfEmployeeRate = ssfEmployeeRate;
    if (ssfEmployerRate !== undefined) data.ssfEmployerRate = ssfEmployerRate;
    if (citEmployeeRate !== undefined) data.citEmployeeRate = citEmployeeRate;
    if (citEmployerRate !== undefined) data.citEmployerRate = citEmployerRate;
    if (pfEmployeeRate !== undefined) data.pfEmployeeRate = pfEmployeeRate;
    if (pfEmployerRate !== undefined) data.pfEmployerRate = pfEmployerRate;
    if (taxSlabs !== undefined) data.taxSlabs = taxSlabs;
    if (marriedTaxSlabs !== undefined) data.marriedTaxSlabs = marriedTaxSlabs;
    if (gratuityEnabled !== undefined) data.gratuityEnabled = gratuityEnabled;
    if (gratuityRate !== undefined) data.gratuityRate = gratuityRate;
    const config = await prisma.taxConfig.update({
      where: { id: req.params.id, orgId: req.orgId },
      data,
    });
    res.json({ config });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tax config not found' });
    next(err);
  }
});

// DELETE /api/v1/tax-config/:id
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.taxConfig.delete({ where: { id: req.params.id, orgId: req.orgId } });
    res.json({ message: 'Tax config deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Tax config not found' });
    next(err);
  }
});

module.exports = router;
