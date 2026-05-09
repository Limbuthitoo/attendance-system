// ─────────────────────────────────────────────────────────────────────────────
// Campaign Worker — Handles campaign email dispatch & lead scoring
// ─────────────────────────────────────────────────────────────────────────────
const { Worker } = require('bullmq');

function createCampaignWorker(connection) {
  const worker = new Worker('campaign', async (job) => {
    if (job.name === 'dispatch-campaign-emails') {
      await handleCampaignEmailDispatch(job.data);
    }
    if (job.name === 'calculate-lead-scores') {
      await handleLeadScoring(job.data);
    }
  }, { connection, concurrency: 2 });

  worker.on('failed', (job, err) => {
    console.error(`📧 Campaign job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Dispatch emails to all campaign members in batches.
 * Updates campaign sentCount/deliveredCount as it progresses.
 */
async function handleCampaignEmailDispatch({ campaignId, orgId, subject, html, batchSize = 50 }) {
  const { getPrisma } = require('../lib/prisma');
  const { getEmailQueue } = require('../config/queue');
  const prisma = getPrisma();

  // Get campaign info
  const campaign = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) {
    console.error(`Campaign ${campaignId} not found`);
    return;
  }

  // Get all targeted members with email addresses
  const members = await prisma.crmCampaignMember.findMany({
    where: {
      campaignId,
      orgId,
      status: 'TARGETED',
      contactEmail: { not: null },
    },
    select: { id: true, contactEmail: true, contactName: true },
  });

  if (members.length === 0) {
    console.log(`📧 Campaign "${campaign.name}": No targeted members with emails`);
    return;
  }

  console.log(`📧 Campaign "${campaign.name}": Dispatching to ${members.length} members`);

  let sentCount = 0;
  const emailQueue = getEmailQueue();

  // Process in batches
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);

    for (const member of batch) {
      // Personalize email content
      const personalizedHtml = html
        .replace(/{{name}}/gi, member.contactName || 'there')
        .replace(/{{email}}/gi, member.contactEmail);

      const personalizedSubject = subject
        .replace(/{{name}}/gi, member.contactName || 'there');

      await emailQueue.add('send-email', {
        to: member.contactEmail,
        subject: personalizedSubject,
        html: personalizedHtml,
        orgId,
      });

      // Update member status to SENT
      await prisma.crmCampaignMember.update({
        where: { id: member.id },
        data: { status: 'SENT' },
      });

      sentCount++;
    }

    // Update campaign metrics after each batch
    await prisma.crmCampaign.update({
      where: { id: campaignId },
      data: { sentCount, status: 'ACTIVE' },
    });
  }

  // Final update
  await prisma.crmCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      deliveredCount: sentCount, // assume delivered = sent for now
      status: 'ACTIVE',
    },
  });

  console.log(`📧 Campaign "${campaign.name}": ${sentCount} emails dispatched`);
}

/**
 * Recalculate lead scores based on campaign interaction metrics.
 * Scoring: responded +30, clicked +20, opened +15, delivered +5, converted +50
 */
async function handleLeadScoring({ orgId, campaignId }) {
  const { getPrisma } = require('../lib/prisma');
  const prisma = getPrisma();

  const where = { orgId };
  if (campaignId) where.campaignId = campaignId;

  // Get all leads with campaign data
  const leads = await prisma.crmLead.findMany({
    where,
    select: {
      id: true,
      score: true,
      campaignId: true,
      status: true,
    },
  });

  if (leads.length === 0) return;

  // Get campaign metrics for leads that came from campaigns
  const campaignIds = [...new Set(leads.filter(l => l.campaignId).map(l => l.campaignId))];
  const campaigns = await prisma.crmCampaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, convertedCount: true, respondedCount: true, openedCount: true, sentCount: true },
  });
  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]));

  let updated = 0;
  for (const lead of leads) {
    let score = 10; // base score

    // Status-based scoring
    if (lead.status === 'CONTACTED') score += 15;
    if (lead.status === 'QUALIFIED') score += 30;
    if (lead.status === 'CONVERTED') score += 50;

    // Campaign engagement scoring
    if (lead.campaignId && campaignMap[lead.campaignId]) {
      const camp = campaignMap[lead.campaignId];
      const conversionRate = camp.sentCount > 0 ? camp.convertedCount / camp.sentCount : 0;
      // Leads from high-converting campaigns get bonus points
      if (conversionRate > 0.1) score += 20;
      else if (conversionRate > 0.05) score += 10;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    if (score !== lead.score) {
      await prisma.crmLead.update({
        where: { id: lead.id },
        data: { score },
      });
      updated++;
    }
  }

  console.log(`🎯 Lead scoring: updated ${updated}/${leads.length} leads for org ${orgId}`);
}

module.exports = { createCampaignWorker };
