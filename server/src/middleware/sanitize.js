// ─────────────────────────────────────────────────────────────────────────────
// XSS Sanitization Middleware — Strips malicious HTML/JS from all string inputs
// ─────────────────────────────────────────────────────────────────────────────
const xss = require('xss');

const xssOptions = {
  whiteList: {},          // No HTML tags allowed
  stripIgnoreTag: true,   // Strip all non-whitelisted tags
  stripIgnoreTagBody: ['script', 'style'],
};

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * to prevent stored/reflected XSS attacks.
 */
function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

module.exports = sanitizeInput;
