const { query } = require('../config/db');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { loadPatientAggregate, projectByCategories, normalizeCategories, CATEGORY_DEFINITIONS } = require('../services/patientAggregateService');
const { boundedText, positiveInt } = require('../utils/validation');

const EMERGENCY_DEFAULT_SCOPE = ['Allergies', 'Current Medications', 'Medical History', 'Current Diagnosis', 'Laboratory Reports', 'Emergency Contact'];

const requestEmergencyAccess = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    const reason = boundedText(req.body.reason, 'reason', { min: 10, max: 1000 });
    const transferId = req.body.transfer_id ? positiveInt(req.body.transfer_id, 'transfer_id') : null;
    const hours = Math.min(Math.max(Number.parseInt(req.body.duration_hours, 10) || 4, 1), 12);
    const requestedCodes = new Set(normalizeCategories(Array.isArray(req.body.access_scope) ? req.body.access_scope : EMERGENCY_DEFAULT_SCOPE));
    const effectiveScope = EMERGENCY_DEFAULT_SCOPE.filter(label => requestedCodes.has(normalizeCategories([label])[0]));
    if (!effectiveScope.length) return res.status(400).json({ success: false, message: 'access_scope must include at least one permitted emergency category.' });

    const aggregate = await loadPatientAggregate(patientId);
    if (!aggregate) return res.status(404).json({ success: false, message: 'Patient not found.' });
    if (transferId) {
      const transfer = (await query('SELECT * FROM transfer_requests WHERE id = $1', [transferId])).rows[0];
      if (!transfer || Number(transfer.patient_id) !== patientId) return res.status(400).json({ success: false, message: 'transfer_id does not match the patient.' });
    }

    const expiresAt = new Date(Date.now() + hours * 3600000);
    const emergencyRecord = (await query(`INSERT INTO emergency_access (doctor_id, patient_id, hospital_id, transfer_id, reason, requested_at, approved_at, expires_at, status, access_scope) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, 'ACTIVE', $7) RETURNING *`, [req.user.id, patientId, req.user.hospital_id, transferId, reason, expiresAt.toISOString(), JSON.stringify(effectiveScope)])).rows[0];

    if (aggregate.user_id) await query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)`, [aggregate.user_id, 'CRITICAL: Emergency Break-Glass Access Invoked', `Dr. ${req.user.name} invoked emergency access with a recorded justification. Access expires in ${hours} hours.`, 'EMERGENCY_ALERT', emergencyRecord.id]);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'EMERGENCY_ACCESS_GRANTED', patientId, transferId, purpose: 'Break-Glass Emergency Protocol Invocation', result: 'SUCCESS', ipAddress, userAgent, metadata: { emergency_access_id: emergencyRecord.id, valid_until: expiresAt.toISOString(), permitted_scope: effectiveScope } });

    return res.json({ success: true, message: `Emergency break-glass access granted for ${hours} hours. All actions are logged. External AI processing is prohibited for this session.`, emergency_session: { id: emergencyRecord.id, doctor_id: req.user.id, expires_at: expiresAt, status: 'ACTIVE', scope: effectiveScope }, data: projectByCategories(aggregate, effectiveScope) });
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('Error in requestEmergencyAccess:', error);
    return res.status(status).json({ success: false, message: status === 500 ? 'Failed to process emergency break-glass request.' : error.message });
  }
};

const getEmergencyAccessLogs = async (req, res) => {
  try {
    let rows = (await query('SELECT * FROM emergency_access')).rows;
    if (req.user.role === 'HOSPITAL_ADMIN') rows = rows.filter(row => Number(row.hospital_id) === Number(req.user.hospital_id));
    if (req.user.role === 'DOCTOR') rows = rows.filter(row => Number(row.doctor_id) === Number(req.user.id));
    return res.json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error('Error in getEmergencyAccessLogs:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve emergency access records.' });
  }
};

module.exports = { EMERGENCY_DEFAULT_SCOPE, requestEmergencyAccess, getEmergencyAccessLogs };
