// ─────────────────────────────────────────────────────────────────────────────
// Platform Auth Routes — Super-admin login
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPrisma } = require('../../lib/prisma');
const {
  authenticatePlatform,
  generatePlatformAccessToken,
  generatePlatformRefreshToken,
} = require('../../middleware/platformAuth');
const config = require('../../config');

const router = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

// POST /api/platform/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const prisma = getPrisma();
    const user = await prisma.platformUser.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updateData = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await prisma.platformUser.update({ where: { id: user.id }, data: updateData });

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        return res.status(423).json({
          error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.platformUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const accessToken = generatePlatformAccessToken(user);
    const refreshToken = generatePlatformRefreshToken(user);

    // Store hashed refresh token for revocation support
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.platformUser.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    // Set HttpOnly cookies
    const cookieOpts = {
      httpOnly: true,
      secure: config.isProd,
      sameSite: config.isProd ? 'strict' : 'lax',
      path: '/',
    };

    res.cookie('platform_access_token', accessToken, {
      ...cookieOpts,
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
    });

    res.cookie('platform_refresh_token', refreshToken, {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/platform/auth',
    });

    const { password: _, refreshTokenHash: __, ...safeUser } = user;
    res.json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const jwt = require('jsonwebtoken');
    const refreshToken = req.body.refreshToken || req.cookies?.platform_refresh_token;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decoded.type !== 'platform_refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const prisma = getPrisma();
    const user = await prisma.platformUser.findFirst({
      where: { id: decoded.id, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Verify refresh token matches stored hash (revocation check)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (user.refreshTokenHash !== tokenHash) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    const accessToken = generatePlatformAccessToken(user);

    res.cookie('platform_access_token', accessToken, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: config.isProd ? 'strict' : 'lax',
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/auth/logout
router.post('/logout', authenticatePlatform, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    // Revoke refresh token server-side
    await prisma.platformUser.update({
      where: { id: req.platformUser.id },
      data: { refreshTokenHash: null },
    });
    res.clearCookie('platform_access_token', { path: '/' });
    res.clearCookie('platform_refresh_token', { path: '/api/platform/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/auth/me
router.get('/me', authenticatePlatform, (req, res) => {
  res.json({ user: req.platformUser });
});

module.exports = router;
