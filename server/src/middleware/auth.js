const jwt = require('jsonwebtoken');
const { getDB } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  // Support token via query param for SSE (EventSource can't send headers)
  const queryToken = req.query.token;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT id, employee_id, name, email, role, department, designation, must_change_password FROM employees WHERE id = ? AND is_active = 1').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
