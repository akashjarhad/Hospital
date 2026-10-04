const express = require('express');
const router = express.Router();
const {
  createTransfer,
  getTransfers,
  getTransferById,
  getTransferData,
  sendTransfer,
  receiveTransfer,
  exportFHIRBundle
} = require('../controllers/transferController');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  generateHandover, getHandover, updateHandover, approveHandover,
  generateRelevance, getRelevance, updateRelevance,
  generateCriticalInformation, getCriticalInformation, updateCriticalInformation,
  calculateComplexity, getComplexity
} = require('../controllers/aiController');

router.post('/', verifyToken, requireRole(['DOCTOR']), createTransfer);
router.get('/', verifyToken, getTransfers);
router.post('/:id/ai/handover', verifyToken, requireRole(['DOCTOR']), generateHandover);
router.get('/:id/ai/handover', verifyToken, requireRole(['DOCTOR', 'PATIENT']), getHandover);
router.put('/:id/ai/handover', verifyToken, requireRole(['DOCTOR']), updateHandover);
router.post('/:id/ai/handover/approve', verifyToken, requireRole(['DOCTOR']), approveHandover);
router.post('/:id/ai/relevance', verifyToken, requireRole(['DOCTOR']), generateRelevance);
router.get('/:id/ai/relevance', verifyToken, requireRole(['DOCTOR']), getRelevance);
router.put('/:id/ai/relevance', verifyToken, requireRole(['DOCTOR']), updateRelevance);
router.post('/:id/ai/critical-information', verifyToken, requireRole(['DOCTOR']), generateCriticalInformation);
router.get('/:id/ai/critical-information', verifyToken, requireRole(['DOCTOR']), getCriticalInformation);
router.put('/:id/ai/critical-information', verifyToken, requireRole(['DOCTOR']), updateCriticalInformation);
router.post('/:id/ai/complexity', verifyToken, requireRole(['DOCTOR']), calculateComplexity);
router.get('/:id/ai/complexity', verifyToken, requireRole(['DOCTOR']), getComplexity);
router.get('/:id/data', verifyToken, requireRole(['DOCTOR']), getTransferData);
router.post('/:id/send', verifyToken, requireRole(['DOCTOR']), sendTransfer);
router.post('/:id/receive', verifyToken, requireRole(['DOCTOR']), receiveTransfer);
router.get('/:id/fhir', verifyToken, requireRole(['DOCTOR']), exportFHIRBundle);
router.get('/:id', verifyToken, getTransferById);

module.exports = router;
