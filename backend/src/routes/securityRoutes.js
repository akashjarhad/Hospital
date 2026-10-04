const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { listAnomalies, getAnomaly, updateAnomaly, analyzeAnomalies, getAnalytics } = require('../controllers/securityAnomalyController');

router.use(verifyToken, requireRole(['HOSPITAL_ADMIN', 'SYSTEM_ADMIN']));
router.post('/anomalies/analyze', analyzeAnomalies);
router.get('/analytics', getAnalytics);
router.get('/anomalies', listAnomalies);
router.get('/anomalies/:id', getAnomaly);
router.put('/anomalies/:id', updateAnomaly);

module.exports = router;
