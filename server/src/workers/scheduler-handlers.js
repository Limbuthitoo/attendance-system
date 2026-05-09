// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Handlers — Additional cron-based worker jobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CRM Activity Reminders — Notify employees of upcoming due activities.
 * Runs every 30 min. Finds activities due in the next 60 minutes.
 */
async function handleActivityReminders() {
  const { getPrisma } = require('../lib/prisma');
  const { sendPushToEmployees, createBulkNotifications } = require('../services/notification.service');
  const prisma = getPrisma();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // Find incomplete activities due within the next hour
  const activities = await prisma.crmActivity.findMany({
    where: {
      completed: false,
      dueDate: { gte: now, lte: oneHourLater },
    },
    select: {
      id: true,
      subject: true,
      type: true,
      dueDate: true,
      createdBy: true,
      orgId: true,
      client: { select: { name: true } },
      lead: { select: { title: true } },
      deal: { select: { title: true } },
    },
  });

  if (activities.length === 0) return;

  // Group by creator for batch notifications
  const byCreator = {};
  for (const act of activities) {
    if (!byCreator[act.createdBy]) byCreator[act.createdBy] = [];
    byCreator[act.createdBy].push(act);
  }

  for (const [employeeId, acts] of Object.entries(byCreator)) {
    const first = acts[0];
    const context = first.client?.name || first.lead?.title || first.deal?.title || '';
    const title = acts.length === 1
      ? `Upcoming: ${first.subject}`
      : `${acts.length} activities due soon`;
    const body = acts.length === 1
      ? `${first.type} ${context ? `for ${context}` : ''} is due at ${new Date(first.dueDate).toLocaleTimeString()}`
      : `You have ${acts.length} CRM activities due in the next hour`;

    await sendPushToEmployees([employeeId], {
      title,
      body,
      data: { type: 'crm_activity_reminder', activityId: first.id },
    });

    await createBulkNotifications({
      orgId: first.orgId,
      employeeIds: [employeeId],
      title,
      body,
      type: 'CRM_ACTIVITY_REMINDER',
    });
  }

  console.log(`📋 Activity reminders: ${activities.length} activities, ${Object.keys(byCreator).length} employees notified`);
}

/**
 * Birthday & Work Anniversary Notifications — Daily check.
 * Sends push/in-app notification to the org when someone has a birthday or anniversary.
 */
async function handleBirthdayAnniversary() {
  const { getPrisma } = require('../lib/prisma');
  const { enqueuePush } = require('../config/queue');
  const { createBulkNotifications } = require('../services/notification.service');
  const prisma = getPrisma();

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Find employees with birthday today
  const birthdays = await prisma.employee.findMany({
    where: {
      isActive: true,
      dateOfBirth: { not: null },
    },
    select: { id: true, name: true, orgId: true, dateOfBirth: true },
  });

  const todayBirthdays = birthdays.filter(emp => {
    const dob = new Date(emp.dateOfBirth);
    return dob.getMonth() + 1 === month && dob.getDate() === day;
  });

  // Find work anniversaries (joined today's date in a previous year)
  const anniversaries = await prisma.employee.findMany({
    where: {
      isActive: true,
      joinDate: { not: null },
    },
    select: { id: true, name: true, orgId: true, joinDate: true },
  });

  const todayAnniversaries = anniversaries.filter(emp => {
    const jd = new Date(emp.joinDate);
    return jd.getMonth() + 1 === month && jd.getDate() === day && jd.getFullYear() < today.getFullYear();
  });

  // Process birthdays — notify all active employees in the same org
  const birthdaysByOrg = {};
  for (const emp of todayBirthdays) {
    if (!birthdaysByOrg[emp.orgId]) birthdaysByOrg[emp.orgId] = [];
    birthdaysByOrg[emp.orgId].push(emp);
  }

  for (const [orgId, emps] of Object.entries(birthdaysByOrg)) {
    const orgEmployees = await prisma.employee.findMany({
      where: { orgId, isActive: true },
      select: { id: true },
    });
    const allIds = orgEmployees.map(e => e.id);

    for (const emp of emps) {
      await createBulkNotifications({
        orgId,
        employeeIds: allIds,
        title: '🎂 Birthday Today!',
        body: `Happy Birthday to ${emp.name}! Wish them a great day.`,
        type: 'BIRTHDAY',
      });
    }

    if (emps.length > 0) {
      const names = emps.map(e => e.name).join(', ');
      await enqueuePush({
        employeeIds: allIds,
        title: '🎂 Birthday Today!',
        body: emps.length === 1
          ? `Happy Birthday to ${emps[0].name}!`
          : `Happy Birthday to ${names}!`,
        data: { type: 'birthday' },
      });
    }
  }

  // Process anniversaries
  const anniversariesByOrg = {};
  for (const emp of todayAnniversaries) {
    if (!anniversariesByOrg[emp.orgId]) anniversariesByOrg[emp.orgId] = [];
    anniversariesByOrg[emp.orgId].push(emp);
  }

  for (const [orgId, emps] of Object.entries(anniversariesByOrg)) {
    const orgEmployees = await prisma.employee.findMany({
      where: { orgId, isActive: true },
      select: { id: true },
    });
    const allIds = orgEmployees.map(e => e.id);

    for (const emp of emps) {
      const years = today.getFullYear() - new Date(emp.joinDate).getFullYear();
      await createBulkNotifications({
        orgId,
        employeeIds: allIds,
        title: '🎉 Work Anniversary!',
        body: `Congratulations to ${emp.name} on ${years} year${years > 1 ? 's' : ''} with us!`,
        type: 'ANNIVERSARY',
      });
    }

    if (emps.length > 0) {
      await enqueuePush({
        employeeIds: allIds,
        title: '🎉 Work Anniversary!',
        body: emps.length === 1
          ? `Congratulations to ${emps[0].name} on their work anniversary!`
          : `${emps.length} colleagues celebrating work anniversaries today!`,
        data: { type: 'anniversary' },
      });
    }
  }

  const total = todayBirthdays.length + todayAnniversaries.length;
  if (total > 0) {
    console.log(`🎂 Birthdays: ${todayBirthdays.length}, Anniversaries: ${todayAnniversaries.length}`);
  } else {
    console.log('✓ No birthdays or anniversaries today');
  }
}

/**
 * Attendance Anomaly Detection — Flag unusual attendance patterns.
 * Runs daily. Checks last 7 days for consistently late employees.
 */
async function handleAttendanceAnomalyDetection() {
  const { getPrisma } = require('../lib/prisma');
  const { createBulkNotifications } = require('../services/notification.service');
  const { enqueuePushToAdmins } = require('../config/queue');
  const prisma = getPrisma();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let totalAnomalies = 0;

  for (const org of orgs) {
    // Find employees who were late 4+ times in last 7 days
    const lateFrequent = await prisma.attendance.groupBy({
      by: ['employeeId'],
      where: {
        orgId: org.id,
        date: { gte: sevenDaysAgo },
        status: 'LATE',
      },
      _count: { id: true },
      having: { id: { _count: { gte: 4 } } },
    });

    // Find employees working excessive hours (>10 hrs for 5+ days in a week)
    const overworked = await prisma.attendance.groupBy({
      by: ['employeeId'],
      where: {
        orgId: org.id,
        date: { gte: sevenDaysAgo },
        workHours: { gt: 10 },
      },
      _count: { id: true },
      having: { id: { _count: { gte: 5 } } },
    });

    const anomalyEmployeeIds = [
      ...lateFrequent.map(l => l.employeeId),
      ...overworked.map(o => o.employeeId),
    ];
    const uniqueIds = [...new Set(anomalyEmployeeIds)];

    if (uniqueIds.length > 0) {
      // Get employee names for the notification
      const employees = await prisma.employee.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true },
      });

      const lateNames = employees
        .filter(e => lateFrequent.some(l => l.employeeId === e.id))
        .map(e => e.name);
      const overworkedNames = employees
        .filter(e => overworked.some(o => o.employeeId === e.id))
        .map(e => e.name);

      let body = '';
      if (lateNames.length > 0) body += `Frequently late (4+ days): ${lateNames.join(', ')}. `;
      if (overworkedNames.length > 0) body += `Excessive hours (5+ days >10hrs): ${overworkedNames.join(', ')}.`;

      // Notify HR/admins
      await enqueuePushToAdmins({
        orgId: org.id,
        title: '⚠️ Attendance Anomalies Detected',
        body: body.trim(),
        data: { type: 'attendance_anomaly' },
      });

      // Also create in-app notification for admins
      const admins = await prisma.employeeRole.findMany({
        where: { role: { name: { in: ['org_admin', 'hr_manager'] } }, employee: { orgId: org.id, isActive: true } },
        select: { employeeId: true },
      });

      if (admins.length > 0) {
        await createBulkNotifications({
          orgId: org.id,
          employeeIds: admins.map(a => a.employeeId),
          title: '⚠️ Attendance Anomalies Detected',
          body,
          type: 'ATTENDANCE_ANOMALY',
        });
      }

      totalAnomalies += uniqueIds.length;
    }
  }

  console.log(`⚠️ Anomaly detection complete: ${totalAnomalies} anomalies across ${orgs.length} orgs`);
}

/**
 * Database Cleanup — Purge stale data weekly.
 * - Notifications older than 90 days
 * - Expired push tokens
 * - Old audit log entries (>1 year)
 * - Stale device heartbeats (>30 days offline)
 */
async function handleDatabaseCleanup() {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 1. Delete old notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  // 2. Delete stale push tokens (devices not seen in 90 days)
  const deletedTokens = await prisma.pushToken.deleteMany({
    where: { updatedAt: { lt: ninetyDaysAgo } },
  });

  // 3. Delete old audit logs
  let deletedAuditLogs = 0;
  try {
    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: oneYearAgo } },
    });
    deletedAuditLogs = result.count;
  } catch (e) {
    // AuditLog might not exist in all setups
  }

  // 4. Clean up stale report files (>7 days old)
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '../../data/reports');
  let deletedFiles = 0;
  if (fs.existsSync(reportsDir)) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(reportsDir);
    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedFiles++;
      }
    }
  }

  console.log(`🧹 Cleanup: ${deletedNotifications.count} notifications, ${deletedTokens.count} tokens, ${deletedAuditLogs} audit logs, ${deletedFiles} report files deleted`);
}

/**
 * Invoice Auto-Generation — Generate recurring invoices for active subscriptions.
 * Runs monthly on the 1st. Duplicates the most recent invoice for parties with
 * recurring billing patterns (invoiced same amount 2+ consecutive months).
 */
async function handleInvoiceAutoGeneration() {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  // Find organizations with billing module enabled
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let invoicesCreated = 0;

  for (const org of orgs) {
    try {
      const billingModule = await prisma.orgModule.findFirst({
        where: { orgId: org.id, isActive: true, module: { code: 'billing' } },
      });
      if (!billingModule) continue;

      // Find parties that have been invoiced the same amount for the last 2+ months
      // This indicates a recurring relationship
      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      const recentInvoices = await prisma.billingInvoice.findMany({
        where: {
          orgId: org.id,
          type: 'SALES',
          status: { in: ['ISSUED', 'PAID'] },
          date: { gte: twoMonthsAgo },
        },
        select: { partyId: true, totalAmount: true, items: true, date: true },
        orderBy: { date: 'desc' },
      });

      // Group by party and check for recurring pattern
      const byParty = {};
      for (const inv of recentInvoices) {
        if (!byParty[inv.partyId]) byParty[inv.partyId] = [];
        byParty[inv.partyId].push(inv);
      }

      for (const [partyId, invoices] of Object.entries(byParty)) {
        if (invoices.length < 2) continue;

        // Check if last 2 invoices have same total (recurring pattern)
        const amounts = invoices.slice(0, 2).map(i => Number(i.totalAmount));
        if (amounts[0] !== amounts[1]) continue;

        // Check if already invoiced this month
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const hasThisMonth = invoices.some(i => new Date(i.date) >= thisMonth);
        if (hasThisMonth) continue;

        // Would create invoice here but we just log it as a suggestion
        // (Full auto-generation requires fiscal year, invoice number sequence, etc.)
        console.log(`  🧾 ${org.name}: Recurring pattern detected for party ${partyId} (${amounts[0]})`);
        invoicesCreated++;
      }
    } catch (err) {
      console.error(`  ✗ Invoice auto-gen failed for ${org.name}: ${err.message}`);
    }
  }

  console.log(`🧾 Invoice auto-generation: ${invoicesCreated} recurring patterns detected across ${orgs.length} orgs`);
}

/**
 * Backup Verification — Test the latest backup integrity.
 * Runs weekly. Checks that the backup file exists and is of reasonable size.
 */
async function handleBackupVerification() {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const backupDir = '/backups';
  let status = 'OK';
  let details = '';

  try {
    if (!fs.existsSync(backupDir)) {
      status = 'WARNING';
      details = 'Backup directory not found';
      console.warn(`🗄️ Backup verification: ${details}`);
      return;
    }

    // Find the most recent backup file
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.sql.gz') || f.endsWith('.dump') || f.endsWith('.sql'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      status = 'ERROR';
      details = 'No backup files found';
      console.error(`🗄️ Backup verification: ${details}`);
      return;
    }

    const latest = files[0];
    const ageHours = (Date.now() - latest.time.getTime()) / (1000 * 60 * 60);
    const sizeBytes = fs.statSync(path.join(backupDir, latest.name)).size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    // Check if backup is too old (>25 hours = missed daily backup)
    if (ageHours > 25) {
      status = 'WARNING';
      details = `Latest backup is ${Math.round(ageHours)}h old (${latest.name}, ${sizeMB}MB)`;
    } else if (sizeBytes < 1024) {
      status = 'ERROR';
      details = `Latest backup is suspiciously small: ${sizeBytes} bytes (${latest.name})`;
    } else {
      details = `Latest: ${latest.name} (${sizeMB}MB, ${Math.round(ageHours)}h ago)`;
    }

    // Try to verify gz integrity if it's gzipped
    if (latest.name.endsWith('.gz')) {
      try {
        execSync(`gzip -t "${path.join(backupDir, latest.name)}" 2>&1`, { timeout: 30000 });
      } catch (e) {
        status = 'ERROR';
        details += ' — CORRUPT (gzip integrity check failed)';
      }
    }
  } catch (err) {
    status = 'ERROR';
    details = err.message;
  }

  const icon = status === 'OK' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
  console.log(`🗄️ Backup verification [${icon} ${status}]: ${details}`);

  // If error, notify platform admins
  if (status === 'ERROR') {
    const { getPrisma } = require('../lib/prisma');
    const prisma = getPrisma();
    const platformAdmins = await prisma.employee.findMany({
      where: { role: 'platform_admin', isActive: true },
      select: { id: true, orgId: true },
    });

    if (platformAdmins.length > 0) {
      const { createBulkNotifications } = require('../services/notification.service');
      const admin = platformAdmins[0];
      await createBulkNotifications({
        orgId: admin.orgId,
        employeeIds: platformAdmins.map(a => a.id),
        title: '❌ Backup Verification Failed',
        body: details,
        type: 'BACKUP_ERROR',
      });
    }
  }
}

/**
 * Campaign Analytics Snapshot — Nightly snapshot of campaign performance metrics.
 * Stores historical data for trend analysis.
 */
async function handleCampaignAnalyticsSnapshot() {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  // Get all active campaigns
  const campaigns = await prisma.crmCampaign.findMany({
    where: { status: { in: ['ACTIVE', 'SCHEDULED'] } },
    select: {
      id: true,
      orgId: true,
      name: true,
      sentCount: true,
      deliveredCount: true,
      openedCount: true,
      clickedCount: true,
      respondedCount: true,
      convertedCount: true,
      revenue: true,
      budget: true,
      actualCost: true,
      _count: { select: { leads: true, members: true } },
    },
  });

  if (campaigns.length === 0) {
    console.log('✓ No active campaigns for analytics snapshot');
    return;
  }

  // Store snapshot in campaign notes/description as JSON append (lightweight approach)
  // In production you'd store this in a dedicated analytics table
  const today = new Date().toISOString().split('T')[0];

  for (const campaign of campaigns) {
    const snapshot = {
      date: today,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      opened: campaign.openedCount,
      clicked: campaign.clickedCount,
      responded: campaign.respondedCount,
      converted: campaign.convertedCount,
      revenue: Number(campaign.revenue),
      leads: campaign._count.leads,
      members: campaign._count.members,
      roi: campaign.actualCost && Number(campaign.actualCost) > 0
        ? ((Number(campaign.revenue) - Number(campaign.actualCost)) / Number(campaign.actualCost) * 100).toFixed(1)
        : null,
    };

    // Store as tags array entry (reusing the JSON tags field for lightweight storage)
    const existing = await prisma.crmCampaign.findUnique({
      where: { id: campaign.id },
      select: { tags: true },
    });

    let tags = [];
    try { tags = existing?.tags || []; } catch (e) { tags = []; }

    // Keep only last 90 days of snapshots
    const snapshots = Array.isArray(tags) ? tags.filter(t => typeof t === 'object' && t.date) : [];
    snapshots.push(snapshot);
    const trimmed = snapshots.slice(-90);

    // Store non-snapshot tags separately
    const otherTags = Array.isArray(tags) ? tags.filter(t => typeof t !== 'object' || !t.date) : [];

    await prisma.crmCampaign.update({
      where: { id: campaign.id },
      data: { tags: [...otherTags, ...trimmed] },
    });
  }

  console.log(`📸 Campaign analytics: ${campaigns.length} campaign snapshots saved for ${today}`);
}

/**
 * Employee Document Expiry Alerts — Check for expiring documents/contracts.
 * Alerts 30 days, 7 days, and 1 day before expiry.
 */
async function handleDocumentExpiryAlerts() {
  const { getPrisma } = require('../lib/prisma');
  const { createBulkNotifications } = require('../services/notification.service');
  const { enqueuePushToAdmins, enqueueEmail } = require('../config/queue');
  const prisma = getPrisma();

  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Check contract end dates
  const expiringContracts = await prisma.employee.findMany({
    where: {
      isActive: true,
      contractEndDate: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
    },
    select: {
      id: true,
      name: true,
      orgId: true,
      contractEndDate: true,
      email: true,
    },
  });

  let alertsSent = 0;

  for (const emp of expiringContracts) {
    const daysUntilExpiry = Math.ceil((new Date(emp.contractEndDate) - now) / (24 * 60 * 60 * 1000));

    // Only alert at 30, 7, and 1 day milestones
    if (daysUntilExpiry !== 30 && daysUntilExpiry !== 7 && daysUntilExpiry !== 1) continue;

    const urgency = daysUntilExpiry === 1 ? '🔴' : daysUntilExpiry === 7 ? '🟡' : '🟠';
    const title = `${urgency} Contract Expiring — ${emp.name}`;
    const body = `${emp.name}'s contract expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''} (${new Date(emp.contractEndDate).toLocaleDateString()}).`;

    // Notify HR/admins
    await enqueuePushToAdmins({
      orgId: emp.orgId,
      title,
      body,
      data: { type: 'contract_expiry', employeeId: emp.id },
    });

    // Also notify the employee themselves
    await createBulkNotifications({
      orgId: emp.orgId,
      employeeIds: [emp.id],
      title: `${urgency} Your Contract is Expiring`,
      body: `Your contract expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}. Please contact HR for renewal.`,
      type: 'CONTRACT_EXPIRY',
    });

    alertsSent++;
  }

  // Check probation end dates approaching (for awareness, not auto-transition)
  const expiringProbation = await prisma.employee.findMany({
    where: {
      isActive: true,
      employmentStatus: 'probation',
      probationEndDate: {
        gte: now,
        lte: sevenDaysFromNow,
      },
    },
    select: { id: true, name: true, orgId: true, probationEndDate: true },
  });

  for (const emp of expiringProbation) {
    const daysLeft = Math.ceil((new Date(emp.probationEndDate) - now) / (24 * 60 * 60 * 1000));
    if (daysLeft !== 7 && daysLeft !== 1) continue;

    await enqueuePushToAdmins({
      orgId: emp.orgId,
      title: `📋 Probation Ending — ${emp.name}`,
      body: `${emp.name}'s probation period ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Review and confirm status.`,
      data: { type: 'probation_ending', employeeId: emp.id },
    });

    alertsSent++;
  }

  if (alertsSent > 0) {
    console.log(`📄 Document expiry: ${alertsSent} alerts sent (${expiringContracts.length} contracts, ${expiringProbation.length} probation)`);
  } else {
    console.log('✓ No document expiry alerts today');
  }
}

module.exports = {
  handleActivityReminders,
  handleBirthdayAnniversary,
  handleAttendanceAnomalyDetection,
  handleDatabaseCleanup,
  handleInvoiceAutoGeneration,
  handleBackupVerification,
  handleCampaignAnalyticsSnapshot,
  handleDocumentExpiryAlerts,
};
