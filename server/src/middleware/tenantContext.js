// ─────────────────────────────────────────────────────────────────────────────
// Tenant Context Middleware — Ensures org-scoped data isolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After authenticate(), this middleware ensures req.user.orgId is set
 * and provides helper to scope Prisma queries.
 *
 * Usage in routes:
 *   const orgId = req.orgId;
 *   prisma.employee.findMany({ where: { orgId } });
 */
function tenantContext(req, res, next) {
  // For employee-authenticated requests
  if (req.user?.orgId) {
    req.orgId = req.user.orgId;
    return next();
  }

  // For device-authenticated requests
  if (req.device?.orgId) {
    req.orgId = req.device.orgId;
    return next();
  }

  return res.status(403).json({ error: 'Tenant context not established' });
}

module.exports = { tenantContext };
