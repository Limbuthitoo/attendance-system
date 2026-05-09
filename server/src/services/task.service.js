// ─────────────────────────────────────────────────────────────────────────────
// Task Service — Task CRUD, assignment, completion tracking
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

async function listTasks({ orgId, status, assignedTo, projectId }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (assignedTo) where.assignedTo = assignedTo;
  if (projectId) where.projectId = projectId;
  return prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, department: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
}

async function getTask({ orgId, id }) {
  const prisma = getPrisma();
  const task = await prisma.task.findFirst({
    where: { id, orgId },
    include: {
      assignee: { select: { id: true, name: true, department: true } },
      project: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });
  return task;
}

async function createTask({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.task.create({
    data: {
      orgId,
      title: data.title,
      description: data.description || null,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
      assignedTo: data.assignedTo || null,
      projectId: data.projectId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours || null,
      tags: data.tags || [],
      createdBy: userId,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
}

async function updateTask({ orgId, id, data }) {
  const prisma = getPrisma();
  const updateData = {};
  if (data.title) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority) updateData.priority = data.priority;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
  if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
  if (data.tags) updateData.tags = data.tags;

  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'DONE') updateData.completedAt = new Date();
    else if (data.status !== 'DONE') updateData.completedAt = null;
  }

  return prisma.task.update({ where: { id }, data: updateData });
}

async function deleteTask({ orgId, id }) {
  const prisma = getPrisma();
  return prisma.task.delete({ where: { id } });
}

// ── My Tasks ─────────────────────────────────────────────────────────────────

async function getMyTasks({ orgId, userId, status }) {
  const prisma = getPrisma();
  const where = { orgId, assignedTo: userId };
  if (status) where.status = status;
  return prisma.task.findMany({
    where,
    include: { project: { select: { id: true, name: true } } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  });
}

// ── Task Stats (for incentive calculator) ────────────────────────────────────

async function getTaskStats({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const completed = await prisma.task.count({
    where: {
      orgId,
      assignedTo: employeeId,
      status: 'DONE',
      completedAt: { gte: startDate, lte: endDate },
    },
  });

  const total = await prisma.task.count({
    where: {
      orgId,
      assignedTo: employeeId,
      createdAt: { lte: endDate },
      OR: [
        { completedAt: { gte: startDate, lte: endDate } },
        { status: { not: 'DONE' }, createdAt: { lte: endDate } },
      ],
    },
  });

  // Count on-time completions by fetching tasks with due dates and comparing in JS
  const tasksWithDue = await prisma.task.findMany({
    where: {
      orgId,
      assignedTo: employeeId,
      status: 'DONE',
      completedAt: { gte: startDate, lte: endDate },
      dueDate: { not: null },
    },
    select: { completedAt: true, dueDate: true },
  });
  const onTime = tasksWithDue.filter(t => t.completedAt <= t.dueDate).length;

  return { completed, total, onTimeRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

module.exports = {
  listTasks, getTask, createTask, updateTask, deleteTask,
  getMyTasks, getTaskStats,
};
