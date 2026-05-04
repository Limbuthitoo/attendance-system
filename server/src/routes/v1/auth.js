// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes (v1) — Login, refresh, logout, password management
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const { setAuthCookies, clearAuthCookies } = require('../../middleware/auth');
const authService = require('../../services/auth.service');
const { registerPushToken, removePushToken } = require('../../services/notification.service');

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, orgSlug, pushToken, deviceName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login({
      email,
      password,
      orgSlug: orgSlug || null,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    // Set HttpOnly cookies for web clients
    setAuthCookies(res, result.accessToken, result.refreshToken);

    // Register push token if provided (mobile login)
    if (pushToken) {
      await registerPushToken({
        employeeId: result.employee.id,
        token: pushToken,
        deviceName: deviceName || null,
      });
    }

    res.json({
      user: result.employee,
      token: result.accessToken,         // backward compat for web/mobile
      accessToken: result.accessToken,   // new canonical field
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    // Update access token cookie
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 2 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      token: result.accessToken,       // backward compat
      accessToken: result.accessToken,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;
    const pushToken = req.body.pushToken;

    await authService.logout(refreshToken);

    if (pushToken) {
      await removePushToken({ employeeId: req.user.id, token: pushToken });
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    await authService.changePassword({
      employeeId: req.user.id,
      currentPassword,
      newPassword,
      req,
    });

    clearAuthCookies(res);
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/v1/auth/me — Get current user profile
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/v1/auth/push-token — Register push token (mobile, after auth restore)
router.post('/push-token', authenticate, async (req, res, next) => {
  try {
    const { token, deviceName } = req.body;
    if (!token) return res.status(400).json({ error: 'Push token required' });

    await registerPushToken({
      employeeId: req.user.id,
      token,
      deviceName: deviceName || null,
    });

    res.json({ message: 'Push token registered' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
