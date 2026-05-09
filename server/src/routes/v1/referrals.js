// ─────────────────────────────────────────────────────────────────────────────
// Referral Routes
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const referralService = require('../../services/referral.service');

const router = Router();

router.get('/', requirePermission('referral.manage'), async (req, res) => {
  try {
    const referrals = await referralService.listReferrals({ orgId: req.orgId, status: req.query.status, referrerId: req.query.referrerId });
    res.json({ referrals });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/my', async (req, res) => {
  try {
    const referrals = await referralService.getMyReferrals({ orgId: req.orgId, userId: req.user.id });
    res.json({ referrals });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const referral = await referralService.createReferral({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ referral });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/:id', requirePermission('referral.manage'), async (req, res) => {
  try {
    const referral = await referralService.updateReferral({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ referral });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/:id', requirePermission('referral.manage'), async (req, res) => {
  try {
    await referralService.deleteReferral({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
