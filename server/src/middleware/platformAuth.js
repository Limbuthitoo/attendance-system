// ─────────────────────────────────────────────────────────────────────────────
// Platform Authentication Middleware — For super-admin / platform support users
// Separate from org employee auth (auth.new.js)
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getPrisma } = require('../lib/prisma');

/**
 * Authenticate a platform user via JWT.
 * Populates req.platformUser with { id, email, name, role }.
 */
function authenticatePlatform(req, res, next) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.platform_access_token;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Platform authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== 'platform') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const prisma = getPrisma();
    prisma.platformUser.findFirst({
      where: { id: decoded.id, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    }).then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'Platform user not found or inactive' });
      }
      req.platformUser = user;
      next();
    }).catch((err) => {
      console.error('Platform auth lookup error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require SUPER_ADMIN role for destructive platform operations.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.platformUser || req.platformUser.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

/**
 * Generate platform access token
 */
function generatePlatformAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, type: 'platform' },
    config.jwtSecret,
    { expiresIn: '4h' }
  );
}

/**
 * Generate platform refresh token
 */
function generatePlatformRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'platform_refresh' },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

module.exports = {
  authenticatePlatform,
  requireSuperAdmin,
  generatePlatformAccessToken,
  generatePlatformRefreshToken,
};
