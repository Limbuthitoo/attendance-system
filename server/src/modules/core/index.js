// ─────────────────────────────────────────────────────────────────────────────
// Core Module Index — Auth, Employees, Roles, Branches, Settings, Notifications
// These are always loaded — they don't require module guard.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'core',
  routes: {
    auth: require('../../routes/v1/auth'),
    employees: require('../../routes/v1/employees'),
    roles: require('../../routes/v1/roles'),
    branches: require('../../routes/v1/branches'),
    settings: require('../../routes/v1/settings'),
    notifications: require('../../routes/v1/notifications'),
    dashboard: require('../../routes/v1/dashboard'),
    notices: require('../../routes/v1/notices'),
    policies: require('../../routes/v1/policies'),
    appUpdate: require('../../routes/v1/app-update'),
  },
  service: {
    auth: require('../../services/auth.service'),
    employee: require('../../services/employee.service'),
    role: require('../../services/role.service'),
    branch: require('../../services/branch.service'),
    settings: require('../../services/settings.service'),
    notification: require('../../services/notification.service'),
  },
  moduleCode: null, // always loaded, no module guard
};
