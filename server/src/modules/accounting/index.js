// ─────────────────────────────────────────────────────────────────────────────
// Accounting Module Index
// Registers routes and event subscriptions for the accounting module.
// When extracted to a microservice, this file becomes the service entry point.
// ─────────────────────────────────────────────────────────────────────────────

// Import the service to trigger event subscription registration
const service = require('../../services/accounting.service');
const routes = require('../../routes/v1/accounting');

module.exports = {
  name: 'accounting',
  routes,
  service,
  moduleCode: 'accounting', // matches OrgModule.code for module guard
};
