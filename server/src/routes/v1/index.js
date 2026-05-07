// ─────────────────────────────────────────────────────────────────────────────
// API v1 Router Index — Mounts all v1 sub-routers
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const { tenantContext } = require('../../middleware/tenantContext');
const { requireModule } = require('../../middleware/moduleGuard');

const authRoutes = require('./auth');
const attendanceRoutes = require('./attendance');
const leaveRoutes = require('./leaves');
const employeeRoutes = require('./employees');
const dashboardRoutes = require('./dashboard');
const deviceRoutes = require('./devices');
const settingsRoutes = require('./settings');
const holidayRoutes = require('./holidays');
const noticeRoutes = require('./notices');
const notificationRoutes = require('./notifications');
const branchRoutes = require('./branches');
const roleRoutes = require('./roles');
const qrRoutes = require('./qr');
const reportRoutes = require('./reports');
const overtimeRoutes = require('./overtime');
const geofenceRoutes = require('./geofence');
const payrollRoutes = require('./payroll');
const nfcRoutes = require('./nfc');
const appUpdateRoutes = require('./app-update');
const policyRoutes = require('./policies');

const router = Router();

// Public routes (no auth)
router.use('/auth', authRoutes);

// Protected routes (require auth + tenant context)
router.use('/attendance', authenticate, tenantContext, requireModule('attendance'), attendanceRoutes);
router.use('/leaves', authenticate, tenantContext, requireModule('leave'), leaveRoutes);
router.use('/employees', authenticate, tenantContext, employeeRoutes);
router.use('/dashboard', authenticate, tenantContext, dashboardRoutes);
router.use('/devices', deviceRoutes);  // has its own mixed auth
router.use('/settings', authenticate, tenantContext, settingsRoutes);
router.use('/holidays', authenticate, tenantContext, requireModule('holiday'), holidayRoutes);
router.use('/notices', authenticate, tenantContext, requireModule('notice'), noticeRoutes);
router.use('/notifications', authenticate, tenantContext, notificationRoutes);
router.use('/branches', authenticate, tenantContext, branchRoutes);
router.use('/roles', authenticate, tenantContext, roleRoutes);
router.use('/qr', qrRoutes);  // has its own mixed auth (device + employee)
router.use('/reports', authenticate, tenantContext, requireModule('report'), reportRoutes);
router.use('/overtime', authenticate, tenantContext, requireModule('payroll'), overtimeRoutes);
router.use('/geofence', authenticate, tenantContext, requireModule('geofence'), geofenceRoutes);
router.use('/payroll', authenticate, tenantContext, requireModule('payroll'), payrollRoutes);
router.use('/nfc', nfcRoutes);  // has its own mixed auth (device + admin)
router.use('/policies', authenticate, tenantContext, policyRoutes);
router.use('/app-update', appUpdateRoutes);  // check/download are public; upload/current need auth
module.exports = router;
