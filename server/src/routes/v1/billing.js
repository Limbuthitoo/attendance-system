// ─────────────────────────────────────────────────────────────────────────────
// Billing Routes — Parties, Invoices, Payments, VAT Reports
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const billingService = require('../../services/billing.service');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING PARTIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/parties', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.listParties({ orgId: req.user.orgId, type: req.query.type, search: req.query.search });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/parties/:id', requirePermission('billing.view'), async (req, res) => {
  try {
    const party = await billingService.getParty(req.user.orgId, req.params.id);
    res.json(party);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/parties', requirePermission('billing.manage'), async (req, res) => {
  try {
    const party = await billingService.createParty({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(party);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/parties/:id', requirePermission('billing.manage'), async (req, res) => {
  try {
    const party = await billingService.updateParty({ orgId: req.user.orgId, partyId: req.params.id, data: req.body, adminId: req.user.id, req });
    res.json(party);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/invoices', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.listInvoices({
      orgId: req.user.orgId, type: req.query.type, status: req.query.status,
      partyId: req.query.partyId, startDate: req.query.startDate, endDate: req.query.endDate, limit: req.query.limit,
    });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/invoices/:id', requirePermission('billing.view'), async (req, res) => {
  try {
    const invoice = await billingService.getInvoice(req.user.orgId, req.params.id);
    res.json(invoice);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/invoices', requirePermission('billing.manage'), async (req, res) => {
  try {
    const invoice = await billingService.createInvoice({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(invoice);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/invoices/:id', requirePermission('billing.manage'), async (req, res) => {
  try {
    const invoice = await billingService.updateInvoice({ orgId: req.user.orgId, invoiceId: req.params.id, data: req.body, adminId: req.user.id, req });
    res.json(invoice);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/invoices/:id/issue', requirePermission('billing.manage'), async (req, res) => {
  try {
    const invoice = await billingService.issueInvoice({ orgId: req.user.orgId, invoiceId: req.params.id, adminId: req.user.id, req });
    res.json(invoice);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/invoices/:id/cancel', requirePermission('billing.manage'), async (req, res) => {
  try {
    const invoice = await billingService.cancelInvoice({ orgId: req.user.orgId, invoiceId: req.params.id, adminId: req.user.id, req });
    res.json(invoice);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/payments', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.listPayments({
      orgId: req.user.orgId, type: req.query.type, partyId: req.query.partyId,
      startDate: req.query.startDate, endDate: req.query.endDate, limit: req.query.limit,
    });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/payments', requirePermission('billing.manage'), async (req, res) => {
  try {
    const payment = await billingService.recordPayment({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(payment);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/payments/:id/void', requirePermission('billing.manage'), async (req, res) => {
  try {
    const result = await billingService.voidPayment({ orgId: req.user.orgId, paymentId: req.params.id, adminId: req.user.id, req });
    res.json(result);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTY STATEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/parties/:id/statement', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.getPartyStatement({ orgId: req.user.orgId, partyId: req.params.id, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/reports/aging', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.getAgingReport({ orgId: req.user.orgId, type: req.query.type || 'receivable' });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/reports/vat-summary', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.getVatSummary({ orgId: req.user.orgId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/reports/day-book', requirePermission('billing.view'), async (req, res) => {
  try {
    const data = await billingService.getDayBook({ orgId: req.user.orgId, date: req.query.date, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/settings', requirePermission('billing.view'), async (req, res) => {
  try {
    const settings = await billingService.getBillingSettings(req.user.orgId);
    res.json(settings);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/settings', requirePermission('billing.manage'), async (req, res) => {
  try {
    const settings = await billingService.updateBillingSettings({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.json(settings);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
