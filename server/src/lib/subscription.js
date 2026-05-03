// ─────────────────────────────────────────────────────────────────────────────
// Subscription Guard — Blocks operations when org subscription is invalid
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('./prisma');

const BLOCKED_STATUSES = ['SUSPENDED', 'CANCELLED', 'EXPIRED'];

/**
 * Checks if an org's subscription allows resource creation.
 * Throws a 403 error if the org is suspended/cancelled/expired.
 * Also checks if trial has expired (updates status automatically).
 */
async function requireActiveSubscription(orgId) {
  const prisma = getPrisma();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, trialEndsAt: true, isActive: true },
  });

  if (!org) {
    throw Object.assign(new Error('Organization not found'), { status: 404 });
  }

  // Check if trial has expired (auto-transition)
  if (
    org.subscriptionStatus === 'TRIAL' &&
    org.trialEndsAt &&
    new Date(org.trialEndsAt) < new Date()
  ) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { subscriptionStatus: 'EXPIRED', isActive: false },
    });
    throw Object.assign(
      new Error('Your trial has expired. Please upgrade to continue.'),
      { status: 403 }
    );
  }

  if (!org.isActive || BLOCKED_STATUSES.includes(org.subscriptionStatus)) {
    const messages = {
      SUSPENDED: 'Your organization is suspended. Contact support to reactivate.',
      CANCELLED: 'Your subscription has been cancelled.',
      EXPIRED: 'Your subscription has expired. Please renew to continue.',
    };
    throw Object.assign(
      new Error(messages[org.subscriptionStatus] || 'Organization is not active.'),
      { status: 403 }
    );
  }
}

module.exports = { requireActiveSubscription };
