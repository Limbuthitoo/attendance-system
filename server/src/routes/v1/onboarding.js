const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING TEMPLATES & TASKS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/onboarding/templates
router.get('/templates', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const templates = await prisma.onboardingTemplate.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: 'asc' },
    });
    res.json({ templates });
  } catch (err) { next(err); }
});

// POST /api/v1/onboarding/templates
router.post('/templates', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, department, tasks } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    const template = await prisma.onboardingTemplate.create({
      data: {
        orgId: req.orgId,
        name,
        department: department || null,
        tasks: tasks || [],
      },
    });
    res.status(201).json({ template });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Template name already exists' });
    next(err);
  }
});

// GET /api/v1/onboarding/tasks — tasks for an employee
router.get('/tasks', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, status } = req.query;
    const where = { orgId: req.orgId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const tasks = await prisma.onboardingTask.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ tasks });
  } catch (err) { next(err); }
});

// POST /api/v1/onboarding/assign — assign a template to a new employee
router.post('/assign', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { templateId, employeeId } = req.body;
    if (!templateId || !employeeId) return res.status(400).json({ error: 'templateId and employeeId required' });

    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId, orgId: req.orgId },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Clone template tasks for this employee
    const taskList = Array.isArray(template.tasks) ? template.tasks : [];
    const created = await prisma.$transaction(
      taskList.map((t, i) => prisma.onboardingTask.create({
        data: { orgId: req.orgId, employeeId, title: t.title || `Task ${i + 1}`, description: t.description || null, category: t.category || 'general', sortOrder: i },
      }))
    );
    res.status(201).json({ tasks: created });
  } catch (err) { next(err); }
});

// PUT /api/v1/onboarding/tasks/:id
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.body;
    const task = await prisma.onboardingTask.update({
      where: { id: req.params.id },
      data: { status, ...(status === 'COMPLETED' && { completedAt: new Date() }) },
    });
    res.json({ task });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    next(err);
  }
});

module.exports = router;
