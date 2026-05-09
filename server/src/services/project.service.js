// ─────────────────────────────────────────────────────────────────────────────
// Project Service — Projects, Members, Progress
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

async function listProjects({ orgId, status, managerId }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (managerId) where.managerId = managerId;
  return prisma.project.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getProject({ orgId, id }) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id, orgId },
    include: {
      manager: { select: { id: true, name: true } },
      members: {
        include: { employee: { select: { id: true, name: true, department: true } } },
      },
      tasks: {
        select: { id: true, title: true, status: true, priority: true, assignedTo: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: { select: { tasks: true, members: true } },
    },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
  return project;
}

async function createProject({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.project.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      budget: data.budget || null,
      managerId: data.managerId || null,
      createdBy: userId,
    },
  });
}

async function updateProject({ orgId, id, data }) {
  const prisma = getPrisma();
  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status) updateData.status = data.status;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.managerId !== undefined) updateData.managerId = data.managerId;
  if (data.progress !== undefined) updateData.progress = Number(data.progress);
  return prisma.project.update({ where: { id }, data: updateData });
}

async function deleteProject({ orgId, id }) {
  const prisma = getPrisma();
  return prisma.project.delete({ where: { id } });
}

// ── Members ──────────────────────────────────────────────────────────────────

async function addMember({ orgId, projectId, data }) {
  const prisma = getPrisma();
  return prisma.projectMember.create({
    data: {
      orgId,
      projectId,
      employeeId: data.employeeId,
      role: data.role || 'member',
    },
  });
}

async function removeMember({ orgId, projectId, memberId }) {
  const prisma = getPrisma();
  return prisma.projectMember.delete({ where: { id: memberId } });
}

// ── Project Stats (for incentive calculator) ─────────────────────────────────

async function getProjectStats({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Projects where employee is a member that were completed this month
  const memberProjects = await prisma.projectMember.findMany({
    where: { orgId, employeeId },
    select: { projectId: true },
  });
  const projectIds = memberProjects.map((m) => m.projectId);

  const completedProjects = await prisma.project.count({
    where: {
      id: { in: projectIds },
      status: 'COMPLETED',
      updatedAt: { gte: startDate, lte: endDate },
    },
  });

  return { completedProjects, totalProjects: projectIds.length };
}

module.exports = {
  listProjects, getProject, createProject, updateProject, deleteProject,
  addMember, removeMember,
  getProjectStats,
};
