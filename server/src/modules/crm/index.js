// ─────────────────────────────────────────────────────────────────────────────
// CRM Module Index
// ─────────────────────────────────────────────────────────────────────────────

const service = require('../../services/crm.service');
const routes = require('../../routes/v1/crm');

module.exports = {
  name: 'crm',
  routes,
  service,
  moduleCode: 'crm',
};
