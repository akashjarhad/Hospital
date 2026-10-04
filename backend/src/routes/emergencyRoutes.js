const express = require('express');
const router = express.Router();
const { requestEmergencyAccess, getEmergencyAccessLogs } = require('../controllers/emergencyController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.post('/request', verifyToken, requireRole(['DOCTOR']), requestEmergencyAccess);
router.get('/', verifyToken, requireRole(['DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN']), getEmergencyAccessLogs);

module.exports = router;
