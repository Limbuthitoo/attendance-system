// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — Login, token refresh, password management
// ─────────────────────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPrisma } = require('../lib/prisma');
const { validatePassword } = require('../lib/validation');
const { auditLog } = require('../lib/audit');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../middleware/auth');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

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

  // Backward compat: derive legacy 'role' string for old web/mobile clients
  const role = roles.some((r) => ['org_admin', 'hr_manager', 'branch_manager'].includes(r))
    ? 'admin'
    : 'employee';

  return {
    employee: { ...safeEmployee, role, roles },
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

module.exports = {
  login,
  refreshAccessToken,
  logout,
  revokeAllTokens,
  changePassword,
  adminResetPassword,
  SALT_ROUNDS,
};
