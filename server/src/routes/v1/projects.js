// ─────────────────────────────────────────────────────────────────────────────
// Project Routes
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { requirePermission } = require('../../middleware/auth');
const projectService = require('../../services/project.service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const projects = await projectService.listProjects({ orgId: req.orgId, status: req.query.status, managerId: req.query.managerId });
    res.json({ projects });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProject({ orgId: req.orgId, id: req.params.id });
    res.json({ project });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/', requirePermission('project.manage'), async (req, res) => {
  try {
    const project = await projectService.createProject({ orgId: req.orgId, data: req.body, userId: req.user.id });
    res.status(201).json({ project });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.put('/:id', requirePermission('project.manage'), async (req, res) => {
  try {
    const project = await projectService.updateProject({ orgId: req.orgId, id: req.params.id, data: req.body });
    res.json({ project });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/:id', requirePermission('project.manage'), async (req, res) => {
  try {
    await projectService.deleteProject({ orgId: req.orgId, id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ── Members ──────────────────────────────────────────────────────────────────

router.post('/:id/members', requirePermission('project.manage'), async (req, res) => {
  try {
    const member = await projectService.addMember({ orgId: req.orgId, projectId: req.params.id, data: req.body });
    res.status(201).json({ member });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.delete('/:id/members/:memberId', requirePermission('project.manage'), async (req, res) => {
  try {
    await projectService.removeMember({ orgId: req.orgId, projectId: req.params.id, memberId: req.params.memberId });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

module.exports = router;
