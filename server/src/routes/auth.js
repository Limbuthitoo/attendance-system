const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validatePassword } = require('../validation');
const { registerToken, removeToken } = require('../push');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRY || '2h';
const REFRESH_TOKEN_EXPIRY = '7d';

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

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  res.json({
    token,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
    user: {
      id: user.id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      phone: user.phone,
      avatar: user.avatar,
      must_change_password: !!user.must_change_password
    }
  });
});

// Refresh access token using refresh token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const db = getDB();
    const user = db.prepare('SELECT id, role FROM employees WHERE id = ? AND is_active = 1').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = jwt.sign({ id: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    res.json({ token, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_EXPIRY });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  res.json({ user: { ...req.user, must_change_password: !!req.user.must_change_password } });
});

// Change password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE employees SET password = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?").run(hashedPassword, req.user.id);

  res.json({ message: 'Password changed successfully' });
});

// Register push notification token
router.post('/push-token', authenticate, (req, res) => {
  const { token, device_name } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  registerToken(req.user.id, token, device_name);
  res.json({ message: 'Push token registered' });
});

// Remove push token (logout)
router.delete('/push-token', authenticate, (req, res) => {
  const { token } = req.body;
  if (token) {
    removeToken(req.user.id, token);
  }
  res.json({ message: 'Push token removed' });
});

module.exports = router;
