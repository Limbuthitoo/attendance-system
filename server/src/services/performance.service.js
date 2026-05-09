// ─────────────────────────────────────────────────────────────────────────────
// Performance / KPI Service — KPI Definitions, Scores, Review Cycles
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

// ── KPI Definitions ──────────────────────────────────────────────────────────

async function listKpis({ orgId, department }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (department) where.department = department;
  return prisma.kpiDefinition.findMany({
    where,
    include: { _count: { select: { scores: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function createKpi({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.kpiDefinition.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      unit: data.unit || 'number',
      targetValue: data.targetValue || 0,
      weight: data.weight || 1,
      department: data.department || null,
      designation: data.designation || null,
      frequency: data.frequency || 'monthly',
      createdBy: userId,
    },
  });
}

async function updateKpi({ orgId, id, data }) {
  const prisma = getPrisma();
  return prisma.kpiDefinition.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.unit && { unit: data.unit }),
      ...(data.targetValue !== undefined && { targetValue: data.targetValue }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.designation !== undefined && { designation: data.designation }),
      ...(data.frequency && { frequency: data.frequency }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

async function deleteKpi({ orgId, id }) {
  const prisma = getPrisma();
  return prisma.kpiDefinition.delete({ where: { id } });
}

// ── KPI Scores ───────────────────────────────────────────────────────────────

async function listScores({ orgId, employeeId, kpiId, year, month }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (employeeId) where.employeeId = employeeId;
  if (kpiId) where.kpiId = kpiId;
  if (year) where.year = Number(year);
  if (month) where.month = Number(month);
  return prisma.kpiScore.findMany({
    where,
    include: {
      kpi: { select: { id: true, name: true, unit: true, targetValue: true, weight: true } },
      employee: { select: { id: true, name: true, department: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

async function upsertScore({ orgId, data, userId }) {
  const prisma = getPrisma();
  const kpi = await prisma.kpiDefinition.findFirst({ where: { id: data.kpiId, orgId } });
  if (!kpi) throw Object.assign(new Error('KPI not found'), { status: 404 });

  const target = Number(kpi.targetValue);
  const actual = Number(data.actualValue || 0);
  const weight = Number(kpi.weight);
  const score = target > 0 ? Math.min((actual / target) * weight * 100, weight * 100) : 0;

  return prisma.kpiScore.upsert({
    where: {
      kpiId_employeeId_year_month: {
        kpiId: data.kpiId,
        employeeId: data.employeeId,
        year: Number(data.year),
        month: Number(data.month),
      },
    },
    create: {
      orgId,
      kpiId: data.kpiId,
      employeeId: data.employeeId,
      year: Number(data.year),
      month: Number(data.month),
      actualValue: data.actualValue,
      score: Math.round(score * 100) / 100,
      notes: data.notes || null,
      scoredBy: userId,
    },
    update: {
      actualValue: data.actualValue,
      score: Math.round(score * 100) / 100,
      notes: data.notes || null,
      scoredBy: userId,
    },
  });
}

// ── Review Cycles ────────────────────────────────────────────────────────────

async function listCycles({ orgId, year }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (year) where.year = Number(year);
  return prisma.reviewCycle.findMany({
    where,
    include: { _count: { select: { reviews: true } } },
    orderBy: { startDate: 'desc' },
  });
}

async function createCycle({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.reviewCycle.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      year: Number(data.year),
      quarter: data.quarter ? Number(data.quarter) : null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      createdBy: userId,
    },
  });
}

async function updateCycle({ orgId, id, data }) {
  const prisma = getPrisma();
  return prisma.reviewCycle.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
    },
  });
}

// ── Performance Reviews ──────────────────────────────────────────────────────

async function listReviews({ orgId, cycleId, employeeId }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (cycleId) where.cycleId = cycleId;
  if (employeeId) where.employeeId = employeeId;
  return prisma.performanceReview.findMany({
    where,
    include: {
      cycle: { select: { id: true, name: true, year: true } },
      employee: { select: { id: true, name: true, department: true, designation: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function createReview({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.performanceReview.create({
    data: {
      orgId,
      cycleId: data.cycleId,
      employeeId: data.employeeId,
      reviewerId: data.reviewerId || userId,
      selfRating: data.selfRating || null,
      managerRating: data.managerRating || null,
      strengths: data.strengths || null,
      improvements: data.improvements || null,
      comments: data.comments || null,
    },
  });
}

async function updateReview({ orgId, id, data }) {
  const prisma = getPrisma();
  const updateData = {};
  if (data.selfRating !== undefined) updateData.selfRating = data.selfRating;
  if (data.managerRating !== undefined) updateData.managerRating = data.managerRating;
  if (data.overallScore !== undefined) updateData.overallScore = data.overallScore;
  if (data.strengths !== undefined) updateData.strengths = data.strengths;
  if (data.improvements !== undefined) updateData.improvements = data.improvements;
  if (data.comments !== undefined) updateData.comments = data.comments;
  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'COMPLETED') updateData.completedAt = new Date();
  }
  return prisma.performanceReview.update({ where: { id }, data: updateData });
}

// ── Performance Stats (for incentive calculator) ─────────────────────────────

async function getPerformanceScore({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  const scores = await prisma.kpiScore.findMany({
    where: { orgId, employeeId, year: Number(year), month: Number(month) },
    include: { kpi: { select: { weight: true, targetValue: true } } },
  });
  if (scores.length === 0) return { averageScore: 0, totalKpis: 0 };

  const totalWeight = scores.reduce((sum, s) => sum + Number(s.kpi.weight), 0);
  const weightedScore = scores.reduce((sum, s) => sum + Number(s.score), 0);
  const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return { averageScore: Math.round(averageScore * 100) / 100, totalKpis: scores.length };
}

module.exports = {
  listKpis, createKpi, updateKpi, deleteKpi,
  listScores, upsertScore,
  listCycles, createCycle, updateCycle,
  listReviews, createReview, updateReview,
  getPerformanceScore,
};
