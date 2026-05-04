// ─────────────────────────────────────────────────────────────────────────────
// CSRF Protection — Double-submit cookie pattern
// Only enforced for state-changing requests using cookie-based auth.
// Requests with Bearer token (mobile/API) are exempt.
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');
const config = require('../config');

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Middleware: Set CSRF token cookie on every response if not already present.
 * The cookie is NOT HttpOnly so JavaScript can read it.
 */
function csrfSetToken(req, res, next) {
  if (!req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: config.isProd,
      sameSite: config.isProd ? 'strict' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  next();
}

/**
 * Middleware: Validate CSRF token on state-changing requests (POST, PUT, PATCH, DELETE).
 * Skipped if request uses Bearer authentication (non-browser clients).
 */
function csrfValidate(req, res, next) {
  // Safe methods don't need CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for Bearer token auth (mobile apps / API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Only enforce if using cookie-based auth
  const hasCookieAuth = req.cookies?.access_token ||
    req.cookies?.platform_access_token;
  if (!hasCookieAuth) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  next();
}

module.exports = { csrfSetToken, csrfValidate };
