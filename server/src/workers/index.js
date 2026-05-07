// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Worker Process — Handles async jobs (email, push, scheduled tasks)
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
  const { to, subject, html } = job.data;
  const transport = getTransporter();
  if (!transport) {
    console.warn('⚠ Email not sent — SMTP not configured');
    return;
  }
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
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
    const { employeeIds, title, body, data } = job.data;
    await sendPushToEmployees(employeeIds, { title, body, data });
    console.log(`🔔 Push sent to ${employeeIds.length} employees`);
  }

  if (job.name === 'send-push-admins') {
    const { orgId, title, body, data } = job.data;
    await sendPushToAdmins(orgId, { title, body, data });
    console.log(`🔔 Push sent to admins of org ${orgId}`);
  }
}, { connection });

pushWorker.on('failed', (job, err) => {
  console.error(`🔔 Push job ${job?.id} failed:`, err.message);
});

// ── Scheduler Worker (cron-like jobs) ───────────────────────────────────────
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
  // Marks absent for no-shows, auto-checkouts for forgot checkouts
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

  console.log('✓ Repeatable jobs registered');
  await schedulerQueue.close();
}

registerRepeatableJobs().catch((err) => {
  console.error('Failed to register repeatable jobs:', err.message);
});

console.log('✓ Workers started: email, push, scheduler');

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down workers...');
  await Promise.all([
    emailWorker.close(),
    pushWorker.close(),
    schedulerWorker.close(),
  ]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
