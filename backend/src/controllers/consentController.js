const { query } = require('../config/db');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { boundedText } = require('../utils/validation');

const ALL_CATEGORIES = [
  'Patient Demographics', 'Emergency Contact', 'Medical History', 'Current Diagnosis', 'Allergies',
  'Current Medications', 'Previous Medications', 'Laboratory Reports', 'Diagnostic Reports',
  'Imaging Reports', 'Clinical Notes', 'Treatment History', 'Discharge Summary', 'Surgical History',
  'Doctor Transfer Summary'
];

const EXCLUDED_CATEGORIES = [
  'Financial Information & Billing Records', 'Insurance Policy & Claims History',
  'Unrelated Administrative Notes', 'Psychosocial Evaluation Notes (Unless Explicitly Requested)'
];

async function patientIdForUser(user) {
  if (user.role !== 'PATIENT') return null;
  if (user.patient_id) return Number(user.patient_id);
  const byUser = (await query('SELECT id FROM patients WHERE user_id = $1', [user.id])).rows[0]?.id;
  if (byUser) return Number(byUser);
  return null;
}

async function requireOwnedConsent(req, consent) {
  const patientId = await patientIdForUser(req.user);
  if (!patientId || patientId !== Number(consent.patient_id)) {
    const error = new Error('You may only change consent for your own records.');
    error.status = 403;
    throw error;
  }
}

function isExpired(consent) {
  return Boolean(consent.expires_at && new Date(consent.expires_at) <= new Date());
}

function safeError(res, error, fallback) {
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500);
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

const getMyConsents = async (req, res) => {
  try {
    const patientId = await patientIdForUser(req.user);
    if (!patientId) return res.status(200).json({ success: true, total: 0, data: [] });
    const rows = (await query('SELECT * FROM consents WHERE patient_id = $1', [patientId])).rows.map(consent => ({
      ...consent,
      effective_status: isExpired(consent) && consent.status === 'GRANTED' ? 'EXPIRED' : consent.status,
      requested_categories: consent.data_categories || [],
      not_requested_categories: EXCLUDED_CATEGORIES
    }));
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (error) { return safeError(res, error, 'Failed to retrieve patient consents.'); }
};

const getConsentById = async (req, res) => {
  try {
    const result = await query('SELECT * FROM consents WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Consent request not found.' });
    const consent = result.rows[0];
    const ownedPatientId = await patientIdForUser(req.user);
    const isPatient = req.user.role === 'PATIENT' && ownedPatientId === Number(consent.patient_id);
    const isStaff = ['DOCTOR', 'HOSPITAL_ADMIN'].includes(req.user.role) && [consent.requesting_hospital_id, consent.receiving_hospital_id].map(Number).includes(Number(req.user.hospital_id));
    if (!isPatient && !isStaff && req.user.role !== 'SYSTEM_ADMIN') return res.status(403).json({ success: false, message: 'Access Denied: You are not authorized to view this consent.' });
    return res.json({ success: true, data: { ...consent, effective_status: isExpired(consent) && consent.status === 'GRANTED' ? 'EXPIRED' : consent.status, excluded_categories: EXCLUDED_CATEGORIES } });
  } catch (error) { return safeError(res, error, 'Failed to retrieve consent details.'); }
};

const approveConsent = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const consent = (await query('SELECT * FROM consents WHERE id = $1', [req.params.id])).rows[0];
    if (!consent) return res.status(404).json({ success: false, message: 'Consent request not found.' });
    await requireOwnedConsent(req, consent);
    if (consent.status !== 'PENDING') return res.status(409).json({ success: false, message: `Only PENDING consent may be approved; current status is ${consent.status}.` });
    if (isExpired(consent)) return res.status(409).json({ success: false, message: 'This consent request has expired and cannot be approved.' });

    let expiresAt = consent.expires_at ? new Date(consent.expires_at) : new Date(Date.now() + 7 * 86400000);
    if (req.body.custom_expiry) {
      const custom = new Date(req.body.custom_expiry);
      if (Number.isNaN(custom.getTime()) || custom <= new Date()) return res.status(400).json({ success: false, message: 'custom_expiry must be a valid future date.' });
      if (custom > new Date(Date.now() + 30 * 86400000)) return res.status(400).json({ success: false, message: 'custom_expiry cannot exceed 30 days.' });
      if (consent.expires_at && custom > new Date(consent.expires_at)) return res.status(400).json({ success: false, message: 'custom_expiry cannot extend the original consent request validity.' });
      expiresAt = custom;
    }
    const signNote = boundedText(req.body.signature_note || 'Patient Approved Digital Consent via Patient Portal', 'signature_note', { max: 500 });
    const updated = (await query(`UPDATE consents SET status = $1, granted_at = CURRENT_TIMESTAMP, expires_at = $2, patient_signature_note = $3 WHERE id = $4 RETURNING *`, ['GRANTED', expiresAt.toISOString(), signNote, consent.id])).rows[0];
    await query(`UPDATE transfer_requests SET consent_status = 'GRANTED', transfer_status = 'AUTHORIZED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [consent.transfer_id]);
    await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)`, [consent.requesting_doctor_id, 'Patient Consent Granted', `Patient approved transfer consent for Transfer #${consent.transfer_id}.`, 'CONSENT_UPDATE', consent.transfer_id]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'CONSENT_GRANTED', patientId: consent.patient_id, transferId: consent.transfer_id, purpose: 'Patient Explicit Authorization for Inter-Hospital Data Transfer', result: 'SUCCESS', ipAddress, userAgent, metadata: { consent_id: consent.id, granted_categories: consent.data_categories, valid_until: expiresAt.toISOString() } });
    return res.json({ success: true, message: 'Consent GRANTED successfully.', data: updated });
  } catch (error) { return safeError(res, error, 'Failed to approve consent.'); }
};

const rejectConsent = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const consent = (await query('SELECT * FROM consents WHERE id = $1', [req.params.id])).rows[0];
    if (!consent) return res.status(404).json({ success: false, message: 'Consent request not found.' });
    await requireOwnedConsent(req, consent);
    if (consent.status !== 'PENDING') return res.status(409).json({ success: false, message: `Only PENDING consent may be rejected; current status is ${consent.status}.` });
    const reason = boundedText(req.body.reason || 'Patient declined data sharing', 'reason', { max: 500 });
    const updated = (await query(`UPDATE consents SET status = $1, patient_signature_note = $2 WHERE id = $3 RETURNING *`, ['REJECTED', reason, consent.id])).rows[0];
    await query(`UPDATE transfer_requests SET consent_status = 'REJECTED', transfer_status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [consent.transfer_id]);
    await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)`, [consent.requesting_doctor_id, 'Patient Consent Rejected', `Patient rejected consent for Transfer #${consent.transfer_id}.`, 'CONSENT_UPDATE', consent.transfer_id]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'CONSENT_REJECTED', patientId: consent.patient_id, transferId: consent.transfer_id, purpose: 'Patient Rejection of Inter-Hospital Transfer Request', result: 'SUCCESS', ipAddress, userAgent, metadata: { consent_id: consent.id } });
    return res.json({ success: true, message: 'Consent REJECTED. Medical records will not be shared.', data: updated });
  } catch (error) { return safeError(res, error, 'Failed to reject consent.'); }
};

const revokeConsent = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const consent = (await query('SELECT * FROM consents WHERE id = $1', [req.params.id])).rows[0];
    if (!consent) return res.status(404).json({ success: false, message: 'Consent request not found.' });
    await requireOwnedConsent(req, consent);
    if (consent.status !== 'GRANTED' || isExpired(consent)) return res.status(409).json({ success: false, message: 'Only active GRANTED consent may be revoked.' });
    const reason = boundedText(req.body.reason || 'Patient revoked previously granted consent', 'reason', { max: 500 });
    const updated = (await query(`UPDATE consents SET status = $1, revoked_at = CURRENT_TIMESTAMP, patient_signature_note = $2 WHERE id = $3 RETURNING *`, ['REVOKED', reason, consent.id])).rows[0];
    await query(`UPDATE transfer_requests SET consent_status = 'REVOKED', transfer_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [consent.transfer_id]);
    await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)`, [consent.requesting_doctor_id, 'Consent Revoked by Patient', `Patient revoked consent for Transfer #${consent.transfer_id}. Further disclosure is halted.`, 'CONSENT_UPDATE', consent.transfer_id]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'CONSENT_REVOKED', patientId: consent.patient_id, transferId: consent.transfer_id, purpose: 'Patient Revocation of Inter-Hospital Data Access', result: 'SUCCESS', ipAddress, userAgent, metadata: { consent_id: consent.id } });
    return res.json({ success: true, message: 'Consent REVOKED successfully.', data: updated });
  } catch (error) { return safeError(res, error, 'Failed to revoke consent.'); }
};

module.exports = { ALL_CATEGORIES, getMyConsents, getConsentById, approveConsent, rejectConsent, revokeConsent };
