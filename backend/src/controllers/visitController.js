const { query } = require('../config/db');
const { authorizePatientAccess } = require('../services/clinicalAccessPolicy');
const { positiveInt, boundedText, enumValue } = require('../utils/validation');

function fail(res, error, fallback) {
  const status = error.status || 500;
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

const createVisit = async (req, res) => {
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    await authorizePatientAccess(req.user, patientId, { transferId: req.body.transfer_id || null, allowEmergency: false });
    const diagnosis = boundedText(req.body.diagnosis, 'diagnosis', { max: 2000 });
    const status = enumValue(req.body.status || 'ADMITTED', 'status', ['ADMITTED', 'CRITICAL', 'OBSERVATION', 'DISCHARGED', 'TRANSFERRED']).toLowerCase();
    const result = await query(`INSERT INTO visits (patient_id, hospital_id, attending_doctor_id, diagnosis, status, chief_complaint, clinical_notes, vitals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [patientId, req.user.hospital_id, req.user.id, diagnosis, status, boundedText(req.body.chief_complaint || '', 'chief_complaint', { required: false, max: 2000 }), boundedText(req.body.clinical_notes || '', 'clinical_notes', { required: false, max: 5000 }), JSON.stringify(req.body.vitals && typeof req.body.vitals === 'object' ? req.body.vitals : {})]);
    return res.status(201).json({ success: true, message: 'New clinical visit created successfully.', data: { ...result.rows[0], attending_doctor_name: req.user.name } });
  } catch (error) { return fail(res, error, 'Failed to create clinical visit record.'); }
};

const updateVisitStatus = async (req, res) => {
  try {
    const visitId = positiveInt(req.params.id, 'visit id');
    const status = enumValue(req.body.status, 'status', ['ADMITTED', 'CRITICAL', 'OBSERVATION', 'DISCHARGED', 'TRANSFERRED']).toLowerCase();
    const visit = (await query('SELECT * FROM visits WHERE id = $1', [visitId])).rows[0];
    if (!visit) return res.status(404).json({ success: false, message: 'Visit record not found.' });
    if (Number(visit.hospital_id) !== Number(req.user.hospital_id)) return res.status(403).json({ success: false, message: 'Visit mutations are restricted to the visit hospital.' });
    const result = await query(`UPDATE visits SET status = $1, discharge_date = CASE WHEN $1 = 'discharged' THEN CURRENT_TIMESTAMP ELSE discharge_date END WHERE id = $2 RETURNING *`, [status, visitId]);
    return res.json({ success: true, message: `Visit status updated to ${status}.`, data: result.rows[0] });
  } catch (error) { return fail(res, error, 'Failed to update visit status.'); }
};

module.exports = { createVisit, updateVisitStatus };
