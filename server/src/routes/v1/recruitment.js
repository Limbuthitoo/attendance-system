const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const router = Router();

function getPrisma() {
  return require('../../lib/prisma').getPrisma();
}

// ══════════════════════════════════════════════════════════════════════════════
// JOB POSTINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/recruitment/jobs
router.get('/jobs', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { status } = req.query;
    const where = { orgId: req.orgId };
    if (status) where.status = status;
    const jobs = await prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applicants: true } } },
    });
    res.json({ jobs });
  } catch (err) { next(err); }
});

// GET /api/v1/recruitment/jobs/:id
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const job = await prisma.jobPosting.findUnique({
      where: { id: req.params.id, orgId: req.orgId },
      include: {
        _count: { select: { applicants: true } },
        applicants: {
          orderBy: { createdAt: 'desc' },
          include: {
            interviews: {
              orderBy: { scheduledAt: 'desc' },
              include: { interviewer: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job posting not found' });
    res.json({ job });
  } catch (err) { next(err); }
});

// POST /api/v1/recruitment/jobs
router.post('/jobs', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { title, department, description, requirements, location, employmentType, openings, deadline, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const job = await prisma.jobPosting.create({
      data: {
        orgId: req.orgId,
        title,
        department: department || null,
        description: description || null,
        requirements: requirements || null,
        location: location || null,
        employmentType: employmentType || 'FULL_TIME',
        vacancies: openings || 1,
        closingDate: deadline ? new Date(deadline) : null,
        status: status || 'OPEN',
        createdBy: req.user.id,
      },
    });
    res.status(201).json({ job });
  } catch (err) { next(err); }
});

// PUT /api/v1/recruitment/jobs/:id
router.put('/jobs/:id', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { title, department, description, requirements, location, employmentType, openings, deadline, status } = req.body;
    const job = await prisma.jobPosting.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: { title, department, description, requirements, location, employmentType, vacancies: openings, closingDate: deadline ? new Date(deadline) : undefined, status },
    });
    res.json({ job });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Job posting not found' });
    next(err);
  }
});

// DELETE /api/v1/recruitment/jobs/:id
router.delete('/jobs/:id', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    await prisma.jobPosting.delete({ where: { id: req.params.id, orgId: req.orgId } });
    res.json({ message: 'Job posting deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// APPLICANTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/recruitment/applicants
router.get('/applicants', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { jobId, status } = req.query;
    const where = { orgId: req.orgId };
    if (jobId) where.jobPostingId = jobId;
    if (status) where.status = status;

    const applicants = await prisma.applicant.findMany({
      where,
      include: { jobPosting: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ applicants });
  } catch (err) { next(err); }
});

// POST /api/v1/recruitment/applicants
router.post('/applicants', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { jobPostingId, name, email, phone, resumeUrl, coverLetter, source, status, rating, notes } = req.body;
    if (!name || !email || !jobPostingId) return res.status(400).json({ error: 'Name, email and jobPostingId are required' });

    const applicant = await prisma.applicant.create({
      data: {
        orgId: req.orgId,
        jobPostingId,
        name,
        email,
        phone: phone || null,
        resumeUrl: resumeUrl || null,
        coverLetter: coverLetter || null,
        source: source || null,
        status: status || 'NEW',
        rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
        notes: notes || null,
      },
    });
    res.status(201).json({ applicant });
  } catch (err) { next(err); }
});

// PUT /api/v1/recruitment/applicants/:id
router.put('/applicants/:id', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { jobPostingId, name, email, phone, resumeUrl, coverLetter, source, status, rating, notes } = req.body;
    const applicant = await prisma.applicant.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: {
        ...(jobPostingId && { jobPostingId }),
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(resumeUrl !== undefined && { resumeUrl }),
        ...(coverLetter !== undefined && { coverLetter }),
        ...(source !== undefined && { source }),
        ...(status && { status }),
        ...(rating !== undefined && { rating: rating === '' || rating === null ? null : Number(rating) }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json({ applicant });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Applicant not found' });
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INTERVIEWS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/recruitment/interviews
router.get('/interviews', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { applicantId } = req.query;
    const where = { orgId: req.orgId };
    if (applicantId) where.applicantId = applicantId;

    const interviews = await prisma.interview.findMany({
      where,
      include: {
        applicant: { select: { id: true, name: true } },
        interviewer: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json({ interviews });
  } catch (err) { next(err); }
});

// POST /api/v1/recruitment/interviews
router.post('/interviews', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { applicantId, interviewerId, scheduledAt, type, location, notes, duration, status, rating, feedback } = req.body;
    if (!applicantId || !interviewerId || !scheduledAt) return res.status(400).json({ error: 'applicantId, interviewerId and scheduledAt required' });

    const interview = await prisma.interview.create({
      data: {
        orgId: req.orgId,
        applicantId,
        interviewerId,
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        type: type || 'IN_PERSON',
        location: location || null,
        notes: notes || null,
        status: status || 'SCHEDULED',
        rating: rating !== undefined && rating !== '' ? Number(rating) : undefined,
        feedback: feedback || null,
      },
    });
    res.status(201).json({ interview });
  } catch (err) { next(err); }
});

// PUT /api/v1/recruitment/interviews/:id
router.put('/interviews/:id', requirePermission('recruitment.manage'), async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { applicantId, interviewerId, scheduledAt, duration, type, location, notes, status, rating, feedback } = req.body;
    const interview = await prisma.interview.update({
      where: { id: req.params.id, orgId: req.orgId },
      data: {
        ...(applicantId && { applicantId }),
        ...(interviewerId && { interviewerId }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(duration !== undefined && { duration }),
        ...(type && { type }),
        ...(location !== undefined && { location }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
        ...(rating !== undefined && { rating: rating === '' || rating === null ? null : Number(rating) }),
        ...(feedback !== undefined && { feedback }),
      },
    });
    res.json({ interview });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Interview not found' });
    next(err);
  }
});

module.exports = router;
