// ─────────────────────────────────────────────────────────────────────────────
// Payroll Module Index (includes overtime)
// ─────────────────────────────────────────────────────────────────────────────

const payrollService = require('../../services/payroll.service');
const overtimeService = require('../../services/overtime.service');
const payrollRoutes = require('../../routes/v1/payroll');
const overtimeRoutes = require('../../routes/v1/overtime');

module.exports = {
  name: 'payroll',
  routes: { payroll: payrollRoutes, overtime: overtimeRoutes },
  service: { payroll: payrollService, overtime: overtimeService },
  moduleCode: 'payroll',
};
