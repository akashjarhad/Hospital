const express = require('express');
const router = express.Router();
const { login, logout, getMe, register, registerPatient, registerDoctor } = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, getMe);
router.post('/register/patient', registerPatient);
router.post('/register/doctor', registerDoctor);
router.post('/register', verifyToken, requireRole(['HOSPITAL_ADMIN', 'SYSTEM_ADMIN']), register);

module.exports = router;

