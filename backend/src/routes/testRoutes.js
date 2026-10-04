const express = require('express');
const router = express.Router();
const { addTest, checkDuplicateTest } = require('../controllers/testController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole(['DOCTOR']));

// POST /api/tests -> Record diagnostic test result
router.post('/', addTest);

// POST /api/tests/check-duplicate -> Rule-based 24h duplicate test checker
router.post('/check-duplicate', checkDuplicateTest);

module.exports = router;
