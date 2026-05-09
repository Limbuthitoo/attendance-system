// ─────────────────────────────────────────────────────────────────────────────
// Performance Module Index
// ─────────────────────────────────────────────────────────────────────────────

const service = require('../../services/performance.service');
const routes = require('../../routes/v1/performance');

module.exports = {
  name: 'performance',
  routes,
  service,
  moduleCode: 'performance',
};
