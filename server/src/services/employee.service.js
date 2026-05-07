// ─────────────────────────────────────────────────────────────────────────────
// Employee Service — CRUD, profile management
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { validatePassword, validateEmail } = require('../lib/validation');
const { requireActiveSubscription } = require('../lib/subscription');
const { SALT_ROUNDS } = require('./auth.service');

/**
 * List employees for an org (with optional filters)
 */
async function listEmployees({ orgId, search, department, isActive, page = 1, limit = 50 }) {
  const prisma = getPrisma();

  const where = { orgId };

  if (typeof isActive === 'boolean') where.isActive = isActive;
  if (department) where.department = department;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        department: true,
        designation: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        lockedUntil: true,
        createdAt: true,
        employeeRoles: {
          select: { role: { select: { name: true } } },
        },
        assignments: {
          where: { isCurrent: true },
          select: {
            branch: { select: { id: true, name: true } },
            shift: { select: { id: true, name: true } },
            workSchedule: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    employees: employees.map((e) => {
      const roles = e.employeeRoles.map((er) => er.role.name);
      const role = roles.some((r) => ['org_admin', 'hr_manager', 'branch_manager'].includes(r))
        ? 'admin'
        : 'employee';
      return {
        ...e,
        roles,
        role,                               // backward compat
        employee_id: e.employeeCode,        // backward compat
        is_active: e.isActive ? 1 : 0,     // backward compat (integer)
        currentAssignment: e.assignments[0] || null,
        employeeRoles: undefined,
        assignments: undefined,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single employee by ID
 */
async function getEmployee(employeeId, orgId) {
  const prisma = getPrisma();

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      email: true,
      department: true,
      designation: true,
      phone: true,
      gender: true,
      joinDate: true,
      employmentStatus: true,
      avatarUrl: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      // Personal info
      dateOfBirth: true,
      bloodGroup: true,
      maritalStatus: true,
      address: true,
      city: true,
      state: true,
      country: true,
      zipCode: true,
      // Employment info
      contractType: true,
      probationEndDate: true,
      panNumber: true,
      ssfNumber: true,
      // Bank details
      bankName: true,
      bankBranch: true,
      bankAccountNumber: true,
      bankAccountName: true,
      employeeRoles: {
        select: {
          branchId: true,
          role: { select: { id: true, name: true, permissions: true } },
        },
      },
      assignments: {
        where: { isCurrent: true },
        select: {
          branch: { select: { id: true, name: true, code: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          workSchedule: { select: { id: true, name: true, workingDays: true } },
        },
        take: 1,
      },
      credentials: {
        where: { isActive: true },
        select: { id: true, credentialType: true, label: true, assignedAt: true },
      },
      emergencyContacts: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, name: true, type: true, fileSize: true, mimeType: true, uploadedAt: true },
      },
    },
  });

  if (!employee) return null;

  const roles = employee.employeeRoles.map((er) => er.role.name);
  const role = roles.some((r) => ['org_admin', 'hr_manager', 'branch_manager'].includes(r))
    ? 'admin'
    : 'employee';

  return {
    ...employee,
    roles,
    role,                                   // backward compat
    employee_id: employee.employeeCode,     // backward compat
    is_active: employee.isActive ? 1 : 0,  // backward compat
    currentAssignment: employee.assignments[0] || null,
    employeeRoles: undefined,
    assignments: undefined,
  };
}

/**
 * Create a new employee
 */
async function createEmployee({ orgId, data, adminId, req }) {
  const prisma = getPrisma();

  // Block if org subscription is not active
  await requireActiveSubscription(orgId);

  // Normalize field names (frontend sends employee_id, server uses employeeCode)
  const employeeCode = data.employeeCode || data.employee_id;
  if (!employeeCode) {
    throw Object.assign(new Error('Employee code is required'), { status: 400 });
  }

  if (!validateEmail(data.email)) {
    throw Object.assign(new Error('Invalid email format'), { status: 400 });
  }

  // Ensure email is unique across all active employees (all orgs)
  const existingActive = await prisma.employee.findFirst({
    where: { email: data.email, isActive: true },
    select: { id: true, orgId: true },
  });
  if (existingActive) {
    if (existingActive.orgId === orgId) {
      throw Object.assign(new Error('An employee with this email already exists'), { status: 409 });
    }
    throw Object.assign(new Error('This email is already in use by another organization. The employee must be deactivated there first.'), { status: 409 });
  }

  const validation = validatePassword(data.password);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error), { status: 400 });
  }

  // Check org employee limit
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxEmployees: true },
  });
  const currentCount = await prisma.employee.count({ where: { orgId } });
  if (currentCount >= org.maxEmployees) {
    throw Object.assign(new Error(`Employee limit reached (${org.maxEmployees}). Upgrade your plan.`), { status: 403 });
  }

  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const employee = await prisma.employee.create({
    data: {
      orgId,
      employeeCode,
      name: data.name,
      email: data.email,
      password: hash,
      department: data.department || 'General',
      designation: data.designation || 'Employee',
      phone: data.phone || null,
      mustChangePassword: true,
    },
  });

  // Assign role — accept roleId (UUID) or role name (e.g. "admin", "employee")
  let roleId = data.roleId;
  if (!roleId && data.role) {
    // Map legacy role names to actual role records
    const roleName = data.role === 'admin' ? 'org_admin' : 'employee';
    const roleRecord = await prisma.role.findFirst({ where: { name: roleName } });
    if (roleRecord) roleId = roleRecord.id;
  }
  if (roleId) {
    await prisma.employeeRole.create({
      data: {
        employeeId: employee.id,
        roleId,
        branchId: data.branchId || null,
        grantedBy: adminId,
      },
    });
  }

  // Create assignment if branch + shift specified
  if (data.branchId && data.shiftId && data.workScheduleId) {
    await prisma.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        branchId: data.branchId,
        shiftId: data.shiftId,
        workScheduleId: data.workScheduleId,
        effectiveFrom: new Date(),
        isCurrent: true,
      },
    });
  }

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'employee.create',
    resource: 'employee',
    resourceId: employee.id,
    newData: { employeeCode, name: data.name, email: data.email },
    req,
  });

  return employee;
}

/**
 * Update an employee
 */
async function updateEmployee({ employeeId, orgId, data, adminId, req }) {
  const prisma = getPrisma();

  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, orgId },
  });
  if (!existing) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.email) {
    if (!validateEmail(data.email)) {
      throw Object.assign(new Error('Invalid email format'), { status: 400 });
    }
    updateData.email = data.email;
  }
  if (data.department) updateData.department = data.department;
  if (data.designation) updateData.designation = data.designation;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;

  // Personal info fields
  if (data.gender !== undefined) updateData.gender = data.gender || null;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null;
  if (data.maritalStatus !== undefined) updateData.maritalStatus = data.maritalStatus || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.city !== undefined) updateData.city = data.city || null;
  if (data.state !== undefined) updateData.state = data.state || null;
  if (data.country !== undefined) updateData.country = data.country || null;
  if (data.zipCode !== undefined) updateData.zipCode = data.zipCode || null;

  // Employment info fields
  if (data.joinDate !== undefined) updateData.joinDate = data.joinDate ? new Date(data.joinDate) : null;
  if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus;
  if (data.contractType !== undefined) updateData.contractType = data.contractType || null;
  if (data.probationEndDate !== undefined) updateData.probationEndDate = data.probationEndDate ? new Date(data.probationEndDate) : null;
  if (data.panNumber !== undefined) updateData.panNumber = data.panNumber || null;
  if (data.ssfNumber !== undefined) updateData.ssfNumber = data.ssfNumber || null;

  // Bank details
  if (data.bankName !== undefined) updateData.bankName = data.bankName || null;
  if (data.bankBranch !== undefined) updateData.bankBranch = data.bankBranch || null;
  if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber || null;
  if (data.bankAccountName !== undefined) updateData.bankAccountName = data.bankAccountName || null;

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: updateData,
  });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'employee.update',
    resource: 'employee',
    resourceId: employeeId,
    oldData: { name: existing.name, email: existing.email, department: existing.department },
    newData: updateData,
    req,
  });

  return employee;
}

/**
 * Deactivate an employee (soft delete)
 */
async function deactivateEmployee({ employeeId, orgId, adminId, req }) {
  return updateEmployee({
    employeeId,
    orgId,
    data: { isActive: false },
    adminId,
    req,
  });
}

/**
 * Hard delete an employee and all related data
 */
async function deleteEmployee({ employeeId, orgId, adminId, req }) {
  const prisma = getPrisma();

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId },
    include: { employeeRoles: { include: { role: true } } },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  // Prevent deleting the last org_admin
  const isAdmin = employee.employeeRoles.some((er) => er.role.name === 'org_admin');
  if (isAdmin) {
    const adminCount = await prisma.employeeRole.count({
      where: {
        role: { name: 'org_admin' },
        employee: { orgId, isActive: true },
      },
    });
    if (adminCount <= 1) {
      throw Object.assign(new Error('Cannot delete the last admin account'), { status: 400 });
    }
  }

  // Prevent self-deletion
  if (employeeId === adminId) {
    throw Object.assign(new Error('Cannot delete your own account'), { status: 400 });
  }

  // Cascade delete (Prisma onDelete: Cascade handles most relations)
  await prisma.employee.delete({ where: { id: employeeId } });

  await auditLog({
    orgId,
    actorId: adminId,
    action: 'employee.delete',
    resource: 'employee',
    resourceId: employeeId,
    oldData: { name: employee.name, email: employee.email },
    req,
  });
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
};
