// ─────────────────────────────────────────────────────────────────────────────
// Branch Service — CRUD for branches within an organization
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');

/**
 * List branches for an organization
 */
async function listBranches(orgId) {
  const prisma = getPrisma();

  return prisma.branch.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      city: true,
      country: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          employeeAssignments: { where: { isCurrent: true } },
          devices: { where: { isActive: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get a single branch with details
 */
async function getBranch(branchId, orgId) {
  const prisma = getPrisma();

  return prisma.branch.findFirst({
    where: { id: branchId, orgId },
    include: {
      shifts: {
        where: { isActive: true },
        select: { id: true, name: true, startTime: true, endTime: true, isDefault: true },
      },
      devices: {
        where: { isActive: true },
        select: { id: true, deviceType: true, name: true, location: true, lastHeartbeatAt: true },
      },
      employeeAssignments: {
        where: { isCurrent: true },
        select: {
          employee: { select: { id: true, name: true, employeeCode: true, department: true } },
          shift: { select: { name: true } },
          workSchedule: { select: { name: true } },
        },
      },
      _count: {
        select: {
          employeeAssignments: { where: { isCurrent: true } },
          devices: { where: { isActive: true } },
        },
      },
    },
  });
}

/**
 * Create a new branch
 */
async function createBranch({ orgId, data, actorId, actorType = 'employee', req }) {
  const prisma = getPrisma();

  // Block if org subscription is not active
  const { requireActiveSubscription } = require('../lib/subscription');
  await requireActiveSubscription(orgId);

  // Check org branch limit
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxBranches: true },
  });
  const currentCount = await prisma.branch.count({ where: { orgId } });
  if (currentCount >= org.maxBranches) {
    throw Object.assign(
      new Error(`Branch limit reached (${org.maxBranches}). Upgrade your plan.`),
      { status: 403 }
    );
  }

  const branch = await prisma.branch.create({
    data: {
      orgId,
      name: data.name,
      code: data.code,
      address: data.address || null,
      city: data.city || null,
      country: data.country || 'Nepal',
      timezone: data.timezone || 'Asia/Kathmandu',
    },
  });

  await auditLog({
    orgId,
    actorId,
    actorType,
    action: 'branch.create',
    resource: 'branch',
    resourceId: branch.id,
    newData: { name: data.name, code: data.code },
    req,
  });

  return branch;
}

/**
 * Update a branch
 */
async function updateBranch({ branchId, orgId, data, actorId, actorType = 'employee', req }) {
  const prisma = getPrisma();

  const existing = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!existing) {
    throw Object.assign(new Error('Branch not found'), { status: 404 });
  }

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.code) updateData.code = data.code;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.city !== undefined) updateData.city = data.city || null;
  if (data.country) updateData.country = data.country;
  if (data.timezone) updateData.timezone = data.timezone;
  if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: updateData,
  });

  await auditLog({
    orgId,
    actorId,
    actorType,
    action: 'branch.update',
    resource: 'branch',
    resourceId: branchId,
    oldData: { name: existing.name, code: existing.code },
    newData: updateData,
    req,
  });

  return branch;
}

/**
 * Deactivate a branch
 */
async function deactivateBranch({ branchId, orgId, actorId, actorType = 'employee', req }) {
  return updateBranch({
    branchId,
    orgId,
    data: { isActive: false },
    actorId,
    actorType,
    req,
  });
}

module.exports = {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  deactivateBranch,
};
