const express = require('express');
const router = express.Router();
const { createVisit, updateVisitStatus } = require('../controllers/visitController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken, requireRole(['DOCTOR']));

// POST /api/visits -> Create new visit
router.post('/', createVisit);

// PATCH /api/visits/:id/status -> Update visit clinical status
router.patch('/:id/status', updateVisitStatus);

module.exports = router;
