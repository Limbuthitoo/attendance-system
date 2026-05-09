// ─────────────────────────────────────────────────────────────────────────────
// Billing Module Index
// Registers routes and event subscriptions for the billing module.
// ─────────────────────────────────────────────────────────────────────────────

const service = require('../../services/billing.service');
const routes = require('../../routes/v1/billing');

module.exports = {
  name: 'billing',
  routes,
  service,
  moduleCode: 'billing',
};
