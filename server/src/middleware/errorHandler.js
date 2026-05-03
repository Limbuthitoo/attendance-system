// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler Middleware
// ─────────────────────────────────────────────────────────────────────────────
const config = require('../config');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Prisma-specific errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      error: `Duplicate value for ${field}`,
      code: 'CONFLICT',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Record not found',
      code: 'NOT_FOUND',
    });
  }

  // Known operational errors
  if (err instanceof AppError) {
    const response = { error: err.message, code: err.code };
    if (err.details) response.details = err.details;
    return res.status(err.statusCode).json(response);
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: config.isDev ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
};
