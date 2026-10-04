const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { listRuns, createRun, addEntry, getSummary, exportCsv } = require('../controllers/researchController');

router.use(verifyToken, requireRole(['HOSPITAL_ADMIN', 'SYSTEM_ADMIN']));
router.get('/runs', listRuns);
router.post('/runs', createRun);
router.post('/runs/:id/entries', addEntry);
router.get('/runs/:id/summary', getSummary);
router.get('/runs/:id/export.csv', exportCsv);

module.exports = router;
