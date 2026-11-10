const { query } = require('../config/db');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { authorizePatientAccess } = require('../services/clinicalAccessPolicy');
const { loadPatientAggregate, projectByCategories, ALL_CATEGORY_LABELS } = require('../services/patientAggregateService');
const { boundedText, enumValue, ValidationError, positiveInt } = require('../utils/validation');

const generateUniqueHealthId = () => `ABHA-${[1, 2, 3].map(() => Math.floor(1000 + Math.random() * 9000)).join('-')}`;
const filterPatientDataByCategories = (patient, allowedCategories = []) => projectByCategories(patient, allowedCategories);

function safeError(res, error, fallback) {
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

/**
 * GET /api/patients
 * Retrieves patient roster scoped strictly by authenticated role and relationships
 */
const getPatients = async (req, res) => {
  try {
    // 1. Patient Role: returns own patient profile
    if (req.user.role === 'PATIENT') {
      const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
      return res.json({
        success: true,
        hospital_id: null,
        total: patient ? 1 : 0,
        data: patient ? [{ id: patient.id, unique_health_id: patient.unique_health_id, name: patient.name }] : []
      });
    }

    // 2. Doctor Role: returns only patients actively taking treatment under this doctor
    if (req.user.role === 'DOCTOR') {
      // Query doctor_patients for active/accepted associations
      const assocRes = await query(
        `SELECT dp.*, p.unique_health_id, p.name, p.dob, p.gender, p.blood_group, p.phone, p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.created_at, h.name as hospital_name, h.code as hospital_code
         FROM doctor_patients dp
         JOIN patients p ON dp.patient_id = p.id
         LEFT JOIN hospitals h ON dp.hospital_id = h.id
         WHERE dp.doctor_id = $1 AND dp.status IN ('ACTIVE', 'ACCEPTED')
         ORDER BY dp.updated_at DESC, dp.created_at DESC`,
        [req.user.id]
      );

      let doctorRoster = assocRes.rows.map(row => ({
        id: row.patient_id || row.id,
        patient_id: row.patient_id || row.id,
        association_id: row.id,
        unique_health_id: row.unique_health_id,
        name: row.name || row.patient_name,
        dob: row.dob,
        gender: row.gender,
        blood_group: row.blood_group,
        phone: row.phone,
        emergency_contact_name: row.emergency_contact_name,
        emergency_contact_phone: row.emergency_contact_phone,
        medical_history: row.medical_history,
        allergies: row.allergies,
        created_at: row.created_at,
        treatment_reason: row.treatment_reason,
        department: row.department,
        treatment_start_date: row.treatment_start_date,
        association_status: row.status,
        latest_visit: row.latest_visit || {
          diagnosis: row.treatment_reason || 'Active Clinical Care',
          status: 'admitted',
          admission_date: row.treatment_start_date || row.created_at,
          attending_doctor_name: req.user.name
        }
      }));

      // Fallback/Union for local hospital encounters where this doctor is recorded attending doctor
      if (req.user.hospital_id) {
        const localVisits = (await query(
          `SELECT DISTINCT ON (p.id) p.id, p.unique_health_id, p.name, p.dob, p.gender, p.blood_group, p.phone, p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.created_at, v.id as visit_id, v.diagnosis, v.status as visit_status, v.admission_date, v.chief_complaint, v.clinical_notes, v.vitals, u.name as attending_doctor_name
           FROM patients p
           JOIN visits v ON p.id = v.patient_id
           LEFT JOIN users u ON v.attending_doctor_id = u.id
           WHERE v.hospital_id = $1 AND v.attending_doctor_id = $2
           ORDER BY p.id, v.admission_date DESC`,
          [req.user.hospital_id, req.user.id]
        )).rows;

        const existingIds = new Set(doctorRoster.map(p => p.id));
        for (const lv of localVisits) {
          if (!existingIds.has(lv.id)) {
            doctorRoster.push({
              id: lv.id,
              patient_id: lv.id,
              unique_health_id: lv.unique_health_id,
              name: lv.name,
              dob: lv.dob,
              gender: lv.gender,
              blood_group: lv.blood_group,
              phone: lv.phone,
              emergency_contact_name: lv.emergency_contact_name,
              emergency_contact_phone: lv.emergency_contact_phone,
              medical_history: lv.medical_history,
              allergies: lv.allergies,
              created_at: lv.created_at,
              treatment_reason: lv.diagnosis,
              department: req.user.specialty || 'General Care',
              treatment_start_date: lv.admission_date,
              association_status: 'ACTIVE',
              latest_visit: lv
            });
          }
        }
      }

      return res.json({
        success: true,
        doctor_id: req.user.id,
        hospital_id: req.user.hospital_id,
        total: doctorRoster.length,
        data: doctorRoster
      });
    }

    // 3. Hospital Admin / System Admin: returns hospital-wide patient roster
    if (!req.user.hospital_id && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ success: false, message: 'Hospital clinical or administrative affiliation required.' });
    }

    const hospitalParam = req.user.hospital_id || 1;
    const rows = (await query(
      `SELECT DISTINCT ON (p.id) p.id, p.unique_health_id, p.name, p.dob, p.gender, p.blood_group, p.phone, p.emergency_contact_name, p.emergency_contact_phone, p.medical_history, p.allergies, p.created_at, v.id as visit_id, v.diagnosis, v.status as visit_status, v.admission_date, v.chief_complaint, v.clinical_notes, v.vitals, u.name as attending_doctor_name
       FROM patients p
       JOIN visits v ON p.id = v.patient_id
       LEFT JOIN users u ON v.attending_doctor_id = u.id
       WHERE v.hospital_id = $1
       ORDER BY p.id, v.admission_date DESC`,
      [hospitalParam]
    )).rows;

    const data = req.user.role === 'HOSPITAL_ADMIN'
      ? rows.map(row => ({
          id: row.id,
          unique_health_id: row.unique_health_id,
          name: row.name,
          visit_id: row.visit_id || row.latest_visit?.id,
          visit_status: row.visit_status || row.latest_visit?.status,
          admission_date: row.admission_date || row.latest_visit?.admission_date,
          attending_doctor_name: row.attending_doctor_name || row.latest_visit?.attending_doctor_name
        }))
      : rows;

    return res.json({ success: true, hospital_id: req.user.hospital_id, total: data.length, data });
  } catch (error) {
    return safeError(res, error, 'Failed to retrieve patient roster.');
  }
};

/**
 * GET /api/patients/doctor/search
 * Privacy-preserving search for registered patients to initiate treatment association
 */
const searchPatientsForDoctor = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters.'
      });
    }

    // Search the patient master index, attaching this doctor's most relevant association.
    // Association precedence: ACTIVE/ACCEPTED, then PENDING, then most recent of the rest.
    const searchSql = `
      SELECT * FROM (
        SELECT DISTINCT ON (p.id)
          p.id, p.name, p.unique_health_id, p.dob, p.gender, p.blood_group,
          dp.id AS association_id, dp.status AS association_status
        FROM patients p
        LEFT JOIN doctor_patients dp
          ON dp.patient_id = p.id AND dp.doctor_id = $2
        WHERE LOWER(p.name) LIKE $1
           OR LOWER(p.unique_health_id) LIKE $1
           OR COALESCE(p.phone, '') LIKE $1
        ORDER BY
          p.id,
          CASE
            WHEN dp.status IN ('ACTIVE', 'ACCEPTED') THEN 0
            WHEN dp.status = 'PENDING' THEN 1
            ELSE 2
          END,
          dp.created_at DESC NULLS LAST
      ) matches
      ORDER BY name
      LIMIT 50
    `;
    const searchRes = await query(searchSql, [`%${q}%`, req.user.id]);

    const results = (searchRes.rows || []).map(patient => {
      const existingAssoc = patient.association_id
        ? { id: patient.association_id, status: patient.association_status }
        : null;

      // Mask DOB for privacy, exposing only the day of month (e.g. ****-**-14).
      // pg returns DATE columns as Date objects, so derive the day explicitly
      // rather than string-splitting, which would otherwise leak the full date.
      let dobMasked = '****-**-**';
      if (patient.dob) {
        const dobDate = patient.dob instanceof Date ? patient.dob : new Date(patient.dob);
        if (!Number.isNaN(dobDate.getTime())) {
          dobMasked = `****-**-${String(dobDate.getDate()).padStart(2, '0')}`;
        }
      }

      const isAssociated = existingAssoc && ['ACTIVE', 'ACCEPTED'].includes(existingAssoc.status);
      const isPending = existingAssoc && existingAssoc.status === 'PENDING';

      return {
        id: patient.id,
        name: patient.name,
        unique_health_id: patient.unique_health_id,
        dob_masked: dobMasked,
        gender: patient.gender,
        blood_group: patient.blood_group,
        is_already_associated: Boolean(isAssociated),
        is_pending_request: Boolean(isPending),
        association_status: existingAssoc ? existingAssoc.status : 'NONE',
        association_id: existingAssoc ? existingAssoc.id : null
      };
    });

    await recordAuditLog({
      userId: req.user.id,
      role: 'DOCTOR',
      action: 'PATIENT_SEARCHED',
      purpose: 'Doctor Search for Registered Patient Association',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { search_term: q, result_count: results.length }
    });

    return res.json({
      success: true,
      query: q,
      total: results.length,
      data: results
    });
  } catch (error) {
    return safeError(res, error, 'Failed to search registered patients.');
  }
};

/**
 * POST /api/patients/doctor/request-association
 * Doctor sends a patient association request to begin treatment management
 */
const requestDoctorPatientAssociation = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    const department = boundedText(req.body.department || req.user.specialty || 'General Medicine', 'department', { max: 100 });
    const treatmentReason = boundedText(req.body.treatment_reason || req.body.purpose || 'Specialist Consultation & Treatment', 'treatment_reason', { max: 500 });

    const patientRes = await query('SELECT id, name, user_id FROM patients WHERE id = $1', [patientId]);
    const patient = patientRes.rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Registered patient not found.' });
    }

    // Check existing association, preferring any that would block a new request
    const existingRes = await query(
      `SELECT id, status
         FROM doctor_patients
        WHERE doctor_id = $1 AND patient_id = $2
        ORDER BY
          CASE
            WHEN status IN ('ACTIVE', 'ACCEPTED') THEN 0
            WHEN status = 'PENDING' THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT 1`,
      [req.user.id, patientId]
    );
    const existing = existingRes.rows[0];

    if (existing) {
      if (['ACTIVE', 'ACCEPTED'].includes(existing.status)) {
        return res.status(409).json({
          success: false,
          message: `Patient ${patient.name} is already under active treatment with you.`
        });
      }
      if (existing.status === 'PENDING') {
        return res.status(409).json({
          success: false,
          message: `An association request for ${patient.name} is already pending.`
        });
      }
      // If previously REJECTED or REVOKED, allow creating a new request
    }

    const hospitalId = req.user.hospital_id || 1;
    const hospitalRes = await query('SELECT name FROM hospitals WHERE id = $1', [hospitalId]);
    const hospitalName = hospitalRes.rows[0]?.name || 'Hospital';

    const insertSql = `
      INSERT INTO doctor_patients (doctor_id, patient_id, hospital_id, status, department, treatment_reason, treatment_start_date, requested_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await query(insertSql, [
      req.user.id,
      patientId,
      hospitalId,
      'PENDING',
      department,
      treatmentReason,
      new Date(),
      new Date()
    ]);
    const newAssoc = result.rows[0];

    // Send notification to patient if linked to a user account
    if (patient.user_id) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, related_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          patient.user_id,
          'Doctor Treatment Association Request',
          `Dr. ${req.user.name} from ${hospitalName} has requested to add you as a patient for ${department} treatment (${treatmentReason}).`,
          'DOCTOR_REQUEST',
          newAssoc.id
        ]
      );
    }

    await recordAuditLog({
      userId: req.user.id,
      role: 'DOCTOR',
      action: 'PATIENT_ASSOCIATION_REQUESTED',
      patientId,
      purpose: `Doctor initiated association request for ${department} care`,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: {
        association_id: newAssoc.id,
        department,
        treatment_reason: treatmentReason,
        patient_name: patient.name,
        unique_health_id: patient.unique_health_id
      }
    });

    return res.status(201).json({
      success: true,
      message: `Association request sent to ${patient.name}. Treatment access will be enabled once accepted by patient.`,
      data: newAssoc
    });
  } catch (error) {
    return safeError(res, error, 'Failed to send doctor-patient association request.');
  }
};

/**
 * GET /api/patients/my-doctors
 * Patient views all doctors & hospitals associated with their treatment
 */
const getMyDoctors = async (req, res) => {
  try {
    const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const rows = (await query(
      `SELECT dp.*, u.name as doctor_name, u.specialty as doctor_specialty, u.license_number, u.phone as doctor_phone, h.name as hospital_name, h.code as hospital_code, h.city as hospital_city
       FROM doctor_patients dp
       JOIN users u ON dp.doctor_id = u.id
       LEFT JOIN hospitals h ON dp.hospital_id = h.id
       WHERE dp.patient_id = $1
       ORDER BY dp.updated_at DESC, dp.created_at DESC`,
      [patient.id]
    )).rows;

    return res.json({
      success: true,
      patient_id: patient.id,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    return safeError(res, error, 'Failed to retrieve treating doctors list.');
  }
};

/**
 * GET /api/patients/my-association-requests
 * Patient views pending association requests from doctors
 */
const getMyAssociationRequests = async (req, res) => {
  try {
    const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const rows = (await query(
      `SELECT dp.*, u.name as doctor_name, u.specialty as doctor_specialty, h.name as hospital_name
       FROM doctor_patients dp
       JOIN users u ON dp.doctor_id = u.id
       LEFT JOIN hospitals h ON dp.hospital_id = h.id
       WHERE dp.patient_id = $1 AND dp.status = 'PENDING'
       ORDER BY dp.created_at DESC`,
      [patient.id]
    )).rows;

    return res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    return safeError(res, error, 'Failed to retrieve pending association requests.');
  }
};

/**
 * POST /api/patients/association-requests/:id/respond
 * Patient accepts or rejects a doctor association request
 */
const respondAssociationRequest = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const assocId = positiveInt(req.params.id, 'association_id');
    const action = enumValue(req.body.action, 'action', ['ACCEPT', 'REJECT']);

    const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const assocRes = await query('SELECT * FROM doctor_patients WHERE id = $1', [assocId]);
    if (!assocRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Association request not found.' });
    }

    const assoc = assocRes.rows[0];
    if (assoc.patient_id !== patient.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to respond to this request.' });
    }

    if (assoc.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `This request is already ${assoc.status.toLowerCase()}.` });
    }

    const newStatus = action === 'ACCEPT' ? 'ACTIVE' : 'REJECTED';
    const now = new Date();

    if (action === 'ACCEPT') {
      await query(
        `UPDATE doctor_patients SET status = $1, accepted_at = $2, updated_at = $3 WHERE id = $4`,
        ['ACTIVE', now, now, assocId]
      );
    } else {
      await query(
        `UPDATE doctor_patients SET status = $1, rejected_at = $2, updated_at = $3 WHERE id = $4`,
        ['REJECTED', now, now, assocId]
      );
    }

    // Send notification to requesting doctor
    await query(
      `INSERT INTO notifications (user_id, title, message, type, related_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        assoc.doctor_id,
        `Patient Association ${action === 'ACCEPT' ? 'Accepted' : 'Declined'}`,
        `Patient ${patient.name} has ${action === 'ACCEPT' ? 'accepted' : 'declined'} your treatment association request for ${assoc.department}.`,
        'ASSOCIATION_UPDATE',
        assocId
      ]
    );

    await recordAuditLog({
      userId: req.user.id,
      role: 'PATIENT',
      action: action === 'ACCEPT' ? 'PATIENT_ASSOCIATION_ACCEPTED' : 'PATIENT_ASSOCIATION_REJECTED',
      patientId: patient.id,
      purpose: `Patient responded with ${action} to doctor association request`,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { association_id: assocId, doctor_id: assoc.doctor_id, action }
    });

    return res.json({
      success: true,
      message: action === 'ACCEPT' ? 'Doctor association accepted successfully. Doctor now has clinical treatment access.' : 'Doctor association request rejected.',
      status: newStatus
    });
  } catch (error) {
    return safeError(res, error, 'Failed to respond to association request.');
  }
};

/**
 * POST /api/patients/my-doctors/:id/revoke
 * Patient revokes treatment association with a doctor
 */
const revokeDoctorAssociation = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const assocId = positiveInt(req.params.id, 'association_id');
    const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found.' });
    }

    const assocRes = await query('SELECT * FROM doctor_patients WHERE id = $1', [assocId]);
    if (!assocRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Association record not found.' });
    }

    const assoc = assocRes.rows[0];
    if (assoc.patient_id !== patient.id) {
      return res.status(403).json({ success: false, message: 'You may only revoke associations for your own profile.' });
    }

    await query(
      `UPDATE doctor_patients SET status = 'REVOKED', revoked_at = $1, updated_at = $2 WHERE id = $3 AND patient_id = $4`,
      [new Date(), new Date(), assocId, patient.id]
    );

    // Notify doctor
    await query(
      `INSERT INTO notifications (user_id, title, message, type, related_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        assoc.doctor_id,
        'Patient Treatment Association Revoked',
        `Patient ${patient.name} has revoked their treatment association for ${assoc.department}.`,
        'ASSOCIATION_UPDATE',
        assocId
      ]
    );

    await recordAuditLog({
      userId: req.user.id,
      role: 'PATIENT',
      action: 'PATIENT_ASSOCIATION_REVOKED',
      patientId: patient.id,
      purpose: 'Patient revoked active doctor treatment association',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { association_id: assocId, doctor_id: assoc.doctor_id }
    });

    return res.json({
      success: true,
      message: 'Doctor treatment association revoked successfully.'
    });
  } catch (error) {
    return safeError(res, error, 'Failed to revoke doctor association.');
  }
};

/**
 * GET /api/patients/my-record
 * Patient self-service medical dossier access
 */
const getMyRecord = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patient = (await query('SELECT * FROM patients WHERE user_id = $1', [req.user.id])).rows[0];
    if (!patient) return res.status(404).json({ success: false, message: 'No linked patient profile found for this account.' });
    const aggregate = await loadPatientAggregate(patient.id);
    const data = projectByCategories(aggregate, ALL_CATEGORY_LABELS);
    await recordAuditLog({ userId: req.user.id, role: 'PATIENT', action: 'PATIENT_PROFILE_VIEWED', patientId: patient.id, purpose: 'Patient self-service medical record access', result: 'SUCCESS', ipAddress, userAgent });
    return res.json({ success: true, data });
  } catch (error) {
    return safeError(res, error, 'Failed to retrieve personal medical record.');
  }
};

/**
 * GET /api/patients/:id
 * Authorized dossier retrieval
 */
const getPatientById = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = Number(req.params.id);
    if (!Number.isInteger(patientId) || patientId <= 0) return res.status(400).json({ success: false, message: 'Patient id must be a positive integer.' });
    const transferId = req.query.transfer_id ? Number(req.query.transfer_id) : null;
    const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
    const aggregate = await loadPatientAggregate(patientId, access.recordScope);
    if (!aggregate) return res.status(404).json({ success: false, message: 'Patient record not found.' });
    const data = projectByCategories(aggregate, access.categories);
    await recordAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: access.emergency ? 'EMERGENCY_ACCESS_USED' : (req.user.role === 'PATIENT' ? 'PATIENT_PROFILE_VIEWED' : 'MEDICAL_RECORD_VIEWED'),
      patientId,
      transferId,
      purpose: `Clinical dossier review (${access.accessMode})`,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { access_mode: access.accessMode, categories: data.permitted_categories, emergency_access_id: access.emergency?.id || null }
    });
    return res.json({ success: true, accessMode: access.accessMode, data });
  } catch (error) {
    return safeError(res, error, 'Failed to retrieve patient dossier.');
  }
};

/**
 * POST /api/patients/:id/medical-records
 * Authorized doctor adds a clinical encounter / medical record
 */
const addMedicalRecord = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = positiveInt(req.params.id, 'patient_id');
    const access = await authorizePatientAccess(req.user, patientId, { allowEmergency: true });
    
    const diagnosis = boundedText(req.body.diagnosis, 'diagnosis', { max: 2000 });
    const chiefComplaint = boundedText(req.body.chief_complaint || '', 'chief_complaint', { required: false, max: 2000 });
    const clinicalNotes = boundedText(req.body.clinical_notes || '', 'clinical_notes', { required: false, max: 5000 });
    const status = enumValue(req.body.status || 'ADMITTED', 'status', ['ADMITTED', 'CRITICAL', 'OBSERVATION', 'DISCHARGED', 'TRANSFERRED']).toLowerCase();
    const vitals = req.body.vitals && typeof req.body.vitals === 'object' ? req.body.vitals : {};

    const hospitalId = req.user.hospital_id || 1;
    const visitRes = await query(
      `INSERT INTO visits (patient_id, hospital_id, attending_doctor_id, diagnosis, status, chief_complaint, clinical_notes, vitals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [patientId, hospitalId, req.user.id, diagnosis, status, chiefComplaint, clinicalNotes, JSON.stringify(vitals)]
    );
    const newVisit = visitRes.rows[0];

    // Add optional test results
    const tests = Array.isArray(req.body.tests) ? req.body.tests.slice(0, 50) : [];
    const recordedTests = [];
    for (const test of tests) {
      if (!test.test_name || test.result === undefined) continue;
      recordedTests.push((await query(
        `INSERT INTO tests (visit_id, test_name, category, result, units, reference_range, abnormal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [newVisit.id, boundedText(test.test_name, 'test_name', { max: 255 }), boundedText(test.category || 'Laboratory', 'category', { max: 100 }), boundedText(test.result, 'result', { max: 2000 }), test.units || '', test.reference_range || '', Boolean(test.abnormal), test.notes || '']
      )).rows[0]);
    }

    await recordAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'MEDICAL_RECORD_CREATED',
      patientId,
      purpose: 'Doctor recorded clinical treatment encounter',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { visit_id: newVisit.id, diagnosis }
    });

    return res.status(201).json({
      success: true,
      message: 'Medical record added successfully.',
      data: { ...newVisit, tests: recordedTests }
    });
  } catch (error) {
    return safeError(res, error, 'Failed to add medical record.');
  }
};

/**
 * POST /api/patients
 * Admission of new in-hospital patient
 */
const createPatient = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const name = boundedText(req.body.name, 'name', { max: 255 });
    const dob = boundedText(req.body.dob, 'dob', { max: 20 });
    if (Number.isNaN(new Date(dob).getTime()) || new Date(dob) >= new Date()) throw new ValidationError('dob must be a valid date in the past.');
    const gender = boundedText(req.body.gender, 'gender', { max: 20 });
    const diagnosis = boundedText(req.body.diagnosis, 'diagnosis', { max: 2000 });
    const status = enumValue(req.body.status || 'ADMITTED', 'status', ['ADMITTED', 'CRITICAL', 'OBSERVATION', 'DISCHARGED', 'TRANSFERRED']).toLowerCase();
    const healthId = boundedText(req.body.unique_health_id || generateUniqueHealthId(), 'unique_health_id', { max: 100 });
    const patient = (await query(`INSERT INTO patients (unique_health_id, name, dob, gender, blood_group, phone, emergency_contact_name, emergency_contact_phone, medical_history, allergies) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [healthId, name, dob, gender, req.body.blood_group || 'O+', req.body.phone || null, req.body.emergency_contact_name || null, req.body.emergency_contact_phone || null, req.body.medical_history || 'No prior chronic conditions recorded.', req.body.allergies || 'None known'])).rows[0];
    const visit = (await query(`INSERT INTO visits (patient_id, hospital_id, attending_doctor_id, diagnosis, status, chief_complaint, clinical_notes, vitals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [patient.id, req.user.hospital_id, req.user.id, diagnosis, status, boundedText(req.body.chief_complaint || '', 'chief_complaint', { required: false, max: 2000 }), boundedText(req.body.clinical_notes || '', 'clinical_notes', { required: false, max: 5000 }), JSON.stringify(req.body.vitals && typeof req.body.vitals === 'object' ? req.body.vitals : {})])).rows[0];
    
    // Automatically create active doctor_patients association for attending doctor
    await query(
      `INSERT INTO doctor_patients (doctor_id, patient_id, hospital_id, status, department, treatment_reason, treatment_start_date, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user.id, patient.id, req.user.hospital_id || 1, 'ACTIVE', req.user.specialty || 'General Care', diagnosis, new Date(), new Date()]
    );

    const tests = Array.isArray(req.body.tests) ? req.body.tests.slice(0, 50) : [];
    const recordedTests = [];
    for (const test of tests) {
      if (!test.test_name || test.result === undefined) continue;
      recordedTests.push((await query(`INSERT INTO tests (visit_id, test_name, category, result, units, reference_range, abnormal, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [visit.id, boundedText(test.test_name, 'test_name', { max: 255 }), boundedText(test.category || 'Laboratory', 'category', { max: 100 }), boundedText(test.result, 'result', { max: 2000 }), test.units || '', test.reference_range || '', Boolean(test.abnormal), test.notes || ''])).rows[0]);
    }
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'PATIENT_ADMISSION', patientId: patient.id, purpose: 'Patient registration and admission', result: 'SUCCESS', ipAddress, userAgent, metadata: { unique_health_id: healthId, hospital_id: req.user.hospital_id } });
    return res.status(201).json({ success: true, message: 'Patient registered and admitted successfully.', data: { ...patient, latest_visit: { ...visit, attending_doctor_name: req.user.name, tests: recordedTests } } });
  } catch (error) { return safeError(res, error, 'Database error while creating patient admission record.'); }
};

module.exports = {
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
  addMedicalRecord,
  filterPatientDataByCategories
};
