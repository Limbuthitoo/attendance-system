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
const appUpdateRoutes = require('./app-update');
const deviceRoutes = require('./devices');
const deviceCatalogRoutes = require('./device-catalog');
const settingsRoutes = require('./settings');

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
router.use('/app-update', authenticatePlatform, appUpdateRoutes);
router.use('/devices', authenticatePlatform, deviceRoutes);
router.use('/device-catalog', authenticatePlatform, deviceCatalogRoutes);
router.use('/settings', authenticatePlatform, settingsRoutes);

module.exports = router;
