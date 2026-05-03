// ─────────────────────────────────────────────────────────────────────────────
// Backward Compatibility Helpers
// Converts Prisma camelCase responses to snake_case for old web/mobile clients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a camelCase string to snake_case
 */
function toSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively add snake_case aliases for all camelCase keys in an object.
 * Does NOT remove camelCase keys — both formats are available.
 * Handles arrays and nested objects.
 */
function addSnakeCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(addSnakeCase);
  if (typeof obj !== 'object') return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const transformed = addSnakeCase(value);
    result[key] = transformed;
    const snakeKey = toSnake(key);
    if (snakeKey !== key) {
      result[snakeKey] = transformed;
    }
  }
  return result;
}

/**
 * Accept both snake_case and camelCase in request body.
 * Converts snake_case keys to camelCase.
 */
function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeToCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeToCamelCase);
  if (typeof obj !== 'object') return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamel(key)] = normalizeToCamelCase(value);
  }
  return result;
}

/**
 * Lowercase enum values for backward compatibility.
 * Maps PRESENT → present, HALF_DAY → half-day, etc.
 */
const ENUM_MAP = {
  PRESENT: 'present', LATE: 'late', HALF_DAY: 'half-day', ABSENT: 'absent',
  PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled',
  SICK: 'sick', CASUAL: 'casual', EARNED: 'earned', UNPAID: 'unpaid', OTHER: 'other',
  GENERAL: 'general', OFFICIAL: 'official', EVENT: 'event', URGENT: 'urgent',
};

function lowercaseEnum(val) {
  return ENUM_MAP[val] || val;
}

/**
 * Transform a Prisma response for backward compatibility:
 * - Add snake_case key aliases
 * - Lowercase enum values for known fields
 */
function compatTransform(obj, enumFields = []) {
  if (!obj) return obj;
  const result = addSnakeCase(obj);
  for (const field of enumFields) {
    if (result[field]) result[field] = lowercaseEnum(result[field]);
    const snake = toSnake(field);
    if (result[snake]) result[snake] = lowercaseEnum(result[snake]);
  }
  return result;
}

module.exports = {
  toSnake,
  addSnakeCase,
  normalizeToCamelCase,
  lowercaseEnum,
  compatTransform,
  ENUM_MAP,
};
