// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Queue Definitions — Job queues backed by Redis
// ─────────────────────────────────────────────────────────────────────────────
const { Queue } = require('bullmq');
const { getRedis } = require('./redis');

// Lazy-initialized queues
let emailQueue = null;
let pushQueue = null;
let schedulerQueue = null;

function createQueue(name) {
  return new Queue(name, {
    connection: getRedis(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },  // keep last 1000 completed
      removeOnFail: { count: 5000 },      // keep last 5000 failed
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
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

/**
 * Enqueue an email job
 */
async function enqueueEmail({ to, subject, html }) {
  const queue = getEmailQueue();
  await queue.add('send-email', { to, subject, html });
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

async function closeQueues() {
  const queues = [emailQueue, pushQueue, schedulerQueue].filter(Boolean);
  await Promise.all(queues.map((q) => q.close()));
  emailQueue = null;
  pushQueue = null;
  schedulerQueue = null;
}

module.exports = {
  getEmailQueue,
  getPushQueue,
  getSchedulerQueue,
  enqueueEmail,
  enqueuePush,
  enqueuePushToAdmins,
  closeQueues,
};
