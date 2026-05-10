// ─────────────────────────────────────────────────────────────────────────────
// Platform Settings Routes — Global platform configuration (backup, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// GET /api/platform/settings — Get all platform settings
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const settings = await prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });

    const map = {};
    settings.forEach(s => { map[s.key] = { value: s.value, label: s.label }; });

    res.json({ settings: map, raw: settings });
  } catch (err) { next(err); }
});

// GET /api/platform/settings/backup — Get backup-specific settings
router.get('/backup', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const settings = await prisma.platformSetting.findMany({
      where: { key: { startsWith: 'backup_' } },
    });

    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, backupRetentionDays: true },
      orderBy: { sortOrder: 'asc' },
    });

    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });

    res.json({
      globalRetentionDays: parseInt(map.backup_retention_days || '30', 10),
      frequency: map.backup_frequency || 'daily',
      enabled: map.backup_enabled !== 'false',
      plans,
    });
  } catch (err) { next(err); }
});

// PUT /api/platform/settings/backup — Update backup settings
router.put('/backup', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { globalRetentionDays, frequency, enabled } = req.body;

    if (globalRetentionDays !== undefined) {
      const days = parseInt(globalRetentionDays, 10);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: 'globalRetentionDays must be between 1 and 365' });
      }
      await prisma.platformSetting.upsert({
        where: { key: 'backup_retention_days' },
        create: { key: 'backup_retention_days', value: String(days), label: 'Global Backup Retention (days)' },
        update: { value: String(days) },
      });
    }

    if (frequency !== undefined) {
      if (!['daily', 'hourly', '6h', '12h'].includes(frequency)) {
        return res.status(400).json({ error: 'frequency must be daily, hourly, 6h, or 12h' });
      }
      await prisma.platformSetting.upsert({
        where: { key: 'backup_frequency' },
        create: { key: 'backup_frequency', value: frequency, label: 'Backup Frequency' },
        update: { value: frequency },
      });
    }

    if (enabled !== undefined) {
      await prisma.platformSetting.upsert({
        where: { key: 'backup_enabled' },
        create: { key: 'backup_enabled', value: String(!!enabled), label: 'Automated Backups Enabled' },
        update: { value: String(!!enabled) },
      });
    }

    res.json({ message: 'Backup settings updated' });
  } catch (err) { next(err); }
});

// PUT /api/platform/settings/backup/plan/:planId — Update per-plan retention
router.put('/backup/plan/:planId', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { planId } = req.params;
    const { retentionDays } = req.body;

    const days = parseInt(retentionDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'retentionDays must be between 1 and 365' });
    }

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: { backupRetentionDays: days },
    });

    res.json({ message: `${plan.name} retention updated to ${days} days`, plan });
  } catch (err) { next(err); }
});

// PUT /api/platform/settings — Update arbitrary setting
router.put('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { key, value, label } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key is required' });
    }
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value is required' });
    }

    await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: String(value), label: label || null },
      update: { value: String(value), ...(label ? { label } : {}) },
    });

    res.json({ message: `Setting "${key}" updated` });
  } catch (err) { next(err); }
});

module.exports = router;
