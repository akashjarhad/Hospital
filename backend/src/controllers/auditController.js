const { getScopedAuditRows, authorizePatientAccess } = require('../services/clinicalAccessPolicy');
const { positiveInt } = require('../utils/validation');

function stripAdministrativePhi(log) {
  const { patient_name, patient_unique_health_id, ...safe } = log;
  return safe;
}

function fail(res, error, fallback) {
  const status = error.status || 500;
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

const getAuditLogs = async (req, res) => {
  try {
    const hospitalId = req.user.role === 'SYSTEM_ADMIN' ? null : req.user.hospital_id;
    let logs = await getScopedAuditRows(hospitalId);
    if (req.query.user_id) logs = logs.filter(log => Number(log.user_id) === positiveInt(req.query.user_id, 'user_id'));
    if (req.query.patient_id) logs = logs.filter(log => Number(log.patient_id) === positiveInt(req.query.patient_id, 'patient_id'));
    if (req.query.transfer_id) logs = logs.filter(log => Number(log.transfer_id) === positiveInt(req.query.transfer_id, 'transfer_id'));
    if (req.query.action) logs = logs.filter(log => log.action === String(req.query.action).toUpperCase());
    if (req.query.role) logs = logs.filter(log => log.role === String(req.query.role).toUpperCase());
    if (req.query.result) logs = logs.filter(log => log.result === String(req.query.result).toUpperCase());
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const data = ['HOSPITAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role) ? logs.slice(0, limit).map(stripAdministrativePhi) : logs.slice(0, limit);
    return res.json({ success: true, total: logs.length, returned: data.length, data });
  } catch (error) { return fail(res, error, 'Failed to retrieve audit trail.'); }
};

const getSecurityAnalytics = async (req, res) => {
  try {
    const hospitalId = req.user.role === 'SYSTEM_ADMIN' ? null : req.user.hospital_id;
    const logs = await getScopedAuditRows(hospitalId);
    const count = predicate => logs.filter(predicate).length;
    return res.json({ success: true, scope: hospitalId === null ? 'GLOBAL' : `HOSPITAL_${hospitalId}`, metrics: {
      total_access_events: logs.length,
      unauthorized_attempts: count(log => log.action === 'UNAUTHORIZED_ACCESS_ATTEMPT' || log.result === 'DENIED'),
      emergency_break_glass_events: count(log => String(log.action).includes('EMERGENCY')),
      data_disclosures: count(log => ['DATA_ACCESSED', 'DATA_DOWNLOADED'].includes(log.action)),
      consent_events: count(log => String(log.action).includes('CONSENT')),
      transfer_events: count(log => String(log.action).includes('TRANSFER'))
    }, recent_security_events: logs.filter(log => log.result === 'DENIED' || String(log.action).includes('EMERGENCY')).slice(0, 10).map(stripAdministrativePhi), notice: 'Administrative analytics excludes patient names, health identifiers, and clinical record content.' });
  } catch (error) { return fail(res, error, 'Failed to compute security analytics.'); }
};

const getPatientAccessHistory = async (req, res) => {
  try {
    const patientId = positiveInt(req.params.patientId, 'patientId');
    if (['HOSPITAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Administrative roles use non-PHI aggregate security analytics instead of patient-specific histories.' });
    await authorizePatientAccess(req.user, patientId, { transferId: req.query.transfer_id || null, allowEmergency: false });
    let logs = await getScopedAuditRows(req.user.role === 'DOCTOR' ? req.user.hospital_id : null);
    logs = logs.filter(log => Number(log.patient_id) === patientId);
    return res.json({ success: true, total: logs.length, data: logs });
  } catch (error) { return fail(res, error, 'Failed to retrieve patient access logs.'); }
};

module.exports = { getAuditLogs, getSecurityAnalytics, getPatientAccessHistory };
