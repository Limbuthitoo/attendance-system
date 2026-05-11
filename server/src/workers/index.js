// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Worker Process — Handles async jobs (email, push, scheduled tasks,
// campaigns, reports, payroll)
// Run separately: node src/workers/index.js
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const nodemailer = require('nodemailer');

console.log('🔧 Starting worker process...');

const connection = getRedis();

// ── Email Worker ────────────────────────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const emailWorker = new Worker('email', async (job) => {
  const { to, subject, html, orgId } = job.data;

  // Try org-specific SMTP first, then fall back to env transporter
  let transport = null;
  let from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (orgId) {
    try {
      const { getOrgSmtpConfig } = require('../mailer');
      const cfg = await getOrgSmtpConfig(orgId);
      if (cfg) {
        transport = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.port === 465,
          auth: { user: cfg.user, pass: cfg.pass },
        });
        from = cfg.from;
      }
    } catch (e) {
      // Fall through to env transporter
    }
  }

  if (!transport) {
    transport = getTransporter();
  }

  if (!transport) {
    console.warn('⚠ Email not sent — SMTP not configured');
    return;
  }
  await transport.sendMail({ from, to, subject, html });
  console.log(`✉ Email sent to ${to}: ${subject}`);
}, { connection });

emailWorker.on('failed', (job, err) => {
  console.error(`✉ Email job ${job?.id} failed:`, err.message);
});

// ── Push Notification Worker ────────────────────────────────────────────────
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const pushWorker = new Worker('push', async (job) => {
  const { sendPushToEmployees, sendPushToAdmins } = require('../services/notification.service');

  if (job.name === 'send-push') {
    const { employeeIds, title, body, data, orgId, notificationType } = job.data;
    await sendPushToEmployees(employeeIds, { title, body, data, orgId, notificationType });
    console.log(`🔔 Push sent to ${employeeIds.length} employees`);
  }

  if (job.name === 'send-push-admins') {
    const { orgId, title, body, data, notificationType } = job.data;
    await sendPushToAdmins(orgId, { title, body, data, notificationType });
    console.log(`🔔 Push sent to admins of org ${orgId}`);
  }
}, { connection });

pushWorker.on('failed', (job, err) => {
  console.error(`🔔 Push job ${job?.id} failed:`, err.message);
});

// ── Scheduler Worker (cron-like jobs) ───────────────────────────────────────
const {
  handleActivityReminders,
  handleBirthdayAnniversary,
  handleAttendanceAnomalyDetection,
  handleDatabaseCleanup,
  handleInvoiceAutoGeneration,
  handleBackupVerification,
  handleCampaignAnalyticsSnapshot,
  handleDocumentExpiryAlerts,
} = require('./scheduler-handlers');

const schedulerWorker = new Worker('scheduler', async (job) => {
  if (job.name === 'forgot-checkout') {
    await handleForgotCheckout(job.data);
  }
  if (job.name === 'check-trial-expiry') {
    await handleTrialExpiry();
  }
  if (job.name === 'leave-accrual') {
    await handleLeaveAccrual();
  }
  if (job.name === 'leave-carryover') {
    await handleLeaveCarryover();
  }
  if (job.name === 'finalize-attendance') {
    await handleFinalizeAttendance();
  }
  if (job.name === 'device-health-check') {
    const { updateDeviceHealthStatuses } = require('../services/device.service');
    await updateDeviceHealthStatuses();
  }
  if (job.name === 'calculate-monthly-incentives') {
    await handleMonthlyIncentiveCalculation();
  }
  if (job.name === 'check-probation-expiry') {
    await handleProbationExpiry();
  }
  // ── New scheduler jobs ──
  if (job.name === 'activity-reminders') {
    await handleActivityReminders();
  }
  if (job.name === 'birthday-anniversary') {
    await handleBirthdayAnniversary();
  }
  if (job.name === 'attendance-anomaly-detection') {
    await handleAttendanceAnomalyDetection();
  }
  if (job.name === 'database-cleanup') {
    await handleDatabaseCleanup();
  }
  if (job.name === 'invoice-auto-generation') {
    await handleInvoiceAutoGeneration();
  }
  if (job.name === 'backup-verification') {
    await handleBackupVerification();
  }
  if (job.name === 'campaign-analytics-snapshot') {
    await handleCampaignAnalyticsSnapshot();
  }
  if (job.name === 'document-expiry-alerts') {
    await handleDocumentExpiryAlerts();
  }
}, { connection });

async function handleForgotCheckout({ orgId }) {
  const { getPrisma } = require('../lib/prisma');
  const { sendPushToEmployees, createBulkNotifications } = require('../services/notification.service');
  const { getTodayDate } = require('../services/attendance.service');

  const prisma = getPrisma();
  const today = getTodayDate();

  const forgot = await prisma.attendance.findMany({
    where: {
      orgId,
      date: new Date(today),
      checkIn: { not: null },
      checkOut: null,
      employee: { isActive: true },
    },
    select: { employeeId: true },
  });

  if (forgot.length === 0) return;

  const ids = forgot.map((r) => r.employeeId);
  console.log(`📋 Forgot-checkout: notifying ${ids.length} employees in org ${orgId}`);

  await sendPushToEmployees(ids, {
    title: 'Forgot to Check Out?',
    body: "You checked in today but haven't checked out yet. Please check out before leaving.",
    data: { type: 'checkout_reminder' },
    orgId,
    notificationType: 'CHECKOUT_REMINDER',
  });

  await createBulkNotifications({
    orgId,
    employeeIds: ids,
    title: 'Forgot to Check Out?',
    body: "You checked in today but haven't checked out yet.",
    type: 'CHECKOUT_REMINDER',
  });
}

// ── Finalize Attendance Handler ─────────────────────────────────────────────
async function handleFinalizeAttendance() {
  const { getPrisma } = require('../lib/prisma');
  const { finalizeAttendance } = require('../services/attendance.service');

  const prisma = getPrisma();

  // Only process orgs that have the attendance module enabled
  const orgs = await prisma.organization.findMany({
    where: {
      isActive: true,
      orgModules: {
        some: {
          isActive: true,
          module: { code: 'attendance' },
        },
      },
    },
    select: { id: true, name: true },
  });

  // Finalize yesterday's attendance (runs at end of day / start of next day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = yesterday.toISOString().split('T')[0];

  let totalAbsent = 0;
  let totalMissingFull = 0;
  let totalMissingHalf = 0;
  let totalHoliday = 0;
  let totalWeeklyOff = 0;

  for (const org of orgs) {
    try {
      const result = await finalizeAttendance({ orgId: org.id, date: targetDate });
      totalAbsent += result.absentCount;
      totalMissingFull += result.missingCheckoutFullCount;
      totalMissingHalf += result.missingCheckoutHalfCount;
      totalHoliday += result.holidayCount;
      totalWeeklyOff += result.weeklyOffCount;

      if (result.absentCount > 0 || result.missingCheckoutFullCount > 0 || result.missingCheckoutHalfCount > 0) {
        console.log(`  📋 ${org.name}: ${result.absentCount} absent, ${result.missingCheckoutFullCount} missing-co (full), ${result.missingCheckoutHalfCount} missing-co (half), ${result.holidayCount} holiday, ${result.weeklyOffCount} weekly-off`);
      }
    } catch (err) {
      console.error(`  ✗ Attendance finalization failed for ${org.name}: ${err.message}`);
    }
  }

  console.log(`📋 Attendance finalization complete: ${totalAbsent} absent, ${totalMissingFull}+${totalMissingHalf} missing-checkout, ${totalHoliday} holiday, ${totalWeeklyOff} weekly-off across ${orgs.length} orgs`);
}

// ── Monthly Incentive Calculation ───────────────────────────────────────────
async function handleMonthlyIncentiveCalculation() {
  const { getPrisma } = require('../lib/prisma');
  const { calculateIncentives } = require('../services/incentive.service');

  const prisma = getPrisma();

  // Get orgs with incentive module enabled
  const orgs = await prisma.organization.findMany({
    where: {
      isActive: true,
      orgModules: {
        some: { isActive: true, module: { code: 'incentive' } },
      },
    },
    select: { id: true, name: true },
  });

  // Calculate for the previous month
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // JS months 0-indexed
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  let totalCalculated = 0;

  for (const org of orgs) {
    try {
      // Find ACTIVE plans for this org
      const plans = await prisma.incentivePlan.findMany({
        where: { orgId: org.id, status: 'ACTIVE' },
        select: { id: true, name: true },
      });

      for (const plan of plans) {
        try {
          const result = await calculateIncentives({
            orgId: org.id, planId: plan.id,
            year: prevYear, month: prevMonth,
            adminId: null, // system-triggered
          });
          totalCalculated += result.calculated;
          if (result.calculated > 0) {
            console.log(`  💰 ${org.name} → ${plan.name}: ${result.calculated} incentives calculated`);
          }
        } catch (err) {
          console.error(`  ✗ Incentive calculation failed for ${org.name}/${plan.name}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Incentive processing failed for ${org.name}: ${err.message}`);
    }
  }

  console.log(`💰 Monthly incentive calculation complete: ${totalCalculated} records across ${orgs.length} orgs`);
}

// ── Probation Expiry Handler ────────────────────────────────────────────────
async function handleProbationExpiry() {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find employees whose probation end date has passed and are still on probation
  const expiredProbation = await prisma.employee.findMany({
    where: {
      isActive: true,
      employmentStatus: 'probation',
      probationEndDate: { lte: today },
    },
    select: { id: true, name: true, orgId: true, probationEndDate: true },
  });

  if (expiredProbation.length === 0) {
    console.log('✓ No probation expirations today');
    return;
  }

  for (const emp of expiredProbation) {
    try {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { employmentStatus: 'active' },
      });
      console.log(`  ✓ ${emp.name} — probation ended, status → active`);
    } catch (err) {
      console.error(`  ✗ Failed to update ${emp.name}: ${err.message}`);
    }
  }

  console.log(`✅ Probation check complete: ${expiredProbation.length} employees transitioned to active`);
}

schedulerWorker.on('failed', (job, err) => {
  console.error(`⏰ Scheduler job ${job?.id} failed:`, err.message);
});

// ── Trial Expiry Handler ────────────────────────────────────────────────────
async function handleTrialExpiry() {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const now = new Date();

  // Find orgs whose trial has expired but status is still TRIAL
  const expired = await prisma.organization.findMany({
    where: {
      subscriptionStatus: 'TRIAL',
      trialEndsAt: { lt: now },
    },
    select: {
      id: true,
      name: true,
      employees: {
        where: { role: 'admin', isActive: true },
        select: { email: true, name: true },
        take: 1,
      },
    },
  });

  if (expired.length === 0) return;

  console.log(`⏰ Trial expiry: ${expired.length} org(s) expired`);

  for (const org of expired) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionStatus: 'EXPIRED', isActive: false },
    });

    // Send email to org admin
    const admin = org.employees[0];
    if (admin?.email) {
      const { getEmailQueue } = require('../config/queue');
      const emailQueue = getEmailQueue();
      await emailQueue.add('send-email', {
        to: admin.email,
        subject: `Trial Expired — ${org.name}`,
        html: `
          <h2>Your trial has expired</h2>
          <p>Hi ${admin.name || 'Admin'},</p>
          <p>The free trial for <strong>${org.name}</strong> has ended.
             Your team can no longer check in, create employees, or access the system.</p>
          <p>To continue using the Attendance system, please upgrade to a paid plan.</p>
          <p>Contact us to upgrade: <a href="mailto:support@archisys.com">support@archisys.com</a></p>
        `,
      });
    }

    console.log(`  ✓ Expired org: ${org.name} (${org.id})`);
  }

  // Also find orgs whose trial ends in 3 days and warn them
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const almostExpired = await prisma.organization.findMany({
    where: {
      subscriptionStatus: 'TRIAL',
      trialEndsAt: { gt: now, lt: threeDaysFromNow },
    },
    select: {
      id: true,
      name: true,
      trialEndsAt: true,
      employees: {
        where: { role: 'admin', isActive: true },
        select: { email: true, name: true },
        take: 1,
      },
    },
  });

  for (const org of almostExpired) {
    const admin = org.employees[0];
    if (admin?.email) {
      const daysLeft = Math.ceil((new Date(org.trialEndsAt) - now) / (24 * 60 * 60 * 1000));
      const { getEmailQueue } = require('../config/queue');
      const emailQueue = getEmailQueue();
      await emailQueue.add('send-email', {
        to: admin.email,
        subject: `Trial Ending Soon — ${org.name} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)`,
        html: `
          <h2>Your trial is ending soon</h2>
          <p>Hi ${admin.name || 'Admin'},</p>
          <p>The free trial for <strong>${org.name}</strong> will expire in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
          <p>Upgrade now to avoid losing access to your attendance data.</p>
          <p>Contact us: <a href="mailto:support@archisys.com">support@archisys.com</a></p>
        `,
      });
    }
  }

  if (almostExpired.length > 0) {
    console.log(`  ✉ Sent ${almostExpired.length} trial warning email(s)`);
  }
}

// ── Leave Accrual Handler ───────────────────────────────────────────────────
async function handleLeaveAccrual() {
  const { getPrisma } = require('../lib/prisma');
  const { accrueEarnedLeave } = require('../services/leave.service');

  const prisma = getPrisma();
  const now = new Date();
  const year = now.getFullYear();

  // Get all active orgs
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let totalAccrued = 0;
  for (const org of orgs) {
    try {
      const result = await accrueEarnedLeave({ orgId: org.id, year });
      totalAccrued += result.accrued;
      if (result.accrued > 0) {
        console.log(`  📅 Recalculated earned leave for ${result.accrued} employees in ${org.name}`);
      }
    } catch (err) {
      console.error(`  ✗ Leave accrual failed for ${org.name}: ${err.message}`);
    }
  }

  console.log(`📅 Leave accrual complete: ${totalAccrued} employees across ${orgs.length} orgs`);
}

// ── Leave Carryover Handler ─────────────────────────────────────────────────
async function handleLeaveCarryover() {
  const { getPrisma } = require('../lib/prisma');
  const { carryOverLeave } = require('../services/leave.service');

  const prisma = getPrisma();
  const previousYear = new Date().getFullYear() - 1;

  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let totalCarried = 0;
  for (const org of orgs) {
    try {
      const result = await carryOverLeave({ orgId: org.id, fromYear: previousYear });
      totalCarried += result.carried;
      if (result.carried > 0) {
        console.log(`  🔄 Carried over leave for ${result.carried} employees in ${org.name}`);
      }
    } catch (err) {
      console.error(`  ✗ Leave carryover failed for ${org.name}: ${err.message}`);
    }
  }

  console.log(`🔄 Leave carryover complete: ${totalCarried} employees across ${orgs.length} orgs`);
}


// ── Register Repeatable Jobs ────────────────────────────────────────────────
async function registerRepeatableJobs() {
  const { Queue } = require('bullmq');
  const schedulerQueue = new Queue('scheduler', { connection });

  // Check trial expiry daily at midnight Nepal time (UTC 18:15 previous day)
  await schedulerQueue.add('check-trial-expiry', {}, {
    repeat: { pattern: '15 18 * * *' },  // 00:00 NPT = 18:15 UTC
    jobId: 'trial-expiry-daily',
  });

  // Finalize attendance daily at 23:55 NPT (18:10 UTC)
  await schedulerQueue.add('finalize-attendance', {}, {
    repeat: { pattern: '10 18 * * *' },  // 23:55 NPT = 18:10 UTC
    jobId: 'finalize-attendance-daily',
  });

  // Leave accrual — 1st of every month at 00:05 NPT (18:20 UTC previous day)
  await schedulerQueue.add('leave-accrual', {}, {
    repeat: { pattern: '20 18 1 * *' },  // 1st of month, 00:05 NPT
    jobId: 'leave-accrual-monthly',
  });

  // Leave carryover — January 1st at 00:10 NPT (18:25 UTC Dec 31)
  await schedulerQueue.add('leave-carryover', {}, {
    repeat: { pattern: '25 18 1 1 *' },  // Jan 1st, 00:10 NPT
    jobId: 'leave-carryover-yearly',
  });

  // Device health check every 2 minutes
  await schedulerQueue.add('device-health-check', {}, {
    repeat: { pattern: '*/2 * * * *' },
    jobId: 'device-health-check',
  });

  // Auto-calculate monthly incentives on 1st of every month at 01:00 NPT (19:15 UTC)
  await schedulerQueue.add('calculate-monthly-incentives', {}, {
    repeat: { pattern: '15 19 1 * *' },
    jobId: 'incentive-monthly-calc',
  });

  // Check probation expiry daily at 00:30 NPT (18:45 UTC)
  await schedulerQueue.add('check-probation-expiry', {}, {
    repeat: { pattern: '45 18 * * *' },
    jobId: 'probation-expiry-daily',
  });

  // ── New Scheduled Jobs ──────────────────────────────────────────────────

  // CRM Activity Reminders — every 30 minutes
  await schedulerQueue.add('activity-reminders', {}, {
    repeat: { pattern: '*/30 * * * *' },
    jobId: 'activity-reminders-30m',
  });

  // Birthday & Anniversary — daily at 07:00 NPT (01:15 UTC)
  await schedulerQueue.add('birthday-anniversary', {}, {
    repeat: { pattern: '15 1 * * *' },
    jobId: 'birthday-anniversary-daily',
  });

  // Attendance Anomaly Detection — daily at 06:00 NPT (00:15 UTC)
  await schedulerQueue.add('attendance-anomaly-detection', {}, {
    repeat: { pattern: '15 0 * * *' },
    jobId: 'attendance-anomaly-daily',
  });

  // Database Cleanup — every Sunday at 02:00 NPT (20:15 UTC Saturday)
  await schedulerQueue.add('database-cleanup', {}, {
    repeat: { pattern: '15 20 * * 6' },
    jobId: 'database-cleanup-weekly',
  });

  // Invoice Auto-Generation — 1st of every month at 02:00 NPT (20:15 UTC)
  await schedulerQueue.add('invoice-auto-generation', {}, {
    repeat: { pattern: '15 20 1 * *' },
    jobId: 'invoice-auto-generation-monthly',
  });

  // Backup Verification — every Sunday at 04:00 NPT (22:15 UTC Saturday)
  await schedulerQueue.add('backup-verification', {}, {
    repeat: { pattern: '15 22 * * 6' },
    jobId: 'backup-verification-weekly',
  });

  // Campaign Analytics Snapshot — daily at 23:30 NPT (17:45 UTC)
  await schedulerQueue.add('campaign-analytics-snapshot', {}, {
    repeat: { pattern: '45 17 * * *' },
    jobId: 'campaign-analytics-daily',
  });

  // Document Expiry Alerts — daily at 08:00 NPT (02:15 UTC)
  await schedulerQueue.add('document-expiry-alerts', {}, {
    repeat: { pattern: '15 2 * * *' },
    jobId: 'document-expiry-daily',
  });

  console.log('✓ Repeatable jobs registered (15 total)');
  await schedulerQueue.close();
}

// ── Initialize Campaign, Report, Payroll Workers ─────────────────────────────
const { createCampaignWorker } = require('./campaign.worker');
const { createReportWorker } = require('./report.worker');
const { createPayrollWorker } = require('./payroll.worker');

const campaignWorker = createCampaignWorker(connection);
const reportWorker = createReportWorker(connection);
const payrollWorker = createPayrollWorker(connection);

registerRepeatableJobs().catch((err) => {
  console.error('Failed to register repeatable jobs:', err.message);
});

console.log('✓ Workers started: email, push, scheduler, campaign, report, payroll');

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down workers...');
  await Promise.all([
    emailWorker.close(),
    pushWorker.close(),
    schedulerWorker.close(),
    campaignWorker.close(),
    reportWorker.close(),
    payrollWorker.close(),
  ]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
