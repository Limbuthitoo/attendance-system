// Centralized validation helpers

/**
 * Validates password strength.
 * Requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character.
 * Returns { valid: boolean, error: string|null, requirements: string[] }
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

module.exports = { validatePassword };
