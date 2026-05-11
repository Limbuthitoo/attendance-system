// ─────────────────────────────────────────────────────────────────────────────
// Notice Routes (v1)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const { getPrisma } = require('../../lib/prisma');
const { enqueuePush } = require('../../config/queue');
const { createBulkNotifications } = require('../../services/notification.service');

const router = Router();

// GET /api/v1/notices
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const notices = await prisma.notice.findMany({
      where: { orgId: req.orgId },
      include: { publisher: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(req.query.limit) || 50,
    });

    // Add backward compat fields
    const mapped = notices.map(n => ({
      ...n,
      created_at: n.createdAt,
      published_by_name: n.publisher?.name || null,
      type: (n.type || '').toLowerCase(),
    }));

    res.json({ notices: mapped });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notices
router.post('/', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { title, body, type, target } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' });
    }

    const notice = await prisma.notice.create({
      data: {
        orgId: req.orgId,
        title,
        body,
        type: (type || 'general').toUpperCase(),
        target: target || 'all',
        publishedBy: req.user.id,
      },
    });

    // Send push + in-app notifications to target employees
    const employees = await prisma.employee.findMany({
      where: { orgId: req.orgId, isActive: true },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    await Promise.all([
      enqueuePush({
        employeeIds,
        title: `📢 ${title}`,
        body: body.substring(0, 200),
        data: { type: 'notice', noticeId: notice.id },
        orgId: req.orgId,
        notificationType: 'NOTICE',
      }),
      createBulkNotifications({
        orgId: req.orgId,
        employeeIds,
        title,
        body: body.substring(0, 500),
        type: 'NOTICE',
        referenceType: 'notice',
        referenceId: notice.id,
      }),
    ]);

    res.status(201).json({ notice, message: 'Notice published' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notices/:id
router.delete('/:id', requireRole('org_admin'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const existing = await prisma.notice.findFirst({ where: { id: req.params.id, orgId: req.orgId } });
    if (!existing) return res.status(404).json({ error: 'Notice not found' });
    await prisma.notice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Notice deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
