// ─────────────────────────────────────────────────────────────────────────────
// Payroll Worker — Async payroll computation
// ─────────────────────────────────────────────────────────────────────────────
const { Worker } = require('bullmq');

function createPayrollWorker(connection) {
  const worker = new Worker('payroll', async (job) => {
    if (job.name === 'generate-payroll') {
      await handlePayrollGeneration(job);
    }
  }, { connection, concurrency: 1 }); // Single concurrency to avoid DB contention

  worker.on('failed', (job, err) => {
    console.error(`💰 Payroll job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function handlePayrollGeneration(job) {
  const { orgId, year, month, adminId } = job.data;
  const { generatePayrollSummary } = require('../services/payroll.service');
  const { createBulkNotifications } = require('../services/notification.service');

  console.log(`💰 Payroll generation starting: org=${orgId}, ${year}/${month}`);

  try {
    const result = await generatePayrollSummary({ orgId, year, month, adminId });

    // Notify the admin who requested it
    if (adminId) {
      await createBulkNotifications({
        orgId,
        employeeIds: [adminId],
        title: 'Payroll Generated',
        body: `Payroll for ${year}/${month} has been generated. ${result.count || 0} employee records processed.`,
        type: 'PAYROLL_READY',
        data: { year, month },
      });
    }

    console.log(`💰 Payroll generation complete: ${result.count || 0} records for org ${orgId}`);
    return result;
  } catch (err) {
    // Notify admin of failure
    if (adminId) {
      await createBulkNotifications({
        orgId,
        employeeIds: [adminId],
        title: 'Payroll Generation Failed',
        body: `Payroll for ${year}/${month} failed: ${err.message}`,
        type: 'PAYROLL_ERROR',
        data: { year, month, error: err.message },
      });
    }
    throw err;
  }
}

module.exports = { createPayrollWorker };
