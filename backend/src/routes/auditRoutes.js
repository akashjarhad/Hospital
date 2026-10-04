const express = require('express');
const router = express.Router();
const { getAuditLogs, getSecurityAnalytics, getPatientAccessHistory } = require('../controllers/auditController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, requireRole(['HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'DOCTOR']), getAuditLogs);
router.get('/security-analytics', verifyToken, requireRole(['HOSPITAL_ADMIN', 'SYSTEM_ADMIN']), getSecurityAnalytics);
router.get('/patient/:patientId', verifyToken, getPatientAccessHistory);

module.exports = router;
