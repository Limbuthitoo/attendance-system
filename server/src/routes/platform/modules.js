// ─────────────────────────────────────────────────────────────────────────────
// Platform Module Routes — List available modules
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require('express');
const { getPrisma } = require('../../lib/prisma');

const router = Router();

// GET /api/platform/modules — List all available modules
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const modules = await prisma.module.findMany({
      orderBy: { code: 'asc' },
    });
    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
