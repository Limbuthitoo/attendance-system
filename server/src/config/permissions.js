// Canonical permission catalog shared by RBAC services and system-role seeding.
const ALL_PERMISSIONS = [
  'employee.view', 'employee.create', 'employee.update', 'employee.delete',
  'attendance.view_own', 'attendance.check_in', 'attendance.check_out', 'attendance.view_all', 'attendance.manage',
  'leave.view_own', 'leave.apply', 'leave.view_all', 'leave.approve', 'leave.reject',
  'device.view', 'device.manage', 'credential.manage',
  'settings.view', 'settings.update',
  'holiday.manage', 'notice.manage', 'report.view',
  'branch.manage', 'shift.manage', 'schedule.manage',
  'role.manage', 'audit.view',
  'profile.view', 'profile.update', 'notification.view',
  'incentive.view', 'incentive.manage', 'incentive.approve',
  'crm.view', 'crm.manage',
  'performance.view', 'performance.manage',
  'task.view', 'task.manage', 'project.view', 'project.manage',
  'referral.view', 'referral.manage',
  'bonus.view', 'bonus.manage', 'bonus.approve',
  'accounting.view', 'accounting.manage', 'billing.view', 'billing.manage',
  'department.view', 'department.manage', 'designation.view', 'designation.manage',
  'compensation.view', 'compensation.manage', 'payroll.view', 'payroll.manage',
  'recruitment.view', 'recruitment.manage', 'onboarding.view', 'onboarding.manage',
  'training.view', 'training.manage', 'separation.view', 'separation.manage',
  'ess.view', 'ess.manage',
];

module.exports = { ALL_PERMISSIONS };
