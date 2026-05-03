// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Helper
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('./prisma');

/**
 * Write an audit log entry.
 *
 * @param {object} params
 * @param {string} params.orgId
 * @param {string} params.actorId    - Employee ID, platform user ID, or device ID
 * @param {string} params.actorType  - 'employee' | 'platform_user' | 'device' | 'system'
 * @param {string} params.action     - e.g. 'employee.create', 'leave.approve', 'settings.update'
 * @param {string} params.resource   - e.g. 'employee', 'leave', 'attendance'
 * @param {string} [params.resourceId]
 * @param {object} [params.oldData]
 * @param {object} [params.newData]
 * @param {object} [params.req]      - Express request (for IP + user agent)
 */
async function auditLog({ orgId, actorId, actorType = 'employee', action, resource, resourceId, oldData, newData, req }) {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        orgId,
        actorId: actorId || null,
        actorType,
        action,
        resource,
        resourceId: resourceId || null,
        oldData: oldData || undefined,
        newData: newData || undefined,
        ipAddress: req?.ip || null,
        userAgent: req?.get('user-agent')?.substring(0, 500) || null,
      },
    });
  } catch (err) {
    // Audit log should never block main operations
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { auditLog };
