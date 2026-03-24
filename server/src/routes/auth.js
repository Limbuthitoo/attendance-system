const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'archisys-default-secret';

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM employees WHERE email = ? AND is_active = 1').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      phone: user.phone,
      avatar: user.avatar
    }
  });
});

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE employees SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashedPassword, req.user.id);

  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
