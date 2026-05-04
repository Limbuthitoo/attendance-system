// ─────────────────────────────────────────────────────────────────────────────
// Holiday Routes (v1)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { getPrisma } = require('../../lib/prisma');
const { auditLog } = require('../../lib/audit');

const router = Router();

// GET /api/v1/holidays?year=2083
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const bsYear = parseInt(req.query.year) || 2083;

    const holidays = await prisma.holiday.findMany({
      where: { orgId: req.orgId, bsYear },
      orderBy: [{ bsMonth: 'asc' }, { bsDay: 'asc' }],
    });

    // Add snake_case aliases for backward compat with old web client
    const mapped = holidays.map(h => ({
      ...h,
      bs_year: h.bsYear,
      bs_month: h.bsMonth,
      bs_day: h.bsDay,
      bs_day_end: h.bsDayEnd,
      bs_month_end: h.bsMonthEnd,
      name_np: h.nameNp,
      ad_date: h.adDate,
      ad_date_end: h.adDateEnd,
      women_only: h.womenOnly,
    }));

    res.json({ holidays: mapped });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/holidays
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const b = req.body;
    const bsYear = b.bsYear ?? b.bs_year;
    const bsMonth = b.bsMonth ?? b.bs_month;
    const bsDay = b.bsDay ?? b.bs_day;
    const bsDayEnd = b.bsDayEnd ?? b.bs_day_end;
    const bsMonthEnd = b.bsMonthEnd ?? b.bs_month_end;
    const name = b.name;
    const nameNp = b.nameNp ?? b.name_np;
    const adDate = b.adDate ?? b.ad_date;
    const adDateEnd = b.adDateEnd ?? b.ad_date_end;
    const womenOnly = b.womenOnly ?? b.women_only;

    const holiday = await prisma.holiday.create({
      data: {
        orgId: req.orgId,
        bsYear,
        bsMonth,
        bsDay,
        bsDayEnd: bsDayEnd || null,
        bsMonthEnd: bsMonthEnd || null,
        name,
        nameNp: nameNp || null,
        adDate: adDate ? new Date(adDate) : null,
        adDateEnd: adDateEnd ? new Date(adDateEnd) : null,
        womenOnly: womenOnly || false,
      },
    });

    await auditLog({
      orgId: req.orgId,
      actorId: req.user.id,
      action: 'holiday.create',
      resource: 'holiday',
      resourceId: holiday.id,
      newData: { name, bsYear, bsMonth, bsDay },
      req,
    });

    res.status(201).json({ holiday, message: 'Holiday created' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/holidays/:id
router.put('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const b = req.body;
    const bsYear = b.bsYear ?? b.bs_year;
    const bsMonth = b.bsMonth ?? b.bs_month;
    const bsDay = b.bsDay ?? b.bs_day;
    const bsDayEnd = b.bsDayEnd ?? b.bs_day_end;
    const bsMonthEnd = b.bsMonthEnd ?? b.bs_month_end;
    const name = b.name;
    const nameNp = b.nameNp ?? b.name_np;
    const adDate = b.adDate ?? b.ad_date;
    const adDateEnd = b.adDateEnd ?? b.ad_date_end;
    const womenOnly = b.womenOnly ?? b.women_only;

    const holiday = await prisma.holiday.update({
      where: { id: req.params.id },
      data: {
        bsYear, bsMonth, bsDay,
        bsDayEnd: bsDayEnd ?? undefined,
        bsMonthEnd: bsMonthEnd ?? undefined,
        name, nameNp: nameNp ?? undefined,
        adDate: adDate ? new Date(adDate) : undefined,
        adDateEnd: adDateEnd ? new Date(adDateEnd) : undefined,
        womenOnly: womenOnly ?? undefined,
      },
    });

    res.json({ holiday, message: 'Holiday updated' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/holidays/:id
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
