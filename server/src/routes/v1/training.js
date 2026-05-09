const { Router } = require('express');
const { requireRole } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ══════════════════════════════════════════════════════════════════════════════
// COURSES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/training/courses
router.get('/courses', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const courses = await prisma.trainingCourse.findMany({
      where: { orgId: req.orgId },
      include: { _count: { select: { sessions: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ courses });
  } catch (err) { next(err); }
});

// POST /api/v1/training/courses
router.post('/courses', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, category, description, duration, isExternal, provider, isMandatory, applicableDepts } = req.body;
    if (!name) return res.status(400).json({ error: 'Course name is required' });

    const course = await prisma.trainingCourse.create({
      data: { orgId: req.orgId, name, category, description, duration, isExternal, provider, isMandatory, applicableDepts: applicableDepts || [] },
    });
    res.status(201).json({ course });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Course name already exists' });
    next(err);
  }
});

// PUT /api/v1/training/courses/:id
router.put('/courses/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const course = await prisma.trainingCourse.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: req.body,
    });
    res.json({ course });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Course not found' });
    next(err);
  }
});

// DELETE /api/v1/training/courses/:id
router.delete('/courses/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.trainingCourse.delete({ where: { id: req.params.id, orgId: req.orgId } });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/training/sessions
router.get('/sessions', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { courseId, status } = req.query;
    const where = { orgId: req.orgId };
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    const sessions = await prisma.trainingSession.findMany({
      where,
      include: {
        course: { select: { id: true, name: true } },
        trainer: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json({ sessions });
  } catch (err) { next(err); }
});

// POST /api/v1/training/sessions
router.post('/sessions', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { courseId, title, trainerId, startDate, endDate, location, maxParticipants } = req.body;
    if (!courseId || !title || !startDate || !endDate) return res.status(400).json({ error: 'courseId, title, startDate, endDate required' });

    const session = await prisma.trainingSession.create({
      data: { orgId: req.orgId, courseId, title, trainerId, startDate: new Date(startDate), endDate: new Date(endDate), location, maxParticipants },
    });
    res.status(201).json({ session });
  } catch (err) { next(err); }
});

// PUT /api/v1/training/sessions/:id
router.put('/sessions/:id', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, title, startDate, endDate, location, maxParticipants } = req.body;
    const session = await prisma.trainingSession.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: { ...(status && { status }), ...(title && { title }), ...(startDate && { startDate: new Date(startDate) }), ...(endDate && { endDate: new Date(endDate) }), location, maxParticipants },
    });
    res.json({ session });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Session not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ENROLLMENTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/training/sessions/:sessionId/enrollments
router.get('/sessions/:sessionId/enrollments', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const enrollments = await prisma.trainingEnrollment.findMany({
      where: { sessionId: req.params.sessionId },
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
    });
    res.json({ enrollments });
  } catch (err) { next(err); }
});

// POST /api/v1/training/enroll
router.post('/enroll', requireRole('org_admin', 'hr'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { sessionId, employeeIds } = req.body;
    if (!sessionId || !employeeIds?.length) return res.status(400).json({ error: 'sessionId and employeeIds required' });

    const enrollments = await prisma.$transaction(
      employeeIds.map(empId => prisma.trainingEnrollment.create({
        data: { sessionId, employeeId: empId },
      }))
    );
    res.status(201).json({ enrollments });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Some employees already enrolled' });
    next(err);
  }
});

// PUT /api/v1/training/enrollments/:id
router.put('/enrollments/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, score, feedback } = req.body;
    const enrollment = await prisma.trainingEnrollment.update({
      where: { id: req.params.id },
      data: { ...(status && { status }), ...(score !== undefined && { score }), ...(feedback !== undefined && { feedback }), ...(status === 'COMPLETED' && { completedAt: new Date() }) },
    });
    res.json({ enrollment });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Enrollment not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CERTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/training/certifications
router.get('/certifications', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId } = req.query;
    const where = { orgId: req.orgId };
    if (employeeId) where.employeeId = employeeId;

    const certifications = await prisma.certification.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { issueDate: 'desc' },
    });
    res.json({ certifications });
  } catch (err) { next(err); }
});

// POST /api/v1/training/certifications
router.post('/certifications', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { employeeId, name, issuingAuthority, issueDate, expiryDate, credentialId, documentUrl } = req.body;
    if (!name || !issuingAuthority || !issueDate) return res.status(400).json({ error: 'name, issuingAuthority, issueDate required' });

    const cert = await prisma.certification.create({
      data: { orgId: req.orgId, employeeId: employeeId || req.user.id, name, issuingAuthority, issueDate: new Date(issueDate), expiryDate: expiryDate ? new Date(expiryDate) : null, credentialId, documentUrl },
    });
    res.status(201).json({ certification: cert });
  } catch (err) { next(err); }
});

// PUT /api/v1/training/certifications/:id
router.put('/certifications/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status, expiryDate, documentUrl } = req.body;
    const cert = await prisma.certification.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: { ...(status && { status }), ...(expiryDate && { expiryDate: new Date(expiryDate) }), ...(documentUrl && { documentUrl }) },
    });
    res.json({ certification: cert });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Certification not found' });
    next(err);
  }
});

module.exports = router;
