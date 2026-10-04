const express = require('express');
const router = express.Router();
const { getAllHospitals, getHospitalById } = require('../controllers/hospitalController');
const { verifyToken } = require('../middleware/auth');

// Public route to list hospitals (useful for directory & initial login dropdown)
router.get('/', getAllHospitals);

// Hospital details
router.get('/:id', verifyToken, getHospitalById);

module.exports = router;
