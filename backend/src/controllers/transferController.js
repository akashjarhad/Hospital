const { query } = require('../config/db');
const { encryptData, decryptData, generatePackageSignature, verifyPackageSignature } = require('../utils/crypto');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { toFHIRBundle } = require('../utils/fhirMapper');
const repository = require('../repositories/aiRepository');
const { loadPatientIdentity, loadPatientAggregate, projectByCategories, normalizeCategories, CATEGORY_DEFINITIONS } = require('../services/patientAggregateService');
const { authorizeTransferAI, isConsentActive, AccessDeniedError } = require('../services/clinicalAccessPolicy');
const { positiveInt, boundedText, enumValue, ValidationError } = require('../utils/validation');

const DEFAULT_CATEGORIES = ['Patient Demographics', 'Emergency Contact', 'Medical History', 'Current Diagnosis', 'Allergies', 'Current Medications', 'Laboratory Reports', 'Diagnostic Reports', 'Doctor Transfer Summary'];

const generateTransferCode = () => `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

function safeTransferMetadata(transfer) {
  return {
    id: transfer.id,
    transfer_code: transfer.transfer_code,
    source_hospital_id: transfer.source_hospital_id,
    destination_hospital_id: transfer.destination_hospital_id,
    requesting_doctor_id: transfer.requesting_doctor_id,
    receiving_doctor_id: transfer.receiving_doctor_id,
    clinical_priority: transfer.clinical_priority,
    consent_status: transfer.consent_status,
    transfer_status: transfer.transfer_status,
    created_at: transfer.created_at,
    updated_at: transfer.updated_at,
    expires_at: transfer.expires_at
  };
}

function safeClinicalTransfer(transfer) {
  const { encrypted_package, package_signature, ...safe } = transfer;
  return safe;
}

function safeError(res, error, fallback) {
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

function canonicalCategories(requested) {
  const input = Array.isArray(requested) && requested.length ? requested : DEFAULT_CATEGORIES;
  const codes = normalizeCategories(input);
  if (codes.length !== new Set(input.map(value => String(value).trim().toLowerCase())).size) throw new ValidationError('requested_data contains an unsupported or duplicate category.');
  return codes.map(code => CATEGORY_DEFINITIONS[code]);
}

const createTransfer = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    const destinationHospitalId = positiveInt(req.body.destination_hospital_id, 'destination_hospital_id');
    if (Number(req.user.hospital_id) === destinationHospitalId) throw new ValidationError('Source and destination hospitals cannot be the same facility.');
    const transferReason = boundedText(req.body.transfer_reason, 'transfer_reason', { min: 10, max: 2000 });
    const priority = enumValue(req.body.clinical_priority || 'URGENT', 'clinical_priority', ['ROUTINE', 'URGENT', 'EMERGENCY']);
    const summary = boundedText(req.body.doctor_transfer_summary || '', 'doctor_transfer_summary', { required: false, max: 5000 });
    const categories = canonicalCategories(req.body.requested_data);
    const receivingDoctorId = req.body.receiving_doctor_id ? positiveInt(req.body.receiving_doctor_id, 'receiving_doctor_id') : null;
    const visitId = req.body.visit_id ? positiveInt(req.body.visit_id, 'visit_id') : null;

    const patient = await loadPatientIdentity(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });
    const localVisits = (await query('SELECT * FROM visits WHERE patient_id = $1 AND hospital_id = $2', [patientId, req.user.hospital_id])).rows;
    const attendingVisits = localVisits.filter(visit => Number(visit.attending_doctor_id) === Number(req.user.id));
    const activeAssoc = (await query(`SELECT * FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2 AND status IN ('ACTIVE', 'ACCEPTED')`, [req.user.id, patientId])).rows;
    if (!attendingVisits.length && !activeAssoc.length) {
      throw new AccessDeniedError('A transfer may only be initiated by a doctor with an active treatment relationship for this patient.');
    }
    if (visitId && attendingVisits.length && !attendingVisits.some(visit => Number(visit.id) === visitId)) {
      throw new AccessDeniedError('visit_id must identify an encounter attended by the requesting doctor.');
    }
    if (receivingDoctorId) {
      const receivingDoctor = (await query('SELECT u.* FROM users u WHERE u.id = $1', [receivingDoctorId])).rows[0];
      if (!receivingDoctor || receivingDoctor.role !== 'DOCTOR' || Number(receivingDoctor.hospital_id) !== destinationHospitalId) throw new ValidationError('receiving_doctor_id must identify an active doctor at the destination hospital.');
    }
    if (!(await query('SELECT * FROM hospitals WHERE id = $1', [destinationHospitalId])).rows.length) return res.status(404).json({ success: false, message: 'Destination hospital not found.' });

    const effectiveVisitId = visitId || (attendingVisits[0] ? attendingVisits[0].id : (localVisits[0] ? localVisits[0].id : 1));
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const transfer = (await query(`INSERT INTO transfer_requests (transfer_code, patient_id, source_hospital_id, destination_hospital_id, requesting_doctor_id, receiving_doctor_id, visit_id, transfer_reason, clinical_priority, requested_data, consent_status, transfer_status, doctor_transfer_summary, encrypted_package, package_signature, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [generateTransferCode(), patientId, req.user.hospital_id, destinationHospitalId, req.user.id, receivingDoctorId, effectiveVisitId, transferReason, priority, JSON.stringify(categories), 'PENDING', 'PENDING_CONSENT', summary, null, null, expiresAt])).rows[0];
    const consent = (await query(`INSERT INTO consents (patient_id, transfer_id, requesting_hospital_id, receiving_hospital_id, requesting_doctor_id, receiving_doctor_id, purpose, data_categories, status, expires_at, consent_version, patient_signature_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [patientId, transfer.id, req.user.hospital_id, destinationHospitalId, req.user.id, receivingDoctorId, `Inter-Hospital Transfer: ${transferReason}`, JSON.stringify(categories), 'PENDING', expiresAt, '1.0', null])).rows[0];
    if (patient.user_id) await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1,$2,$3,$4,$5)`, [patient.user_id, 'Consent Request for Medical Transfer', `Dr. ${req.user.name} requested consent for selected records (${transfer.transfer_code}).`, 'CONSENT_REQUEST', consent.id]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'TRANSFER_CREATED', patientId, transferId: transfer.id, purpose: 'Inter-hospital transfer initiation', result: 'SUCCESS', ipAddress, userAgent, metadata: { transfer_code: transfer.transfer_code, priority, categories } });
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'CONSENT_REQUESTED', patientId, transferId: transfer.id, purpose: 'Patient consent request generation', result: 'SUCCESS', ipAddress, userAgent, metadata: { consent_id: consent.id, categories } });
    return res.status(201).json({ success: true, message: 'Transfer request and patient consent request created successfully.', data: { transfer, consent } });
  } catch (error) { return safeError(res, error, 'Failed to create transfer request.'); }
};

const getTransfers = async (req, res) => {
  try {
    if (req.user.role === 'PATIENT') {
      const patientId = req.user.patient_id || (await query('SELECT id FROM patients WHERE user_id = $1', [req.user.id])).rows[0]?.id;
      const rows = patientId ? (await query('SELECT * FROM transfer_requests WHERE patient_id = $1', [patientId])).rows : [];
      return res.json({ success: true, total: rows.length, data: rows.map(safeTransferMetadata) });
    }
    if (!['DOCTOR', 'HOSPITAL_ADMIN'].includes(req.user.role) || !req.user.hospital_id) throw new AccessDeniedError('Hospital clinical or administrative affiliation is required.');
    const incoming = req.query.type !== 'outgoing' ? (await query('SELECT * FROM transfer_requests WHERE destination_hospital_id = $1', [req.user.hospital_id])).rows : [];
    const outgoing = req.query.type !== 'incoming' ? (await query('SELECT * FROM transfer_requests WHERE source_hospital_id = $1', [req.user.hospital_id])).rows : [];
    let rows = [...incoming, ...outgoing];
    if (req.user.role === 'DOCTOR') rows = rows.filter(transfer => Number(transfer.requesting_doctor_id) === Number(req.user.id) || Number(transfer.receiving_doctor_id) === Number(req.user.id));
    return res.json({ success: true, hospital_id: req.user.hospital_id, total: rows.length, data: rows.map(safeTransferMetadata) });
  } catch (error) { return safeError(res, error, 'Failed to retrieve transfer requests.'); }
};

const getTransferById = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const transfer = (await query('SELECT * FROM transfer_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    const patientId = req.user.role === 'PATIENT' ? Number(req.user.patient_id || (await query('SELECT id FROM patients WHERE user_id = $1', [req.user.id])).rows[0]?.id) : null;
    const patientOwns = patientId === Number(transfer.patient_id);
    const isHospitalAdmin = req.user.role === 'HOSPITAL_ADMIN' && [transfer.source_hospital_id, transfer.destination_hospital_id].map(Number).includes(Number(req.user.hospital_id));
    if (isHospitalAdmin) return res.json({ success: true, data: safeTransferMetadata(transfer), notice: 'Administrative view excludes clinical reason, summaries, patient identifiers, consent details, audit details, and encrypted package material.' });
    if (patientOwns) {
      const consent = (await query('SELECT * FROM consents WHERE transfer_id = $1', [transfer.id])).rows[0] || null;
      return res.json({ success: true, data: { ...safeTransferMetadata(transfer), consent: consent ? { id: consent.id, status: consent.status, data_categories: consent.data_categories, expires_at: consent.expires_at, revoked_at: consent.revoked_at } : null } });
    }
    if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('You are not authorized to view this transfer dossier.');
    let access;
    try {
      access = await authorizeTransferAI(req.user, transfer.id, 'READ');
    } catch (error) {
      const assignedDestination = Number(req.user.id) === Number(transfer.receiving_doctor_id) && Number(req.user.hospital_id) === Number(transfer.destination_hospital_id);
      if (assignedDestination) return res.json({ success: true, data: safeTransferMetadata(transfer), notice: 'Clinical transfer details remain hidden until consent is active.' });
      throw error;
    }
    const consent = (await query('SELECT * FROM consents WHERE transfer_id = $1', [transfer.id])).rows[0] || null;
    const audit = (await query('SELECT * FROM audit_logs WHERE transfer_id = $1', [transfer.id])).rows.filter(log => Number(log.user_id) === Number(req.user.id));
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'TRANSFER_VIEW', patientId: transfer.patient_id, transferId: transfer.id, purpose: 'Assigned transfer review', result: 'SUCCESS', ipAddress, userAgent, metadata: { access_mode: access.accessMode } });
    return res.json({ success: true, data: { ...safeClinicalTransfer(transfer), consent, audit_timeline: audit } });
  } catch (error) { return safeError(res, error, 'Failed to retrieve transfer.'); }
};

const getTransferData = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const access = await authorizeTransferAI(req.user, positiveInt(req.params.id, 'transfer id'), 'READ');
    const aggregate = await loadPatientAggregate(access.transfer.patient_id);
    const data = projectByCategories(aggregate, access.categories);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'DATA_ACCESSED', patientId: access.transfer.patient_id, transferId: access.transfer.id, purpose: `Transfer data review (${access.accessMode})`, result: 'SUCCESS', ipAddress, userAgent, metadata: { categories_released: data.permitted_categories, access_mode: access.accessMode } });
    return res.json({ success: true, transfer_code: access.transfer.transfer_code, access_mode: access.accessMode, consent_status: access.consent?.status || 'LOCAL_SOURCE_ACCESS', permitted_categories: data.permitted_categories, data });
  } catch (error) { return safeError(res, error, 'Internal error processing clinical data request.'); }
};

const sendTransfer = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const transferId = positiveInt(req.params.id, 'transfer id');
    const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
    if (access.accessMode !== 'SOURCE_LOCAL_CARE') throw new AccessDeniedError('Only the assigned source doctor or legitimate local attending may send this transfer.');
    const { transfer, consent } = access;
    if (!isConsentActive(consent)) throw new ValidationError('Cannot send transfer: consent must be granted, unexpired, and nonrevoked.');
    if (transfer.expires_at && new Date(transfer.expires_at) <= new Date()) throw new ValidationError('Cannot send transfer: the transfer request has expired.');
    if (!['AUTHORIZED'].includes(transfer.transfer_status)) throw new ValidationError(`Transfer cannot be sent from status ${transfer.transfer_status}.`);
    const handover = await repository.findOne('ai_handover_summaries', { transfer_id: transferId }, { sortField: 'generated_at' });
    if (handover && handover.status !== 'APPROVED') throw new ValidationError('An AI handover draft exists and must be explicitly reviewed and approved before sending.');

    const aggregate = await loadPatientAggregate(transfer.patient_id, access.recordScope);
    const approvedData = projectByCategories(aggregate, consent.data_categories);
    const packagePayload = { transfer_code: transfer.transfer_code, source_hospital_id: transfer.source_hospital_id, destination_hospital_id: transfer.destination_hospital_id, consent_id: consent.id, patient_id: transfer.patient_id, dispatched_at: new Date().toISOString(), clinical_data: approvedData, approved_ai_handover_id: handover?.id || null };
    const encryptedPayload = encryptData(packagePayload);
    const signature = generatePackageSignature(packagePayload);
    await query(`UPDATE transfer_requests SET transfer_status = 'IN_TRANSIT', encrypted_package = $1, package_signature = $2 WHERE id = $3`, [encryptedPayload, signature, transferId]);
    if (transfer.receiving_doctor_id) await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1,$2,$3,$4,$5)`, [transfer.receiving_doctor_id, 'Incoming Patient Transfer', `Secure transfer package ${transfer.transfer_code} was dispatched.`, 'TRANSFER_UPDATE', transferId]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'TRANSFER_SENT', patientId: transfer.patient_id, transferId, purpose: 'Encrypted transfer dispatch under active consent', result: 'SUCCESS', ipAddress, userAgent, metadata: { signature_sha256_prefix: signature.slice(0, 16), approved_ai_handover_id: handover?.id || null } });
    return res.json({ success: true, message: 'Transfer package successfully encrypted and dispatched.', package_signature: signature, transfer_status: 'IN_TRANSIT' });
  } catch (error) { return safeError(res, error, 'Failed to dispatch transfer package.'); }
};

const receiveTransfer = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const transferId = positiveInt(req.params.id, 'transfer id');
    const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
    const { transfer, consent } = access;
    if (access.accessMode !== 'DESTINATION_CONSENT') throw new AccessDeniedError('Only the assigned receiving doctor may receive this transfer.');
    if (!isConsentActive(consent)) throw new ValidationError('Transfer consent is no longer active.');
    if (transfer.transfer_status !== 'IN_TRANSIT') throw new ValidationError(`Transfer cannot be received from status ${transfer.transfer_status}.`);
    if (!transfer.encrypted_package || !transfer.package_signature) throw new ValidationError('Encrypted transfer package is missing.');
    const payload = decryptData(transfer.encrypted_package, true);
    if (!payload || typeof payload !== 'object' || !verifyPackageSignature(payload, transfer.package_signature)) throw new ValidationError('Transfer package integrity verification failed.');
    if (Number(payload.patient_id) !== Number(transfer.patient_id) || Number(payload.consent_id) !== Number(consent.id)) throw new ValidationError('Transfer package identity or consent does not match.');
    await query(`UPDATE transfer_requests SET transfer_status = 'RECEIVED' WHERE id = $1`, [transferId]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'TRANSFER_RECEIVED', patientId: transfer.patient_id, transferId, purpose: 'Receiving-doctor intake after state, consent, and integrity verification', result: 'SUCCESS', ipAddress, userAgent, metadata: { transfer_code: transfer.transfer_code, integrity_verified: true } });
    return res.json({ success: true, message: 'Transfer integrity and consent verified; transfer marked RECEIVED.', transfer_status: 'RECEIVED' });
  } catch (error) { return safeError(res, error, 'Failed to receive transfer.'); }
};

const exportFHIRBundle = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const access = await authorizeTransferAI(req.user, positiveInt(req.params.id, 'transfer id'), 'READ');
    const { transfer, consent } = access;
    const aggregate = await loadPatientAggregate(transfer.patient_id, access.recordScope);
    const projected = projectByCategories(aggregate, access.categories);
    const [source, destination, requesting, receiving] = await Promise.all([
      query('SELECT * FROM hospitals WHERE id = $1', [transfer.source_hospital_id]), query('SELECT * FROM hospitals WHERE id = $1', [transfer.destination_hospital_id]),
      query('SELECT u.* FROM users u WHERE u.id = $1', [transfer.requesting_doctor_id]), transfer.receiving_doctor_id ? query('SELECT u.* FROM users u WHERE u.id = $1', [transfer.receiving_doctor_id]) : Promise.resolve({ rows: [] })
    ]);
    const bundle = toFHIRBundle(transfer, projected, source.rows[0], destination.rows[0], requesting.rows[0], receiving.rows[0], projected, consent);
    bundle.prototypeNotice = 'FHIR-oriented prototype only; no formal FHIR conformance claim is made.';
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'DATA_DOWNLOADED', patientId: transfer.patient_id, transferId: transfer.id, purpose: 'FHIR-oriented prototype export under shared access policy', result: 'SUCCESS', ipAddress, userAgent, metadata: { export_format: 'FHIR-oriented-prototype', categories: projected.permitted_categories, access_mode: access.accessMode } });
    return res.json(bundle);
  } catch (error) { return safeError(res, error, 'Failed to export FHIR-oriented bundle.'); }
};

module.exports = { createTransfer, getTransfers, getTransferById, getTransferData, sendTransfer, receiveTransfer, exportFHIRBundle };
