// ─────────────────────────────────────────────────────────────────────────────
// Platform Routes Index — Super-admin API for managing the SaaS platform
// Mounted at /api/platform
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticatePlatform, requireSuperAdmin } = require('../../middleware/platformAuth');

const platformAuthRoutes = require('./auth');
const orgRoutes = require('./organizations');
const moduleRoutes = require('./modules');
const dashboardRoutes = require('./dashboard');
const planRoutes = require('./plans');
const billingRoutes = require('./billing');
const userRoutes = require('./users');

const router = Router();

// Public: platform login
router.use('/auth', platformAuthRoutes);

// Protected: all other platform routes require platform auth
router.use('/organizations', authenticatePlatform, orgRoutes);
router.use('/modules', authenticatePlatform, moduleRoutes);
router.use('/plans', authenticatePlatform, planRoutes);
router.use('/billing', authenticatePlatform, billingRoutes);
router.use('/users', authenticatePlatform, userRoutes);
router.use('/dashboard', authenticatePlatform, dashboardRoutes);

module.exports = router;
