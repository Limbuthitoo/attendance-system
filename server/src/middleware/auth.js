// ─────────────────────────────────────────────────────────────────────────────
// Authentication Middleware — JWT + HttpOnly cookies + revocable refresh tokens
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getPrisma } = require('../lib/prisma');

/**
 * Authenticate a request via:
 *   1. Authorization: Bearer <access_token>  (API clients, mobile)
 *   2. Cookie: access_token=<token>          (web browser, HttpOnly)
 *   3. Query param: ?token=<token>           (SSE fallback only)
 *
 * Populates req.user with employee + org context.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.access_token;
  const queryToken = req.query.token;  // SSE fallback

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    // Reject refresh tokens used as access tokens
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const prisma = getPrisma();
    const user = await prisma.employee.findFirst({
      where: { id: decoded.id, isActive: true },
      select: {
        id: true,
        orgId: true,
        employeeCode: true,
        name: true,
        email: true,
        department: true,
        designation: true,
        mustChangePassword: true,
        employeeRoles: {
          select: {
            branchId: true,
            role: { select: { name: true, permissions: true } },
          },
        },
        assignments: {
          where: { isCurrent: true },
          select: {
            branchId: true,
            shiftId: true,
            workScheduleId: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Flatten roles and permissions
    const roles = user.employeeRoles.map((er) => er.role.name);
    const permissions = new Set();
    for (const er of user.employeeRoles) {
      const perms = Array.isArray(er.role.permissions) ? er.role.permissions : [];
      perms.forEach((p) => permissions.add(p));
    }

    // Backward compat: derive legacy 'role' string for old web/mobile clients
    const role = roles.some((r) => ['org_admin', 'hr_manager', 'branch_manager'].includes(r))
        ? 'admin'
        : 'employee';

    req.user = {
      id: user.id,
      orgId: user.orgId,
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      department: user.department,
      designation: user.designation,
      mustChangePassword: user.mustChangePassword,
      role,         // backward compat: 'admin' or 'employee'
      roles,
      permissions: [...permissions],
      currentAssignment: user.assignments[0] || null,
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Auth lookup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Require at least one of the specified roles.
 * Usage: requireRole('org_admin', 'hr_manager')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: 'Insufficient role privileges' });
    }
    next();
  };
}

/**
 * Require a specific permission string.
 * Usage: requirePermission('leave.approve')
 */
function requirePermission(...requiredPerms) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const hasAll = requiredPerms.every((p) => req.user.permissions.includes(p));
    if (!hasAll) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Legacy compatibility: requireAdmin checks for org_admin role
 */
function requireAdmin(req, res, next) {
  return requireRole('org_admin')(req, res, next);
}

/**
 * Generate access token (short-lived)
 */
function generateAccessToken(employee) {
  return jwt.sign(
    { id: employee.id, orgId: employee.orgId },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiry }
  );
}

/**
 * Generate refresh token (long-lived, stored in DB for revocation)
 */
function generateRefreshToken(employee) {
  return jwt.sign(
    { id: employee.id, orgId: employee.orgId, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );
}

/**
 * Set auth cookies (HttpOnly, Secure in production)
 */
function setAuthCookies(res, accessToken, refreshToken) {
  const cookieOpts = {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'strict' : 'lax',
    path: '/',
  };

  // Access token — short lived
  res.cookie('access_token', accessToken, {
    ...cookieOpts,
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  });

  // Refresh token — longer lived
  res.cookie('refresh_token', refreshToken, {
    ...cookieOpts,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth', // only sent to auth endpoints
  });
}

/**
 * Clear auth cookies
 */
function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
}

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  requireAdmin,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
