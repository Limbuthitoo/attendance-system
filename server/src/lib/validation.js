// ─────────────────────────────────────────────────────────────────────────────
// Centralized validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates password strength.
 * Requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  const failures = [];
  if (password.length < 8) failures.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) failures.push('one uppercase letter');
  if (!/[a-z]/.test(password)) failures.push('one lowercase letter');
  if (!/[0-9]/.test(password)) failures.push('one digit');
  if (!/[^A-Za-z0-9]/.test(password)) failures.push('one special character (!@#$%^&*)');

  if (failures.length > 0) {
    return {
      valid: false,
      error: `Password must contain: ${failures.join(', ')}`,
      requirements: failures,
    };
  }
  return { valid: true, error: null };
}

/**
 * Validate required fields in a request body.
 * Returns null if valid, or an error message string.
 */
function validateRequired(body, fields) {
  const missing = fields.filter((f) => {
    const val = body[f];
    return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
  });
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Sanitize a slug (lowercase, alphanumeric + hyphens only)
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { validatePassword, validateRequired, validateEmail, slugify };
