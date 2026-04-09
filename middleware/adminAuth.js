const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || String(s).length < 16) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Set JWT_SECRET to a long random value in production.');
      process.exit(1);
    }
  }
  return s || 'dev-only-insecure-jwt-secret';
}

function isAdminTokenPayload(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  return decoded.typ === 'admin' || decoded.role === 'admin';
}

/**
 * Password gate → issues { typ: 'admin', v: 1 } (no user id).
 */
function signAdminPanelToken() {
  return jwt.sign(
    { typ: 'admin', v: 1 },
    getJwtSecret(),
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' }
  );
}

function secureComparePassword(input, configuredPassword) {
  if (typeof input !== 'string' || !configuredPassword) return false;
  const a = crypto.createHash('sha256').update(input, 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(configuredPassword), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Admin panel JWT or User model role admin (from /api/auth/login).
 */
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Admin authentication required' });
  }

  jwt.verify(token, getJwtSecret(), (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired admin session. Please log in again.'
      });
    }
    if (!isAdminTokenPayload(decoded)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.auth = {
      admin: true,
      userId: decoded.id || null,
      panel: decoded.typ === 'admin'
    };
    next();
  });
}

/**
 * Invoice PDF: admins may download any invoice; customers use customer JWT.
 */
function requireAdminOrCustomer(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, getJwtSecret(), (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }
    if (isAdminTokenPayload(decoded)) {
      req.auth = {
        admin: true,
        userId: decoded.id || null,
        panel: decoded.typ === 'admin'
      };
      req.user = { id: decoded.id, email: decoded.email, role: 'admin' };
      return next();
    }
    if (decoded.id && decoded.role === 'customer') {
      req.user = decoded;
      req.auth = { customer: true, userId: decoded.id };
      return next();
    }
    return res.status(403).json({ success: false, message: 'Access denied' });
  });
}

module.exports = {
  getJwtSecret,
  signAdminPanelToken,
  secureComparePassword,
  requireAdmin,
  requireAdminOrCustomer,
  isAdminTokenPayload
};
