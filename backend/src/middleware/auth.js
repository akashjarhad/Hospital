const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'medtransfer_jwt_academic_secret_key_2026_btech';

/**
 * Middleware: Verify JWT Authentication Token
 * Decodes user identity, role, and hospital association.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: No authorization token provided.'
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Standardize role to UPPERCASE for consistency
    if (decoded.role) {
      decoded.role = decoded.role.toUpperCase();
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authorization token.'
    });
  }
};

/**
 * Middleware: Role-based Access Control
 * @param {string[]} allowedRoles - Array of permitted roles (e.g. ['DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'PATIENT'])
 */
const requireRole = (allowedRoles = []) => {
  const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Action requires authorized role [${allowedRoles.join(', ')}]. Current role: ${userRole}`
      });
    }

    next();
  };
};

/**
 * Middleware: Enforce Hospital Scope
 * Ensures that hospital staff can only view/mutate data scoped to their affiliated hospital.
 * System Admins can bypass this check.
 */
const requireHospitalScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (req.user.role === 'SYSTEM_ADMIN') {
    return next();
  }

  if (!req.user.hospital_id && req.user.role !== 'PATIENT') {
    return res.status(403).json({ success: false, message: 'Hospital affiliation required.' });
  }

  const targetHospitalId = parseInt(req.params.hospitalId || req.query.hospital_id || req.body.hospital_id, 10);

  if (targetHospitalId && req.user.hospital_id && targetHospitalId !== req.user.hospital_id) {
    return res.status(403).json({
      success: false,
      message: `Access Denied: You are authenticated with Hospital #${req.user.hospital_id} and cannot access Hospital #${targetHospitalId}.`
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireRole,
  requireHospitalScope,
  JWT_SECRET
};
