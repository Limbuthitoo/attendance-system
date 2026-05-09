// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Queue Definitions — Job queues backed by Redis
// ─────────────────────────────────────────────────────────────────────────────
const { Queue } = require('bullmq');
const { getRedis } = require('./redis');

// Lazy-initialized queues
let emailQueue = null;
let pushQueue = null;
let schedulerQueue = null;
let campaignQueue = null;
let reportQueue = null;
let payrollQueue = null;

function createQueue(name, opts = {}) {
  return new Queue(name, {
    connection: getRedis(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },  // keep last 1000 completed
      removeOnFail: { count: 5000 },      // keep last 5000 failed
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      ...opts,
    },
  });
}

function getEmailQueue() {
  if (!emailQueue) emailQueue = createQueue('email');
  return emailQueue;
}

function getPushQueue() {
  if (!pushQueue) pushQueue = createQueue('push');
  return pushQueue;
}

function getSchedulerQueue() {
  if (!schedulerQueue) schedulerQueue = createQueue('scheduler');
  return schedulerQueue;
}

function getCampaignQueue() {
  if (!campaignQueue) campaignQueue = createQueue('campaign');
  return campaignQueue;
}

function getReportQueue() {
  if (!reportQueue) reportQueue = createQueue('report');
  return reportQueue;
}

function getPayrollQueue() {
  if (!payrollQueue) payrollQueue = createQueue('payroll');
  return payrollQueue;
}

/**
 * Enqueue an email job
 */
async function enqueueEmail({ to, subject, html, orgId }) {
  const queue = getEmailQueue();
  await queue.add('send-email', { to, subject, html, orgId });
}

/**
 * Enqueue a push notification job
 */
async function enqueuePush({ employeeIds, title, body, data }) {
  const queue = getPushQueue();
  await queue.add('send-push', { employeeIds, title, body, data });
}

/**
 * Enqueue a push notification to all admins of an org
 */
async function enqueuePushToAdmins({ orgId, title, body, data }) {
  const queue = getPushQueue();
  await queue.add('send-push-admins', { orgId, title, body, data });
}

/**
 * Enqueue campaign email dispatch (batch sends to campaign members)
 */
async function enqueueCampaignDispatch({ campaignId, orgId, subject, html, batchSize }) {
  const queue = getCampaignQueue();
  await queue.add('dispatch-campaign-emails', { campaignId, orgId, subject, html, batchSize });
}

/**
 * Enqueue campaign lead scoring recalculation
 */
async function enqueueCampaignLeadScoring({ orgId, campaignId }) {
  const queue = getCampaignQueue();
  await queue.add('calculate-lead-scores', { orgId, campaignId });
}

/**
 * Enqueue async report generation
 */
async function enqueueReport({ orgId, type, params, requestedBy }) {
  const queue = getReportQueue();
  const job = await queue.add('generate-report', { orgId, type, params, requestedBy });
  return job.id;
}

/**
 * Enqueue async payroll generation
 */
async function enqueuePayrollGeneration({ orgId, year, month, adminId }) {
  const queue = getPayrollQueue();
  const job = await queue.add('generate-payroll', { orgId, year, month, adminId });
  return job.id;
}

async function closeQueues() {
  const queues = [emailQueue, pushQueue, schedulerQueue, campaignQueue, reportQueue, payrollQueue].filter(Boolean);
  await Promise.all(queues.map((q) => q.close()));
  emailQueue = null;
  pushQueue = null;
  schedulerQueue = null;
  campaignQueue = null;
  reportQueue = null;
  payrollQueue = null;
}

module.exports = {
  getEmailQueue,
  getPushQueue,
  getSchedulerQueue,
  getCampaignQueue,
  getReportQueue,
  getPayrollQueue,
  enqueueEmail,
  enqueuePush,
  enqueuePushToAdmins,
  enqueueCampaignDispatch,
  enqueueCampaignLeadScoring,
  enqueueReport,
  enqueuePayrollGeneration,
  closeQueues,
};
