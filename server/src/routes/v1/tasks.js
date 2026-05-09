// ─────────────────────────────────────────────────────────────────────────────
// Task Routes
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tasks = await taskService.listTasks({ orgId: req.orgId, ...req.query });
    res.json({ tasks });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/my', async (req, res) => {
  try {
    const tasks = await taskService.getMyTasks({ orgId: req.orgId, userId: req.user.id, status: req.query.status });
    res.json({ tasks });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const task = await taskService.getTask({ orgId: req.orgId, id: req.params.id });
    res.json({ task });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/', requirePermission('task.manage'), async (req, res) => {
  try {
    const task = await taskService.createTask({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ task });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/:id', requirePermission('task.manage'), async (req, res) => {
  try {
    const task = await taskService.updateTask({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ task });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/:id', requirePermission('task.manage'), async (req, res) => {
  try {
    await taskService.deleteTask({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
