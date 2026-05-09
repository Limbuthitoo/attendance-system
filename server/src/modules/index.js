// ─────────────────────────────────────────────────────────────────────────────
// Module Loader — Discovers and registers all modules
// This is the single entry point for initializing the modular architecture.
// Extracted microservices: accounting, billing, crm (run as separate containers)
// ─────────────────────────────────────────────────────────────────────────────

const modules = {
  core: require('./core'),
  attendance: require('./attendance'),
  payroll: require('./payroll'),
  performance: require('./performance'),
  hrm: require('./hrm'),
  // Extracted to accounting-service: accounting, billing
  // Extracted to crm-service: crm
};

/**
 * Initialize all modules. Call this at server startup to:
 * - Trigger event subscription registration (via service imports)
 * - Make module metadata available for introspection
 */
function initModules() {
  const loaded = Object.keys(modules);
  console.log(`✓ Modules loaded: ${loaded.join(', ')} (${loaded.length} total)`);
  return modules;
}

/**
 * Get a specific module by name.
 */
function getModule(name) {
  return modules[name] || null;
}

/**
 * List all registered event subscriptions across modules (for debugging).
 */
function getEventSubscriptions() {
  const { eventBus } = require('../lib/eventBus');
  return eventBus.listSubscriptions();
}

module.exports = { initModules, getModule, getEventSubscriptions, modules };
