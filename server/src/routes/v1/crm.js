// ─────────────────────────────────────────────────────────────────────────────
// CRM Routes — Pipelines, Clients, Contacts, Leads, Deals, Activities
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const crmService = require('../../services/crm.service');

const router = Router();

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const data = await crmService.getDashboard({ orgId: req.orgId });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Pipelines ────────────────────────────────────────────────────────────────

router.get('/pipelines', async (req, res) => {
  try {
    const pipelines = await crmService.listPipelines({ orgId: req.orgId });
    res.json({ pipelines });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/pipelines/:id', async (req, res) => {
  try {
    const pipeline = await crmService.getPipeline({ orgId: req.orgId, id: req.params.id });
    res.json({ pipeline });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/pipelines', requirePermission('crm.manage'), async (req, res) => {
  try {
    const pipeline = await crmService.createPipeline({ orgId: req.orgId, data: req.body });
    res.status(201).json({ pipeline });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/pipelines/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const pipeline = await crmService.updatePipeline({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ pipeline });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/pipelines/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deletePipeline({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Clients ──────────────────────────────────────────────────────────────────

router.get('/clients', async (req, res) => {
  try {
    const clients = await crmService.listClients({ orgId: req.orgId, search: req.query.search, type: req.query.type });
    res.json({ clients });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const client = await crmService.getClient({ orgId: req.orgId, id: req.params.id });
    res.json({ client });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/clients', requirePermission('crm.manage'), async (req, res) => {
  try {
    const client = await crmService.createClient({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ client });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/clients/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const client = await crmService.updateClient({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ client });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/clients/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteClient({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Contacts ─────────────────────────────────────────────────────────────────

router.get('/contacts', async (req, res) => {
  try {
    const contacts = await crmService.listContacts({ orgId: req.orgId, clientId: req.query.clientId });
    res.json({ contacts });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/contacts', requirePermission('crm.manage'), async (req, res) => {
  try {
    const contact = await crmService.createContact({ orgId: req.orgId, data: req.body });
    res.status(201).json({ contact });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/contacts/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const contact = await crmService.updateContact({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ contact });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/contacts/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteContact({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Leads ────────────────────────────────────────────────────────────────────

router.get('/leads', async (req, res) => {
  try {
    const { status, assignedTo, priority, search } = req.query;
    const leads = await crmService.listLeads({ orgId: req.orgId, status, assignedTo, priority, search });
    res.json({ leads });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await crmService.getLead({ orgId: req.orgId, id: req.params.id });
    res.json({ lead });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/leads', requirePermission('crm.manage'), async (req, res) => {
  try {
    const lead = await crmService.createLead({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ lead });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/leads/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const lead = await crmService.updateLead({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ lead });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/leads/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteLead({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/leads/:id/convert', requirePermission('crm.manage'), async (req, res) => {
  try {
    const deal = await crmService.convertLead({ orgId: req.orgId, id: req.params.id, dealData: req.body, userId: req.user.id });
    res.status(201).json({ deal });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Deals ────────────────────────────────────────────────────────────────────

router.get('/deals', async (req, res) => {
  try {
    const { status, pipelineId, assignedTo, search } = req.query;
    const deals = await crmService.listDeals({ orgId: req.orgId, status, pipelineId, assignedTo, search });
    res.json({ deals });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/deals/:id', async (req, res) => {
  try {
    const deal = await crmService.getDeal({ orgId: req.orgId, id: req.params.id });
    res.json({ deal });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/deals', requirePermission('crm.manage'), async (req, res) => {
  try {
    const deal = await crmService.createDeal({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ deal });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/deals/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const deal = await crmService.updateDeal({ orgId: req.orgId, id: req.params.id, data: req.body, userId: req.user.id });
    res.json({ deal });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/deals/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteDeal({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Activities ───────────────────────────────────────────────────────────────

router.get('/activities', async (req, res) => {
  try {
    const { clientId, dealId, leadId, type, limit } = req.query;
    const activities = await crmService.listActivities({ orgId: req.orgId, clientId, dealId, leadId, type, limit: limit ? parseInt(limit) : undefined });
    res.json({ activities });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/activities', requirePermission('crm.manage'), async (req, res) => {
  try {
    const activity = await crmService.createActivity({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ activity });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/activities/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const activity = await crmService.updateActivity({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ activity });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/activities/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteActivity({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Campaigns ────────────────────────────────────────────────────────────────

router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await crmService.listCampaigns(req.orgId, req.query);
    res.json({ campaigns });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/campaigns/stats', async (req, res) => {
  try {
    const stats = await crmService.getCampaignStats(req.orgId);
    res.json(stats);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await crmService.getCampaign(req.orgId, req.params.id);
    res.json({ campaign });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/campaigns', requirePermission('crm.manage'), async (req, res) => {
  try {
    const campaign = await crmService.createCampaign(req.orgId, req.body, req.user.id);
    res.status(201).json({ campaign });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/campaigns/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const campaign = await crmService.updateCampaign(req.orgId, req.params.id, req.body);
    res.json({ campaign });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/campaigns/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.deleteCampaign(req.orgId, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Campaign Members ─────────────────────────────────────────────────────────

router.get('/campaigns/:id/members', async (req, res) => {
  try {
    const members = await crmService.listCampaignMembers(req.orgId, req.params.id);
    res.json({ members });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/campaigns/:id/members', requirePermission('crm.manage'), async (req, res) => {
  try {
    const result = await crmService.addCampaignMembers(req.orgId, req.params.id, req.body.members, req.user.id);
    res.status(201).json(result);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/campaigns/members/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    const member = await crmService.updateCampaignMember(req.orgId, req.params.id, req.body);
    res.json({ member });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/campaigns/members/:id', requirePermission('crm.manage'), async (req, res) => {
  try {
    await crmService.removeCampaignMember(req.orgId, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// POST /campaigns/:id/dispatch — Dispatch campaign emails to all targeted members
router.post('/campaigns/:id/dispatch', requirePermission('crm.manage'), async (req, res) => {
  try {
    const { subject, html, batchSize } = req.body;
    if (!subject || !html) {
      return res.status(400).json({ error: 'subject and html are required' });
    }
    const { enqueueCampaignDispatch } = require('../../config/queue');
    await enqueueCampaignDispatch({
      campaignId: req.params.id,
      orgId: req.orgId,
      subject,
      html,
      batchSize: batchSize || 50,
    });
    res.json({ success: true, message: 'Campaign dispatch queued' });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// POST /campaigns/:id/score-leads — Trigger lead scoring for a campaign
router.post('/campaigns/:id/score-leads', requirePermission('crm.manage'), async (req, res) => {
  try {
    const { enqueueCampaignLeadScoring } = require('../../config/queue');
    await enqueueCampaignLeadScoring({ orgId: req.orgId, campaignId: req.params.id });
    res.json({ success: true, message: 'Lead scoring queued' });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
