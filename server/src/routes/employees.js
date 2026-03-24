const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all employees (admin)
router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDB();
  const employees = db.prepare(
    'SELECT id, employee_id, name, email, department, designation, role, phone, is_active, created_at FROM employees ORDER BY name ASC'
  ).all();
  res.json({ employees });
});

// Create employee (admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, email, password, department, designation, role, phone, employee_id } = req.body;

  if (!name || !email || !password || !employee_id) {
    return res.status(400).json({ error: 'Name, email, employee ID, and password are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDB();

  const existing = db.prepare('SELECT id FROM employees WHERE email = ? OR employee_id = ?').get(email, employee_id);
  if (existing) {
    return res.status(400).json({ error: 'Employee with this email or ID already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db.prepare(
    'INSERT INTO employees (employee_id, name, email, password, department, designation, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(employee_id, name, email, hashedPassword, department || 'General', designation || 'Employee', role || 'employee', phone || null);

  const employee = db.prepare(
    'SELECT id, employee_id, name, email, department, designation, role, phone, is_active, created_at FROM employees WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ message: 'Employee created', employee });
});

// Update employee (admin)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, email, department, designation, role, phone, is_active } = req.body;

  const db = getDB();
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  db.prepare(`
    UPDATE employees SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      department = COALESCE(?, department),
      designation = COALESCE(?, designation),
      role = COALESCE(?, role),
      phone = COALESCE(?, phone),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, email, department, designation, role, phone, is_active, req.params.id);

  const updated = db.prepare(
    'SELECT id, employee_id, name, email, department, designation, role, phone, is_active, created_at FROM employees WHERE id = ?'
  ).get(req.params.id);

  res.json({ message: 'Employee updated', employee: updated });
});

// Reset password (admin)
router.put('/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const db = getDB();
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE employees SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashedPassword, req.params.id);

  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
