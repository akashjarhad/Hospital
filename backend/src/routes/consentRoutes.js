const express = require('express');
const router = express.Router();
const {
  getMyConsents,
  getConsentById,
  approveConsent,
  rejectConsent,
  revokeConsent
} = require('../controllers/consentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/my-consents', verifyToken, requireRole(['PATIENT']), getMyConsents);
router.get('/:id', verifyToken, getConsentById);
router.post('/:id/approve', verifyToken, requireRole(['PATIENT']), approveConsent);
router.post('/:id/reject', verifyToken, requireRole(['PATIENT']), rejectConsent);
router.post('/:id/revoke', verifyToken, requireRole(['PATIENT']), revokeConsent);

module.exports = router;
