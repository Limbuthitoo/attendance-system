// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes (v1) — Login, refresh, logout, password management
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const { setAuthCookies, clearAuthCookies } = require('../../middleware/auth');
const authService = require('../../services/auth.service');
const { registerPushToken, removePushToken } = require('../../services/notification.service');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// GET /api/v1/auth/organizations — Public list of active orgs (for login screen)
router.get('/organizations', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
    res.json({ organizations: orgs });
  } catch (err) {
    next(err);
  }
});

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
    if (err.status === 409 && err.organizations) {
      return res.status(409).json({ error: err.message, organizations: err.organizations });
    }
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

// GET /api/v1/auth/profile — Get full profile with personal/bank/emergency info
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const { getEmployee } = require('../../services/employee.service');
    const profile = await getEmployee(req.user.id, req.user.orgId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/auth/profile — Employee self-update personal details
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { getPrisma } = require('../../lib/prisma');
    const prisma = getPrisma();

    // Only allow personal/bank fields — not role, department, designation, etc.
    const allowedFields = [
      'phone', 'dateOfBirth', 'bloodGroup', 'maritalStatus', 'gender',
      'address', 'city', 'state', 'country', 'zipCode',
      'bankName', 'bankBranch', 'bankAccountNumber', 'bankAccountName',
      'panNumber', 'ssfNumber',
    ];

    const data = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'dateOfBirth' && req.body[field]) {
          data[field] = new Date(req.body[field]);
        } else {
          data[field] = req.body[field] || null;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.employee.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true, phone: true, dateOfBirth: true, bloodGroup: true,
        maritalStatus: true, gender: true, address: true, city: true,
        state: true, country: true, zipCode: true,
        bankName: true, bankBranch: true, bankAccountNumber: true,
        bankAccountName: true, panNumber: true, ssfNumber: true,
      },
    });

    res.json({ profile: updated, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/auth/profile/emergency-contacts — Employee manage own emergency contacts
router.post('/profile/emergency-contacts', authenticate, async (req, res, next) => {
  try {
    const { getPrisma } = require('../../lib/prisma');
    const prisma = getPrisma();
    const { name, relationship, phone, email, isPrimary } = req.body;

    if (!name || !relationship || !phone) {
      return res.status(400).json({ error: 'name, relationship, and phone are required' });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        orgId: req.user.orgId,
        employeeId: req.user.id,
        name, relationship, phone,
        email: email || null,
        isPrimary: isPrimary || false,
      },
    });

    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
});

router.delete('/profile/emergency-contacts/:contactId', authenticate, async (req, res, next) => {
  try {
    const { getPrisma } = require('../../lib/prisma');
    const prisma = getPrisma();

    const contact = await prisma.emergencyContact.findFirst({
      where: { id: req.params.contactId, employeeId: req.user.id },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    await prisma.emergencyContact.delete({ where: { id: req.params.contactId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
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
