const express = require('express');
const router = express.Router();
const { getAllHospitals, getHospitalById, createHospital } = require('../controllers/hospitalController');
const { verifyToken } = require('../middleware/auth');

// Public route to list hospitals (useful for directory & initial login dropdown)
router.get('/', getAllHospitals);

// Create hospital facility
router.post('/', createHospital);

// Hospital details
router.get('/:id', verifyToken, getHospitalById);

module.exports = router;
