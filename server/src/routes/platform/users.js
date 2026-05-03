// ─────────────────────────────────────────────────────────────────────────────
// Platform Users Routes — Manage platform admin/support accounts
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../../lib/prisma');
const { requireSuperAdmin } = require('../../middleware/platformAuth');

const SALT_ROUNDS = 12;

// GET /api/platform/users — list all platform users
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const users = await prisma.platformUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/users/:id — get single user
router.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const user = await prisma.platformUser.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/users — create platform user
router.post('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { email, name, password, role = 'PLATFORM_SUPPORT' } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['SUPER_ADMIN', 'PLATFORM_SUPPORT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await prisma.platformUser.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.platformUser.create({
      data: { email, name, password: hash, role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/users/:id — update platform user
router.put('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const { name, email, role, isActive, password } = req.body;

    const existing = await prisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    // Prevent deactivating yourself
    if (req.params.id === req.platformUser.id && isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Prevent demoting yourself
    if (req.params.id === req.platformUser.id && role && role !== existing.role) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      const dup = await prisma.platformUser.findUnique({ where: { email } });
      if (dup && dup.id !== req.params.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updateData.email = email;
    }
    if (role && ['SUPER_ADMIN', 'PLATFORM_SUPPORT'].includes(role)) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const user = await prisma.platformUser.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/platform/users/:id — delete platform user
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const prisma = getPrisma();

    if (req.params.id === req.platformUser.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const existing = await prisma.platformUser.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await prisma.platformUser.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
