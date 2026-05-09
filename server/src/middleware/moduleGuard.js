// ─────────────────────────────────────────────────────────────────────────────
// Module Guard Middleware — Blocks access to routes if module is not enabled
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

// Cache org modules for 60 seconds to avoid DB hit on every request
const cache = new Map();
const CACHE_TTL = 60 * 1000;

async function getOrgModules(orgId) {
  const cached = cache.get(orgId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.modules;
  }

  const prisma = getPrisma();
  const orgModules = await prisma.orgModule.findMany({
    where: { orgId, isActive: true },
    select: { module: { select: { code: true } } },
  });
  const modules = orgModules.map((om) => om.module.code);
  cache.set(orgId, { modules, ts: Date.now() });
  return modules;
}

/**
 * Returns middleware that checks if the org has the specified module enabled.
 * Usage: router.use('/payroll', requireModule('payroll'), payrollRoutes);
 */
function requireModule(...moduleCodes) {
  return async (req, res, next) => {
    try {
      const orgId = req.orgId || req.user?.orgId;
      if (!orgId) {
        return res.status(403).json({ error: 'Organization context required' });
      }

      const enabledModules = await getOrgModules(orgId);
      const hasAccess = moduleCodes.some((code) => enabledModules.includes(code));

      if (!hasAccess) {
        return res.status(403).json({
          error: `This feature requires the ${moduleCodes.join(' or ')} module. Please upgrade your plan.`,
          code: 'MODULE_NOT_ENABLED',
        });
      }

      next();
    } catch (err) {
      console.error('Module guard error:', err.message);
      return res.status(500).json({ error: 'Unable to verify module access' });
    }
  };
}

/**
 * Invalidate cache for an org (call after module changes)
 */
function invalidateModuleCache(orgId) {
  cache.delete(orgId);
}

module.exports = { requireModule, invalidateModuleCache };
