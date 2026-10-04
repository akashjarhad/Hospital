const { query, memoryStore, getConnectionStatus } = require('../config/db');
const { ALL_CATEGORY_LABELS } = require('./patientAggregateService');

class AccessDeniedError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'AccessDeniedError';
    this.status = status;
  }
}

function isConsentActive(consent, now = new Date()) {
  return Boolean(
    consent &&
    consent.status === 'GRANTED' &&
    !consent.revoked_at &&
    (!consent.expires_at || new Date(consent.expires_at) > now)
  );
}

async function getTransferContext(transferId) {
  const transferResult = await query('SELECT * FROM transfer_requests WHERE id = $1', [transferId]);
  if (!transferResult.rows.length) throw new AccessDeniedError('Transfer request not found.', 404);
  const transfer = transferResult.rows[0];
  const consent = (await query('SELECT * FROM consents WHERE transfer_id = $1', [transfer.id])).rows[0] || null;
  return { transfer, consent };
}

async function getLocalVisits(patientId, hospitalId) {
  return (await query('SELECT * FROM visits WHERE patient_id = $1 AND hospital_id = $2', [patientId, hospitalId])).rows;
}

async function getActiveEmergency(patientId, doctorId) {
  const result = await query(
    `SELECT * FROM emergency_access WHERE patient_id = $1 AND doctor_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()`,
    [patientId, doctorId]
  );
  return result.rows[0] || null;
}

async function authorizeTransferAI(user, transferId, action = 'READ') {
  const { transfer, consent } = await getTransferContext(transferId);
  const isPatient = user.role === 'PATIENT' && Number(user.patient_id) === Number(transfer.patient_id);
  if (isPatient) {
    if (action !== 'READ' || !isConsentActive(consent)) throw new AccessDeniedError('Patient access requires active transfer consent and a viewable approved result.');
    return { transfer, consent, categories: consent.data_categories || [], accessMode: 'PATIENT_CONSENT' };
  }
  if (user.role !== 'DOCTOR') throw new AccessDeniedError('Clinical AI operations require an authorized doctor.');

  const isRequestingDoctor = Number(user.id) === Number(transfer.requesting_doctor_id) && Number(user.hospital_id) === Number(transfer.source_hospital_id);
  const localVisits = Number(user.hospital_id) === Number(transfer.source_hospital_id)
    ? await getLocalVisits(transfer.patient_id, user.hospital_id)
    : [];
  const isLegitimateLocalAttending = localVisits.some(visit => Number(visit.attending_doctor_id) === Number(user.id));
  if (isRequestingDoctor || isLegitimateLocalAttending) {
    return { transfer, consent, categories: transfer.requested_data || ALL_CATEGORY_LABELS, accessMode: 'SOURCE_LOCAL_CARE', recordScope: { hospitalId: Number(transfer.source_hospital_id), visitIds: transfer.visit_id ? [Number(transfer.visit_id)] : localVisits.filter(visit => Number(visit.attending_doctor_id) === Number(user.id)).map(visit => Number(visit.id)) } };
  }

  const isReceivingDoctor = Number(user.id) === Number(transfer.receiving_doctor_id) && Number(user.hospital_id) === Number(transfer.destination_hospital_id);
  if (isReceivingDoctor && isConsentActive(consent)) {
    return { transfer, consent, categories: consent.data_categories || [], accessMode: 'DESTINATION_CONSENT', recordScope: { hospitalId: Number(transfer.source_hospital_id), visitIds: transfer.visit_id ? [Number(transfer.visit_id)] : null } };
  }
  throw new AccessDeniedError('Access requires assignment to this transfer and active, unexpired, nonrevoked consent for destination access.');
}

async function authorizePatientAccess(user, patientId, { transferId = null, allowEmergency = true } = {}) {
  const numericPatientId = Number(patientId);
  if (user.role === 'PATIENT') {
    let ownedPatientId = user.patient_id;
    if (!ownedPatientId) {
      ownedPatientId = (await query('SELECT id FROM patients WHERE user_id = $1', [user.id])).rows[0]?.id;
    }
    if (Number(ownedPatientId) !== numericPatientId) throw new AccessDeniedError('You may only access your own record.');
    return { categories: ALL_CATEGORY_LABELS, accessMode: 'PATIENT_SELF', transfer: null, consent: null, emergency: null };
  }
  if (user.role !== 'DOCTOR') throw new AccessDeniedError('Administrative roles cannot access clinical PHI.');

  const assocRes = await query(
    `SELECT * FROM doctor_patients WHERE doctor_id = $1 AND patient_id = $2 AND status IN ('ACTIVE', 'ACCEPTED')`,
    [user.id, numericPatientId]
  );
  if (assocRes.rows.length) {
    const localVisits = await getLocalVisits(numericPatientId, user.hospital_id);
    const attendingVisits = localVisits.filter(visit => Number(visit.attending_doctor_id) === Number(user.id));
    return {
      categories: ALL_CATEGORY_LABELS,
      accessMode: 'DOCTOR_PATIENT_RELATIONSHIP',
      transfer: null,
      consent: null,
      emergency: null,
      recordScope: attendingVisits.length ? { hospitalId: Number(user.hospital_id), visitIds: attendingVisits.map(visit => Number(visit.id)) } : null
    };
  }

  const localVisits = await getLocalVisits(numericPatientId, user.hospital_id);
  const attendingVisits = localVisits.filter(visit => Number(visit.attending_doctor_id) === Number(user.id));
  if (attendingVisits.length) return { categories: ALL_CATEGORY_LABELS, accessMode: 'LOCAL_ATTENDING_CARE', transfer: null, consent: null, emergency: null, recordScope: { hospitalId: Number(user.hospital_id), visitIds: attendingVisits.map(visit => Number(visit.id)) } };

  if (transferId) {
    const context = await authorizeTransferAI(user, transferId, 'READ');
    if (Number(context.transfer.patient_id) !== numericPatientId) throw new AccessDeniedError('Transfer context does not match the patient.');
    return { ...context, emergency: null };
  }

  if (allowEmergency) {
    const emergency = await getActiveEmergency(numericPatientId, user.id);
    if (emergency) return { categories: emergency.access_scope || [], accessMode: 'BREAK_GLASS_EMERGENCY', transfer: null, consent: null, emergency };
  }
  throw new AccessDeniedError('No local care relationship, active transfer consent, or matching emergency session was found.');
}

async function getScopedAuditRows(hospitalId = null) {
  if (!getConnectionStatus()) {
    return memoryStore.audit_logs.filter(log => {
      const actor = memoryStore.users.find(user => user.id === log.user_id);
      const transfer = log.transfer_id ? memoryStore.transfer_requests.find(t => t.id === log.transfer_id) : null;
      const matchesActorHospital = hospitalId === null || Number(actor?.hospital_id) === Number(hospitalId);
      const matchesTransferHospital = hospitalId !== null && transfer && ([Number(transfer.source_hospital_id), Number(transfer.destination_hospital_id)].includes(Number(hospitalId)));
      return matchesActorHospital || matchesTransferHospital;
    }).map(log => ({ ...log, actor_hospital_id: memoryStore.users.find(user => user.id === log.user_id)?.hospital_id || null }));
  }
  const values = hospitalId === null ? [] : [hospitalId];
  const where = hospitalId === null ? '' : ' WHERE u.hospital_id = $1 OR tr.source_hospital_id = $1 OR tr.destination_hospital_id = $1';
  return (await query(`SELECT a.*, u.hospital_id AS actor_hospital_id FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN transfer_requests tr ON tr.id = a.transfer_id${where}`, values)).rows;
}

module.exports = { AccessDeniedError, isConsentActive, getTransferContext, getActiveEmergency, authorizeTransferAI, authorizePatientAccess, getScopedAuditRows };
