const express = require('express');
const router = express.Router();
const {
  getPatients,
  getMyRecord,
  getPatientById,
  createPatient,
  searchPatientsForDoctor,
  requestDoctorPatientAssociation,
  getMyDoctors,
  getMyAssociationRequests,
  respondAssociationRequest,
  revokeDoctorAssociation,
  addMedicalRecord
} = require('../controllers/patientController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { searchPatientRecord, getSearchHistory, checkDataQuality, getDataQuality } = require('../controllers/aiController');

// Patient self-service routes
router.get('/my-record', verifyToken, requireRole(['PATIENT']), getMyRecord);
router.get('/my-doctors', verifyToken, requireRole(['PATIENT']), getMyDoctors);
router.get('/my-association-requests', verifyToken, requireRole(['PATIENT']), getMyAssociationRequests);
router.post('/association-requests/:id/respond', verifyToken, requireRole(['PATIENT']), respondAssociationRequest);
router.post('/my-doctors/:id/revoke', verifyToken, requireRole(['PATIENT']), revokeDoctorAssociation);

// Doctor patient relationship routes
router.get('/doctor/search', verifyToken, requireRole(['DOCTOR']), searchPatientsForDoctor);
router.post('/doctor/request-association', verifyToken, requireRole(['DOCTOR']), requestDoctorPatientAssociation);
router.post('/:id/medical-records', verifyToken, requireRole(['DOCTOR']), addMedicalRecord);

// AI & Quality routes
router.post('/:id/ai/search', verifyToken, requireRole(['DOCTOR', 'PATIENT']), searchPatientRecord);
router.get('/:id/ai/search/history', verifyToken, requireRole(['DOCTOR', 'PATIENT']), getSearchHistory);
router.post('/:id/data-quality/check', verifyToken, requireRole(['DOCTOR', 'PATIENT']), checkDataQuality);
router.get('/:id/data-quality', verifyToken, requireRole(['DOCTOR', 'PATIENT']), getDataQuality);

// Core patient CRUD & roster routes
router.get('/', verifyToken, getPatients);
router.post('/', verifyToken, requireRole(['DOCTOR']), createPatient);
router.get('/:id', verifyToken, getPatientById);

module.exports = router;
