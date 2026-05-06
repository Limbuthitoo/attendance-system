// ─────────────────────────────────────────────────────────────────────────────
// Organization Service — CRUD, subscription, module assignment
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { slugify } = require('../lib/validation');
const { SALT_ROUNDS } = require('./auth.service');

/**
 * List all organizations (platform admin)
 */
async function listOrganizations({ search, status, plan, page = 1, limit = 20 }) {
  const prisma = getPrisma();

  const where = {};
  if (status) where.subscriptionStatus = status;
  if (plan) where.planId = plan;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        planId: true,
        plan: { select: { id: true, name: true, code: true, price: true, currency: true } },
        subscriptionStatus: true,
        trialEndsAt: true,
        maxEmployees: true,
        maxBranches: true,
        maxDevices: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            employees: true,
            branches: true,
            devices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    organizations: organizations.map((org) => ({
      ...org,
      employeeCount: org._count.employees,
      branchCount: org._count.branches,
      deviceCount: org._count.devices,
      _count: undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single organization with full details
 */
async function getOrganization(orgId) {
  const prisma = getPrisma();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      plan: true,
      branches: {
        select: { id: true, name: true, code: true, city: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      },
      orgModules: {
        where: { isActive: true },
        include: { module: { select: { id: true, code: true, name: true } } },
      },
      _count: {
        select: { employees: true, devices: true, branches: true },
      },
    },
  });

  if (!org) return null;

  return {
    ...org,
    enabledModules: org.orgModules.map((om) => om.module),
    employeeCount: org._count.employees,
    branchCount: org._count.branches,
    deviceCount: org._count.devices,
    orgModules: undefined,
    _count: undefined,
  };
}

/**
 * Create a new organization (with initial admin and default setup)
 */
async function createOrganization({ name, slug, domain, plan, adminEmail, adminPassword, adminName, platformUserId }) {
  const prisma = getPrisma();

  const finalSlug = slug || slugify(name);

  // Validate uniqueness
  const existing = await prisma.organization.findFirst({
    where: { OR: [{ slug: finalSlug }, ...(domain ? [{ domain }] : [])] },
  });
  if (existing) {
    throw Object.assign(new Error('Organization slug or domain already exists'), { status: 409 });
  }

  // Look up the plan from the database
  let planRecord = null;
  if (plan) {
    planRecord = await prisma.plan.findFirst({
      where: { OR: [{ id: plan }, { code: plan }] },
    });
  }
  if (!planRecord) {
    // Fall back to the first plan (sorted by sortOrder)
    planRecord = await prisma.plan.findFirst({ orderBy: { sortOrder: 'asc' } });
  }

  const limits = planRecord
    ? { maxEmployees: planRecord.maxEmployees, maxBranches: planRecord.maxBranches, maxDevices: planRecord.maxDevices }
    : { maxEmployees: 15, maxBranches: 2, maxDevices: 3 };

  const trialDays = planRecord?.trialDays || 14;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create organization
    const org = await tx.organization.create({
      data: {
        name,
        slug: finalSlug,
        domain: domain || null,
        planId: planRecord?.id || null,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
        ...limits,
      },
    });

    // 2. Create default branch
    const branch = await tx.branch.create({
      data: {
        orgId: org.id,
        name: 'Headquarters',
        code: 'HQ',
        timezone: 'Asia/Kathmandu',
        country: 'Nepal',
      },
    });

    // 3. Create default shift
    const shift = await tx.shift.create({
      data: {
        orgId: org.id,
        branchId: branch.id,
        name: 'Regular',
        startTime: '09:00',
        endTime: '18:00',
        lateThresholdMinutes: 30,
        halfDayHours: 4,
        fullDayHours: 8,
        minCheckoutMinutes: 2,
        isDefault: true,
      },
    });

    // 4. Create default work schedule (5-day)
    const schedule = await tx.workSchedule.create({
      data: {
        orgId: org.id,
        name: '5-Day Week',
        workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        effectiveFrom: new Date(),
      },
    });

    // 5. Create org admin employee
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const adminRole = await tx.role.findFirst({ where: { name: 'org_admin', orgId: null } });

    const admin = await tx.employee.create({
      data: {
        orgId: org.id,
        employeeCode: 'ADMIN-001',
        name: adminName || 'Admin',
        email: adminEmail,
        password: passwordHash,
        department: 'Administration',
        designation: 'Administrator',
        mustChangePassword: true,
      },
    });

    if (adminRole) {
      await tx.employeeRole.create({
        data: {
          employeeId: admin.id,
          roleId: adminRole.id,
          grantedBy: null,
        },
      });
    }

    // Assign admin to branch/shift/schedule
    await tx.employeeAssignment.create({
      data: {
        employeeId: admin.id,
        branchId: branch.id,
        shiftId: shift.id,
        workScheduleId: schedule.id,
        effectiveFrom: new Date(),
        isCurrent: true,
      },
    });

    // 6. Enable core modules
    const coreModuleCodes = ['attendance', 'leave', 'device', 'notice', 'holiday'];
    const coreModules = await tx.module.findMany({ where: { code: { in: coreModuleCodes } } });
    for (const mod of coreModules) {
      await tx.orgModule.create({
        data: { orgId: org.id, moduleId: mod.id },
      });
    }

    // 7. Seed default leave quotas
    const currentYear = new Date().getFullYear();
    const quotaDefaults = [
      { leaveType: 'SICK', totalDays: 12 },
      { leaveType: 'CASUAL', totalDays: 12 },
      { leaveType: 'EARNED', totalDays: 15 },
      { leaveType: 'UNPAID', totalDays: 0 },
      { leaveType: 'OTHER', totalDays: 0 },
    ];
    for (const q of quotaDefaults) {
      await tx.leaveQuota.create({
        data: { orgId: org.id, employeeId: null, leaveType: q.leaveType, year: currentYear, totalDays: q.totalDays },
      });
    }

    // 8. Seed default org settings
    const defaultSettings = {
      timezone: 'Asia/Kathmandu',
      company_name: name,
      office_start: '09:00',
      office_end: '18:00',
      late_threshold_minutes: '30',
      half_day_hours: '4',
      full_day_hours: '8',
      working_days: 'mon,tue,wed,thu,fri',
      leave_accrual_enabled: 'true',
      leave_accrual_type: 'EARNED',
      leave_working_days_per_earned: '20',
      leave_sick_days_per_year: '12',
      leave_casual_days_per_year: '12',
      leave_maternity_days: '98',
      leave_maternity_paid_days: '60',
      leave_paternity_days: '15',
      leave_max_accumulation: '90',
      leave_carryover_enabled: 'true',
      leave_carryover_max_days: '45',
      leave_sandwich_policy: 'false',
      leave_half_day_enabled: 'true',
      leave_probation_restrict: 'false',
    };
    for (const [key, value] of Object.entries(defaultSettings)) {
      await tx.orgSetting.create({ data: { orgId: org.id, key, value } });
    }

    return { org, branch, admin, shift, schedule };
  });

  // Audit log (outside transaction)
  await auditLog({
    orgId: result.org.id,
    actorId: platformUserId,
    actorType: 'platform_user',
    action: 'organization.create',
    resource: 'organization',
    resourceId: result.org.id,
    newData: { name, slug: finalSlug, plan },
  });

  return result;
}

/**
 * Update organization details
 */
async function updateOrganization({ orgId, data, platformUserId }) {
  const prisma = getPrisma();

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.domain !== undefined) updateData.domain = data.domain || null;
  if (data.planId) updateData.planId = data.planId;
  if (data.subscriptionStatus) updateData.subscriptionStatus = data.subscriptionStatus;
  if (data.maxEmployees) updateData.maxEmployees = data.maxEmployees;
  if (data.maxBranches) updateData.maxBranches = data.maxBranches;
  if (data.maxDevices) updateData.maxDevices = data.maxDevices;
  if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: updateData,
  });

  await auditLog({
    orgId,
    actorId: platformUserId,
    actorType: 'platform_user',
    action: 'organization.update',
    resource: 'organization',
    resourceId: orgId,
    newData: updateData,
  });

  return org;
}

/**
 * Suspend an organization
 */
async function suspendOrganization({ orgId, platformUserId }) {
  return updateOrganization({
    orgId,
    data: { subscriptionStatus: 'SUSPENDED', isActive: false },
    platformUserId,
  });
}

/**
 * Reactivate an organization
 */
async function reactivateOrganization({ orgId, platformUserId }) {
  return updateOrganization({
    orgId,
    data: { subscriptionStatus: 'ACTIVE', isActive: true },
    platformUserId,
  });
}

/**
 * Enable/disable modules for an organization
 */
async function setOrgModules({ orgId, moduleCodes, platformUserId }) {
  const prisma = getPrisma();

  const allModules = await prisma.module.findMany({ where: { isActive: true } });
  const moduleMap = new Map(allModules.map((m) => [m.code, m]));

  // Disable all current modules
  await prisma.orgModule.updateMany({
    where: { orgId },
    data: { isActive: false },
  });

  // Enable the requested ones
  for (const code of moduleCodes) {
    const mod = moduleMap.get(code);
    if (!mod) continue;

    await prisma.orgModule.upsert({
      where: { orgId_moduleId: { orgId, moduleId: mod.id } },
      create: { orgId, moduleId: mod.id, isActive: true },
      update: { isActive: true },
    });
  }

  await auditLog({
    orgId,
    actorId: platformUserId,
    actorType: 'platform_user',
    action: 'organization.set_modules',
    resource: 'organization',
    resourceId: orgId,
    newData: { moduleCodes },
  });

  return prisma.orgModule.findMany({
    where: { orgId, isActive: true },
    include: { module: true },
  });
}

/**
 * Get platform-level dashboard stats
 */
async function getPlatformStats() {
  const prisma = getPrisma();

  const [
    totalOrgs,
    activeOrgs,
    totalEmployees,
    totalDevices,
    orgsByPlanRaw,
    orgsByStatus,
    recentOrgs,
    allPlans,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.device.count({ where: { isActive: true } }),
    prisma.organization.groupBy({ by: ['planId'], _count: true }),
    prisma.organization.groupBy({ by: ['subscriptionStatus'], _count: true }),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, name: true, slug: true,
        plan: { select: { id: true, name: true, code: true } },
        subscriptionStatus: true, createdAt: true,
        _count: { select: { employees: true } },
      },
    }),
    prisma.plan.findMany({ select: { id: true, name: true } }),
  ]);

  // Map planId → plan name for groupBy display
  const planNameMap = new Map(allPlans.map((p) => [p.id, p.name]));

  return {
    totalOrgs,
    activeOrgs,
    totalEmployees,
    totalDevices,
    orgsByPlan: Object.fromEntries(
      orgsByPlanRaw.map((g) => [planNameMap.get(g.planId) || 'No Plan', g._count])
    ),
    orgsByStatus: orgsByStatus.reduce((acc, g) => ({ ...acc, [g.subscriptionStatus]: g._count }), {}),
    recentOrgs: recentOrgs.map((o) => ({
      ...o,
      planName: o.plan?.name || 'No Plan',
      employeeCount: o._count.employees,
      _count: undefined,
    })),
  };
}

module.exports = {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  suspendOrganization,
  reactivateOrganization,
  setOrgModules,
  getPlatformStats,
};
