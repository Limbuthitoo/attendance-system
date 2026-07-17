// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — Login, token refresh, password management
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPrisma } = require('../lib/prisma');
const { validatePassword } = require('../lib/validation');
const { auditLog } = require('../lib/audit');
const { invalidateUserCache } = require('../middleware/cache');
const { enqueueEmail } = require('../config/queue');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../middleware/auth');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const PASSWORD_RESET_EXPIRES_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAppBaseUrl(req) {
  const configured = process.env.WEB_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const origin = req?.get?.('origin');
  if (origin) return origin.replace(/\/$/, '');

  const proto = req?.get?.('x-forwarded-proto') || req?.protocol || 'http';
  const host = req?.get?.('host');
  return host ? `${proto}://${host}` : 'http://localhost:5173';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPasswordResetEmail({ employee, org, resetLink, expiresMinutes, requestedByType }) {
  const orgName = org?.name || 'your organization';
  const platformAssisted = requestedByType === 'platform_user';
  const intro = platformAssisted
    ? `A platform administrator generated a password reset link for your ${escapeHtml(orgName)} admin account.`
    : `We received a request to reset the password for your ${escapeHtml(orgName)} account.`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Reset your password</h2>
      <p>Hi ${escapeHtml(employee.name || 'there')},</p>
      <p>${intro}</p>
      <p>This link expires in ${expiresMinutes} minutes and can be used only once.</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(resetLink)}" style="background: #4f46e5; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Set new password
        </a>
      </p>
      <p style="font-size: 13px; color: #475569;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="font-size: 13px; word-break: break-all; color: #334155;">${escapeHtml(resetLink)}</p>
      <p style="font-size: 13px; color: #64748b;">If you did not request this, you can ignore this email. Your current password will remain unchanged.</p>
    </div>
  `;
}

/**
 * Authenticate an employee by email + password within an org.
 * Returns { employee, accessToken, refreshToken } or throws.
 */
async function login({ email, password, orgSlug, userAgent, ipAddress }) {
  const prisma = getPrisma();

  // Find employee (orgSlug may be null for single-tenant compat)
  const where = { email };
  let employee;

  if (orgSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug, isActive: true },
      select: { id: true },
    });
    if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

    employee = await prisma.employee.findFirst({
      where: { email, orgId: org.id, isActive: true },
      include: {
        employeeRoles: {
          include: { role: { select: { name: true, permissions: true } } },
        },
      },
    });
  } else {
    // No orgSlug — find by email; if multiple active matches exist, require orgSlug
    const matches = await prisma.employee.findMany({
      where: { email, isActive: true },
      include: {
        employeeRoles: {
          include: { role: { select: { name: true, permissions: true } } },
        },
        org: { select: { slug: true, name: true } },
      },
    });

    if (matches.length > 1) {
      // Return org options so the client can prompt user to pick
      const orgs = matches.map(m => ({ slug: m.org.slug, name: m.org.name }));
      throw Object.assign(
        new Error('Multiple organizations found. Please select your organization.'),
        { status: 409, organizations: orgs }
      );
    }
    employee = matches[0] || null;
  }

  if (!employee) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  // Check account lockout
  if (employee.lockedUntil && employee.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((employee.lockedUntil - Date.now()) / 60000);
    throw Object.assign(
      new Error(`Account locked. Try again in ${minutesLeft} minute(s).`),
      { status: 423 }
    );
  }

  const valid = await bcrypt.compare(password, employee.password);
  if (!valid) {
    // Increment failed attempts
    const attempts = employee.failedLoginAttempts + 1;
    const updateData = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    await prisma.employee.update({ where: { id: employee.id }, data: updateData });

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      throw Object.assign(
        new Error(`Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`),
        { status: 423 }
      );
    }
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  // Reset failed attempts on successful login
  if (employee.failedLoginAttempts > 0 || employee.lockedUntil) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(employee);
  const refreshToken = generateRefreshToken(employee);

  // Store refresh token hash for revocation
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      employeeId: employee.id,
      tokenHash,
      userAgent: userAgent?.substring(0, 500) || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  // Audit
  await auditLog({
    orgId: employee.orgId,
    actorId: employee.id,
    action: 'auth.login',
    resource: 'employee',
    resourceId: employee.id,
  });

  // Strip password from response
  const { password: _, ...safeEmployee } = employee;
  const roles = employee.employeeRoles.map((er) => er.role.name);
  const permissions = [...new Set(employee.employeeRoles.flatMap((er) => (
    Array.isArray(er.role.permissions) ? er.role.permissions : []
  )))];

  // Backward compat: derive legacy 'role' string for old web/mobile clients
  const role = roles.some((r) => ['org_admin', 'hr_manager', 'branch_manager'].includes(r))
    ? 'admin'
    : 'employee';

  return {
    employee: { ...safeEmployee, employeeRoles: undefined, role, roles, permissions },
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token using a valid refresh token.
 */
async function refreshAccessToken(refreshTokenStr) {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  const prisma = getPrisma();

  let decoded;
  try {
    decoded = jwt.verify(refreshTokenStr, config.jwtSecret);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  if (decoded.type !== 'refresh') {
    throw Object.assign(new Error('Invalid token type'), { status: 401 });
  }

  // Check token exists and isn't revoked
  const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken || storedToken.revokedAt) {
    throw Object.assign(new Error('Refresh token revoked or not found'), { status: 401 });
  }

  if (storedToken.expiresAt < new Date()) {
    throw Object.assign(new Error('Refresh token expired'), { status: 401 });
  }

  // Get employee
  const employee = await prisma.employee.findFirst({
    where: { id: decoded.id, isActive: true },
  });

  if (!employee) {
    throw Object.assign(new Error('User not found or inactive'), { status: 401 });
  }

  const accessToken = generateAccessToken(employee);
  return { accessToken };
}

/**
 * Logout — revoke a specific refresh token
 */
async function logout(refreshTokenStr) {
  if (!refreshTokenStr) return;

  const prisma = getPrisma();
  const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke ALL refresh tokens for an employee (e.g., password change)
 */
async function revokeAllTokens(employeeId) {
  const prisma = getPrisma();
  await prisma.refreshToken.updateMany({
    where: { employeeId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Change password (self-service)
 */
async function changePassword({ employeeId, currentPassword, newPassword, req }) {
  const prisma = getPrisma();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, orgId: true, password: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, employee.password);
  if (!valid) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 400 });
  }

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error), { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.employee.update({
    where: { id: employeeId },
    data: { password: hash, mustChangePassword: false },
  });

  // Bust auth cache so mustChangePassword=false takes effect
  invalidateUserCache(employeeId).catch(() => {});

  // Revoke all refresh tokens so other sessions must re-login
  await revokeAllTokens(employeeId);

  await auditLog({
    orgId: employee.orgId,
    actorId: employeeId,
    action: 'auth.change_password',
    resource: 'employee',
    resourceId: employeeId,
    req,
  });
}

/**
 * Admin reset password for an employee
 */
async function adminResetPassword({ adminId, employeeId, newPassword, req }) {
  const prisma = getPrisma();

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error), { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, orgId: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.employee.update({
    where: { id: employeeId },
    data: { password: hash, mustChangePassword: true },
  });

  invalidateUserCache(employeeId).catch(() => {});

  await revokeAllTokens(employeeId);

  await auditLog({
    orgId: employee.orgId,
    actorId: adminId,
    action: 'auth.admin_reset_password',
    resource: 'employee',
    resourceId: employeeId,
    req,
  });
}

async function createPasswordResetToken({
  employee,
  requestedBy = null,
  requestedByType = 'self',
  req,
  purpose = 'PASSWORD_RESET',
  expiresMinutes = PASSWORD_RESET_EXPIRES_MINUTES,
  sendEmail = true,
}) {
  const prisma = getPrisma();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: {
      employeeId: employee.id,
      purpose,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      orgId: employee.orgId,
      employeeId: employee.id,
      tokenHash,
      purpose,
      deliveryEmail: employee.email,
      requestedBy,
      requestedByType,
      expiresAt,
    },
  });

  const baseUrl = getAppBaseUrl(req);
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  let emailQueued = false;
  let emailError = null;

  if (sendEmail) {
    try {
      await enqueueEmail({
        to: employee.email,
        subject: `Reset your password — ${employee.org?.name || 'Archisys Attendance'}`,
        html: buildPasswordResetEmail({
          employee,
          org: employee.org,
          resetLink,
          expiresMinutes,
          requestedByType,
        }),
        orgId: employee.orgId,
      });
      emailQueued = true;
    } catch (err) {
      emailError = err.message;
    }
  }

  await auditLog({
    orgId: employee.orgId,
    actorId: requestedBy || employee.id,
    actorType: requestedByType === 'self' ? 'employee' : requestedByType,
    action: 'auth.password_reset_requested',
    resource: 'employee',
    resourceId: employee.id,
    newData: { requestedByType, emailQueued, purpose },
    req,
  });

  return {
    email: employee.email,
    expiresAt,
    emailQueued,
    emailError,
    resetLink: process.env.NODE_ENV === 'production' ? undefined : resetLink,
  };
}

async function requestPasswordReset({ email, orgSlug, req }) {
  const prisma = getPrisma();
  let employee = null;

  if (email) {
    const where = { email, isActive: true };
    if (orgSlug) {
      where.org = { slug: orgSlug, isActive: true };
    }

    const matches = await prisma.employee.findMany({
      where,
      include: { org: { select: { id: true, name: true, slug: true, isActive: true } } },
      take: 2,
    });

    if (matches.length === 1) {
      employee = matches[0];
    }
  }

  if (employee) {
    await createPasswordResetToken({
      employee,
      requestedBy: employee.id,
      requestedByType: 'self',
      req,
    });
  }

  return {
    message: 'If a matching active account exists, a password reset link will be sent shortly.',
  };
}

async function sendOrgAdminPasswordReset({ orgId, employeeId, platformUserId, req }) {
  const prisma = getPrisma();
  const employee = await prisma.employee.findFirst({
    where: {
      orgId,
      ...(employeeId ? { id: employeeId } : {}),
      isActive: true,
      employeeRoles: {
        some: { role: { name: 'org_admin' } },
      },
    },
    include: {
      org: { select: { id: true, name: true, slug: true, isActive: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!employee) {
    throw Object.assign(new Error('No active organization admin found for this organization'), { status: 404 });
  }

  return createPasswordResetToken({
    employee,
    requestedBy: platformUserId,
    requestedByType: 'platform_user',
    req,
  });
}

async function verifyPasswordResetToken(token) {
  if (!token || typeof token !== 'string') {
    throw Object.assign(new Error('Reset token is required'), { status: 400 });
  }

  const prisma = getPrisma();
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      employee: { select: { id: true, name: true, email: true, isActive: true } },
      org: { select: { id: true, name: true, slug: true, isActive: true } },
    },
  });

  if (!row || row.usedAt || row.revokedAt || row.expiresAt <= new Date() || !row.employee.isActive || !row.org.isActive) {
    throw Object.assign(new Error('Reset link is invalid or has expired'), { status: 400 });
  }

  return {
    email: row.employee.email,
    name: row.employee.name,
    orgName: row.org.name,
    expiresAt: row.expiresAt,
  };
}

async function confirmPasswordReset({ token, newPassword, req }) {
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error), { status: 400 });
  }

  const prisma = getPrisma();
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      employee: { select: { id: true, orgId: true, isActive: true } },
      org: { select: { id: true, isActive: true } },
    },
  });

  if (!row || row.usedAt || row.revokedAt || row.expiresAt <= new Date() || !row.employee.isActive || !row.org.isActive) {
    throw Object.assign(new Error('Reset link is invalid or has expired'), { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: row.employeeId },
      data: {
        password: hash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        employeeId: row.employeeId,
        id: { not: row.id },
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  invalidateUserCache(row.employeeId).catch(() => {});
  await revokeAllTokens(row.employeeId);

  await auditLog({
    orgId: row.orgId,
    actorId: row.employeeId,
    actorType: 'employee',
    action: 'auth.password_reset_completed',
    resource: 'employee',
    resourceId: row.employeeId,
    req,
  });

  return { message: 'Password updated successfully. Please log in with your new password.' };
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  revokeAllTokens,
  changePassword,
  adminResetPassword,
  requestPasswordReset,
  sendOrgAdminPasswordReset,
  verifyPasswordResetToken,
  confirmPasswordReset,
  SALT_ROUNDS,
};
