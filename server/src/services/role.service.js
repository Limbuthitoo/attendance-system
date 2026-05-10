// ─────────────────────────────────────────────────────────────────────────────
// Role Service — RBAC role management, permission assignment
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { invalidateUserCache } = require('../middleware/cache');

// All available permissions in the system
const ALL_PERMISSIONS = [
  // Employee
  'employee.view', 'employee.create', 'employee.update', 'employee.delete',
  // Attendance
  'attendance.view_own', 'attendance.check_in', 'attendance.check_out',
  'attendance.view_all', 'attendance.manage',
  // Leave
  'leave.view_own', 'leave.apply', 'leave.view_all', 'leave.approve', 'leave.reject',
  // Device
  'device.view', 'device.manage', 'credential.manage',
  // Settings
  'settings.view', 'settings.update',
  // Holiday
  'holiday.manage',
  // Notice
  'notice.manage',
  // Report
  'report.view',
  // Branch
  'branch.manage',
  // Shift & Schedule
  'shift.manage', 'schedule.manage',
  // Role
  'role.manage',
  // Audit
  'audit.view',
  // Profile
  'profile.view', 'profile.update',
  // Notification
  'notification.view',
];

/**
 * List all roles (system + org-specific)
 */
async function listRoles(orgId) {
  const prisma = getPrisma();

  return prisma.role.findMany({
    where: {
      OR: [
        { orgId: null },  // system roles
        { orgId },        // org-specific roles
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      isSystem: true,
      orgId: true,
      createdAt: true,
      _count: { select: { employeeRoles: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
  });
}

/**
 * Create a custom role for an organization
 */
async function createRole({ orgId, name, description, permissions, adminId, req }) {
  const prisma = getPrisma();

  // Validate permissions
  const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length > 0) {
    throw Object.assign(new Error(`Invalid permissions: ${invalid.join(', ')}`), { status: 400 });
  }

  const role = await prisma.role.create({
    data: {
      orgId,
      name,
      description: description || null,
      permissions,
      isSystem: false,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'role.create',
    resource: 'role',
    resourceId: role.id,
    newData: { name, permissions },
    req,
  });

  return role;
}

/**
 * Update a custom role (system roles cannot be modified)
 */
async function updateRole({ roleId, orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.role.findFirst({ where: { id: roleId } });
  if (!existing) {
    throw Object.assign(new Error('Role not found'), { status: 404 });
  }
  if (existing.isSystem) {
    throw Object.assign(new Error('System roles cannot be modified'), { status: 403 });
  }
  if (existing.orgId !== orgId) {
    throw Object.assign(new Error('Cannot modify roles from another organization'), { status: 403 });
  }

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.permissions) {
    const invalid = data.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw Object.assign(new Error(`Invalid permissions: ${invalid.join(', ')}`), { status: 400 });
    }
    updateData.permissions = data.permissions;
  }

  const role = await prisma.role.update({
    where: { id: roleId },
    data: updateData,
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'role.update',
    resource: 'role',
    resourceId: roleId,
    oldData: { name: existing.name, permissions: existing.permissions },
    newData: updateData,
    req,
  });

  return role;
}

/**
 * Delete a custom role (system roles cannot be deleted)
 */
async function deleteRole({ roleId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.role.findFirst({ where: { id: roleId } });
  if (!existing) {
    throw Object.assign(new Error('Role not found'), { status: 404 });
  }
  if (existing.isSystem) {
    throw Object.assign(new Error('System roles cannot be deleted'), { status: 403 });
  }
  if (existing.orgId !== orgId) {
    throw Object.assign(new Error('Cannot delete roles from another organization'), { status: 403 });
  }

  // Check if any employees are using this role
  const assignedCount = await prisma.employeeRole.count({ where: { roleId } });
  if (assignedCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete role — ${assignedCount} employee(s) are assigned to it. Reassign them first.`),
      { status: 409 }
    );
  }

  await prisma.role.delete({ where: { id: roleId } });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'role.delete',
    resource: 'role',
    resourceId: roleId,
    oldData: { name: existing.name },
    req,
  });
}

/**
 * Assign a role to an employee
 */
async function assignRoleToEmployee({ employeeId, roleId, branchId, orgId, adminId, req }) {
  const prisma = getPrisma();

  // Verify employee belongs to org
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, orgId } });
  if (!employee) {
    throw Object.assign(new Error('Employee not found in this organization'), { status: 404 });
  }

  // Verify role is accessible (system or same org)
  const role = await prisma.role.findFirst({
    where: { id: roleId, OR: [{ orgId: null }, { orgId }] },
  });
  if (!role) {
    throw Object.assign(new Error('Role not found'), { status: 404 });
  }

  const assignment = await prisma.employeeRole.upsert({
    where: {
      employeeId_roleId_branchId: {
        employeeId,
        roleId,
        branchId: branchId || null,
      },
    },
    create: {
      employeeId,
      roleId,
      branchId: branchId || null,
      grantedBy: adminId,
    },
    update: {
      grantedBy: adminId,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'role.assign',
    resource: 'employee_role',
    resourceId: assignment.id,
    newData: { employeeId, roleName: role.name, branchId },
    req,
  });

  // Bust auth cache so new role takes effect immediately
  invalidateUserCache(employeeId).catch(() => {});

  return assignment;
}

/**
 * Remove a role from an employee
 */
async function removeRoleFromEmployee({ employeeId, roleId, branchId, orgId, adminId, req }) {
  const prisma = getPrisma();

  await prisma.employeeRole.deleteMany({
    where: {
      employeeId,
      roleId,
      branchId: branchId || null,
    },
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'role.remove',
    resource: 'employee_role',
    newData: { employeeId, roleId, branchId },
    req,
  });

  invalidateUserCache(employeeId).catch(() => {});
}

/**
 * Get roles for a specific employee
 */
async function getEmployeeRoles(employeeId) {
  const prisma = getPrisma();

  return prisma.employeeRole.findMany({
    where: { employeeId },
    include: {
      role: { select: { id: true, name: true, description: true, permissions: true, isSystem: true } },
    },
  });
}

/**
 * Get all available permissions (for UI)
 */
function getAvailablePermissions() {
  const grouped = {};
  for (const perm of ALL_PERMISSIONS) {
    const [category] = perm.split('.');
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(perm);
  }
  return { permissions: ALL_PERMISSIONS, grouped };
}

module.exports = {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToEmployee,
  removeRoleFromEmployee,
  getEmployeeRoles,
  getAvailablePermissions,
  ALL_PERMISSIONS,
};
