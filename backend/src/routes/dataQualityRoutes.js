const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { updateDataQualityIssue } = require('../controllers/aiController');

router.put('/:id', verifyToken, requireRole(['DOCTOR']), updateDataQualityIssue);

module.exports = router;
