// ─────────────────────────────────────────────────────────────────────────────
// Database Seed Script — Creates initial platform user, system roles, modules
// Run: npm run db:seed
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { seedDefaultOrgStructure } = require('./config/default-org-structure');
const { ALL_PERMISSIONS } = require('./config/permissions');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Platform Super Admin ─────────────────────────────────────────────
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must be set before running the seed script.');
  }

  const existingAdmin = await prisma.platformUser.findUnique({ where: { email } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.platformUser.create({
      data: {
        email,
        password: hash,
        name: 'Platform Admin',
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`✓ Platform admin created: ${email}`);
  } else {
    console.log(`  Platform admin already exists: ${email}`);
  }

  // ── 2. System Roles (orgId = null → available to all orgs) ─────────────
  const hrStructurePermissions = [
    'department.view', 'department.manage',
    'designation.view', 'designation.manage',
  ];
  const hrLifecyclePermissions = [
    'recruitment.view', 'recruitment.manage',
    'onboarding.view', 'onboarding.manage',
    'training.view', 'training.manage',
    'separation.view', 'separation.manage',
    'ess.view', 'ess.manage',
    'compensation.view',
  ];
  const financePermissions = [
    'accounting.view', 'accounting.manage',
    'billing.view', 'billing.manage',
    'payroll.view', 'payroll.manage',
    'compensation.view', 'compensation.manage',
  ];
  const workManagementPermissions = [
    'project.view', 'project.manage',
    'task.view', 'task.manage',
    'performance.view', 'performance.manage',
  ];
  const rewardPermissions = [
    'incentive.view', 'incentive.manage', 'incentive.approve',
    'bonus.view', 'bonus.manage', 'bonus.approve',
    'referral.view', 'referral.manage',
  ];

  const systemRoles = [
    {
      name: 'org_admin',
      description: 'Organization administrator with full access',
      permissions: [...ALL_PERMISSIONS],
      isSystem: true,
    },
    {
      name: 'hr_manager',
      description: 'HR manager — employee and leave management',
      permissions: [
        'employee.view', 'employee.create', 'employee.update',
        'attendance.view_all',
        'leave.view_all', 'leave.approve', 'leave.reject',
        ...hrStructurePermissions,
        ...hrLifecyclePermissions,
        'payroll.view', 'payroll.manage',
        'performance.view',
        'holiday.manage', 'notice.manage', 'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'finance_manager',
      description: 'Finance manager — accounting, billing, compensation, and payroll control',
      permissions: [
        'employee.view',
        'attendance.view_all',
        'leave.view_all',
        'report.view',
        ...financePermissions,
        'bonus.view', 'bonus.manage', 'bonus.approve',
        'incentive.view', 'incentive.approve',
      ],
      isSystem: true,
    },
    {
      name: 'accountant',
      description: 'Accountant — accounting and billing operations',
      permissions: [
        'employee.view',
        'report.view',
        'accounting.view', 'accounting.manage',
        'billing.view', 'billing.manage',
        'payroll.view',
      ],
      isSystem: true,
    },
    {
      name: 'payroll_manager',
      description: 'Payroll manager — salary structures, payroll runs, bonuses, and incentives',
      permissions: [
        'employee.view',
        'attendance.view_all',
        'leave.view_all',
        'report.view',
        'payroll.view', 'payroll.manage',
        'compensation.view', 'compensation.manage',
        ...rewardPermissions,
      ],
      isSystem: true,
    },
    {
      name: 'recruiter',
      description: 'Recruiter — recruitment pipeline and onboarding coordination',
      permissions: [
        'employee.view',
        'department.view',
        'designation.view',
        'recruitment.view', 'recruitment.manage',
        'onboarding.view', 'onboarding.manage',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'training_manager',
      description: 'Training manager — courses, sessions, enrollments, and certifications',
      permissions: [
        'employee.view',
        'department.view',
        'designation.view',
        'training.view', 'training.manage',
        'performance.view',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'operations_manager',
      description: 'Operations manager — branches, shifts, schedules, attendance, and work execution',
      permissions: [
        'employee.view',
        'attendance.view_all', 'attendance.manage',
        'leave.view_all', 'leave.approve', 'leave.reject',
        'department.view',
        'designation.view',
        'branch.manage',
        'shift.manage',
        'schedule.manage',
        'project.view', 'project.manage',
        'task.view', 'task.manage',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'department_head',
      description: 'Department head — team oversight, leave approvals, reports, projects, and tasks',
      permissions: [
        'employee.view',
        'attendance.view_all',
        'leave.view_all', 'leave.approve', 'leave.reject',
        'department.view',
        'designation.view',
        'project.view',
        'task.view', 'task.manage',
        'performance.view',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'project_manager',
      description: 'Project manager — projects, tasks, and performance tracking',
      permissions: [
        'employee.view',
        'department.view',
        'designation.view',
        ...workManagementPermissions,
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'sales_manager',
      description: 'Sales manager — CRM, billing visibility, sales tasks, and reports',
      permissions: [
        'employee.view',
        'crm.view', 'crm.manage',
        'billing.view',
        'task.view', 'task.manage',
        'project.view',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'it_admin',
      description: 'IT admin — devices, credentials, app access, and technical settings',
      permissions: [
        'employee.view',
        'device.view', 'device.manage',
        'credential.manage',
        'settings.view', 'settings.update',
        'notification.view',
        'audit.view',
      ],
      isSystem: true,
    },
    {
      name: 'branch_manager',
      description: 'Branch manager — manages their branch employees',
      permissions: [
        'employee.view',
        'attendance.view_all',
        'leave.view_all', 'leave.approve',
        'department.view',
        'designation.view',
        'report.view',
      ],
      isSystem: true,
    },
    {
      name: 'team_lead',
      description: 'Team lead — view team attendance and leave requests',
      permissions: [
        'employee.view',
        'attendance.view_all',
        'leave.view_all',
        'department.view',
        'designation.view',
      ],
      isSystem: true,
    },
    {
      name: 'employee',
      description: 'Regular employee — self-service only',
      permissions: [
        'attendance.view_own', 'attendance.check_in', 'attendance.check_out',
        'leave.view_own', 'leave.apply',
        'profile.view', 'profile.update',
        'notification.view',
      ],
      isSystem: true,
    },
  ];

  for (const role of systemRoles) {
    const existing = await prisma.role.findFirst({
      where: { name: role.name, orgId: null },
    });
    if (!existing) {
      await prisma.role.create({
        data: {
          orgId: null,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: true,
        },
      });
      console.log(`✓ System role created: ${role.name}`);
    } else {
      const currentPermissions = Array.isArray(existing.permissions) ? existing.permissions : [];
      const mergedPermissions = Array.from(new Set([...currentPermissions, ...role.permissions]));
      const shouldUpdate =
        mergedPermissions.length !== currentPermissions.length ||
        existing.description !== role.description ||
        existing.isSystem !== true;

      if (shouldUpdate) {
        await prisma.role.update({
          where: { id: existing.id },
          data: {
            description: role.description,
            permissions: mergedPermissions,
            isSystem: true,
          },
        });
        console.log(`✓ System role updated: ${role.name}`);
      } else {
        console.log(`  System role exists: ${role.name}`);
      }
    }
  }

  // ── 3. Subscription Plans ──────────────────────────────────────────────────
  const plans = [
    {
      code: 'trial', name: 'Trial', description: '14-day free trial',
      price: 0, currency: 'NPR', billingCycle: 'monthly',
      maxEmployees: 15, maxBranches: 2, maxDevices: 3, trialDays: 14,
      backupRetentionDays: 1,
      sortOrder: 0, features: ['Core attendance', 'Leave management', 'Basic reports'],
    },
    {
      code: 'starter', name: 'Starter', description: 'For small teams up to 30 employees',
      price: 150000, currency: 'NPR', billingCycle: 'monthly',
      maxEmployees: 30, maxBranches: 3, maxDevices: 5, trialDays: 0,
      backupRetentionDays: 7,
      sortOrder: 1, features: ['Everything in Trial', 'NFC/QR devices', 'Holiday calendar', 'Notices', 'App distribution'],
    },
    {
      code: 'business', name: 'Business', description: 'For growing organizations up to 100 employees',
      price: 400000, currency: 'NPR', billingCycle: 'monthly',
      maxEmployees: 100, maxBranches: 10, maxDevices: 20, trialDays: 0,
      backupRetentionDays: 30,
      sortOrder: 2, features: ['Everything in Starter', 'Advanced reports', 'Payroll integration', 'Geofencing', 'Multiple branches'],
    },
    {
      code: 'enterprise', name: 'Enterprise', description: 'For large organizations with custom needs',
      price: 1000000, currency: 'NPR', billingCycle: 'monthly',
      maxEmployees: 500, maxBranches: 50, maxDevices: 100, trialDays: 0,
      backupRetentionDays: 90,
      sortOrder: 3, features: ['Everything in Business', 'Unlimited support', 'Custom integrations', 'Dedicated account manager'],
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findUnique({ where: { code: plan.code } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`✓ Plan created: ${plan.name} (NPR ${plan.price / 100}/mo)`);
    } else {
      console.log(`  Plan exists: ${plan.name}`);
    }
  }

  // ── 4. Modules ────────────────────────────────────────────────────────────
  const modules = [
    { code: 'attendance', name: 'Attendance Management', description: 'Check-in, check-out, attendance tracking' },
    { code: 'leave', name: 'Leave Management', description: 'Leave applications, approvals, quotas' },
    { code: 'device', name: 'Device Management', description: 'NFC, fingerprint, QR device integration' },
    { code: 'notice', name: 'Notices & Announcements', description: 'Internal notices and notifications' },
    { code: 'holiday', name: 'Holiday Calendar', description: 'Public holiday management' },
    { code: 'app_update', name: 'App Distribution', description: 'Mobile app APK distribution' },
    { code: 'report', name: 'Reports & Analytics', description: 'Attendance and leave reports' },
    { code: 'payroll', name: 'Payroll Integration', description: 'Salary calculation and overtime' },
    { code: 'geofence', name: 'Geofencing', description: 'GPS-based attendance verification' },
    { code: 'incentive', name: 'Incentive Management', description: 'Employee incentives, bonuses, and reward programs' },
    { code: 'crm', name: 'CRM', description: 'Leads, deals, pipelines, and client management' },
    { code: 'performance', name: 'Performance Management', description: 'KPIs, scorecards, and performance reviews' },
    { code: 'task', name: 'Task Management', description: 'Task tracking and assignment' },
    { code: 'project', name: 'Project Management', description: 'Project tracking with members and milestones' },
    { code: 'referral', name: 'Referral Program', description: 'Employee referral tracking and rewards' },
    { code: 'bonus', name: 'Bonus Management', description: 'Festival bonuses, annual bonuses, and employee reward management' },
    { code: 'accounting', name: 'Accounting', description: 'Double-entry bookkeeping, chart of accounts, journal entries, trial balance, P&L, balance sheet' },
    { code: 'billing', name: 'Billing', description: 'Nepal VAT billing, invoices, payments, parties, aging reports, VAT summary for IRD' },
  ];

  for (const mod of modules) {
    const existing = await prisma.module.findUnique({ where: { code: mod.code } });
    if (!existing) {
      await prisma.module.create({ data: mod });
      console.log(`✓ Module created: ${mod.code}`);
    } else {
      console.log(`  Module exists: ${mod.code}`);
    }
  }

  // ── 5. Backfill common departments/designations for every organization ─────
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    await seedDefaultOrgStructure(prisma, org.id);
    console.log(`  Default departments/designations ensured: ${org.name}`);
  }

  console.log('\n✅ Seed complete!');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
