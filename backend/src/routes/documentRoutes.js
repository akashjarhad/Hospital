const express = require('express');
const router = express.Router();
const { getPatientDocuments, downloadDocument, uploadDocument } = require('../controllers/documentController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/patient/:patientId', verifyToken, getPatientDocuments);
router.get('/:id/download', verifyToken, downloadDocument);
router.post('/upload', verifyToken, requireRole(['DOCTOR']), uploadDocument);

module.exports = router;
