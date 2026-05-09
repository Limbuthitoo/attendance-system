// ─────────────────────────────────────────────────────────────────────────────
// Accounting Routes — Fiscal Years, Chart of Accounts, Journal Entries, Reports
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const accountingService = require('../../services/accounting.service');

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// FISCAL YEARS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/fiscal-years', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.listFiscalYears(req.user.orgId);
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/fiscal-years', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const fy = await accountingService.createFiscalYear({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(fy);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/fiscal-years/:id', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const fy = await accountingService.updateFiscalYear({ orgId: req.user.orgId, fyId: req.params.id, data: req.body, adminId: req.user.id, req });
    res.json(fy);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/fiscal-years/:id/close', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const result = await accountingService.closeFiscalYear({ orgId: req.user.orgId, fyId: req.params.id, adminId: req.user.id, req });
    res.json(result);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/accounts', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.listAccounts({ orgId: req.user.orgId, type: req.query.type, isGroup: req.query.isGroup, parentId: req.query.parentId });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/accounts', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const account = await accountingService.createAccount({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(account);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/accounts/:id', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const account = await accountingService.updateAccount({ orgId: req.user.orgId, accountId: req.params.id, data: req.body, adminId: req.user.id, req });
    res.json(account);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/accounts/:id', requirePermission('accounting.manage'), async (req, res) => {
  try {
    await accountingService.deleteAccount({ orgId: req.user.orgId, accountId: req.params.id, adminId: req.user.id, req });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/accounts/seed-defaults', requirePermission('accounting.manage'), async (req, res) => {
  try {
    await accountingService.seedDefaultAccounts(req.user.orgId);
    res.json({ success: true, message: 'Default chart of accounts seeded' });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/journals', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.listJournalEntries({
      orgId: req.user.orgId, fiscalYearId: req.query.fiscalYearId,
      voucherType: req.query.voucherType, status: req.query.status,
      startDate: req.query.startDate, endDate: req.query.endDate, limit: req.query.limit,
    });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/journals', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const entry = await accountingService.createJournalEntry({ orgId: req.user.orgId, data: req.body, adminId: req.user.id, req });
    res.status(201).json(entry);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/journals/:id/post', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const entry = await accountingService.postJournalEntry({ orgId: req.user.orgId, entryId: req.params.id, adminId: req.user.id, req });
    res.json(entry);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/journals/:id/void', requirePermission('accounting.manage'), async (req, res) => {
  try {
    const entry = await accountingService.voidJournalEntry({ orgId: req.user.orgId, entryId: req.params.id, adminId: req.user.id, req });
    res.json(entry);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/ledger/:accountId', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.getLedger({
      orgId: req.user.orgId, accountId: req.params.accountId,
      fiscalYearId: req.query.fiscalYearId, startDate: req.query.startDate, endDate: req.query.endDate,
    });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/reports/trial-balance', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.getTrialBalance({ orgId: req.user.orgId, fiscalYearId: req.query.fiscalYearId });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/reports/profit-loss', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.getProfitAndLoss({ orgId: req.user.orgId, fiscalYearId: req.query.fiscalYearId });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/reports/balance-sheet', requirePermission('accounting.view'), async (req, res) => {
  try {
    const data = await accountingService.getBalanceSheet({ orgId: req.user.orgId, fiscalYearId: req.query.fiscalYearId });
    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
