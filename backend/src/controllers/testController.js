const { query } = require('../config/db');
const { authorizePatientAccess } = require('../services/clinicalAccessPolicy');
const { positiveInt, boundedText } = require('../utils/validation');

function fail(res, error, fallback) {
  const status = error.status || 500;
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

const addTest = async (req, res) => {
  try {
    const visitId = positiveInt(req.body.visit_id, 'visit_id');
    const visit = (await query('SELECT * FROM visits WHERE id = $1', [visitId])).rows[0];
    if (!visit) return res.status(404).json({ success: false, message: 'Visit record not found.' });
    if (Number(visit.hospital_id) !== Number(req.user.hospital_id)) return res.status(403).json({ success: false, message: 'Tests may only be recorded by a doctor at the visit hospital.' });
    const result = await query(`INSERT INTO tests (visit_id, test_name, category, result, units, reference_range, abnormal, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [visitId, boundedText(req.body.test_name, 'test_name', { max: 255 }), boundedText(req.body.category || 'Diagnostic', 'category', { max: 100 }), boundedText(req.body.result, 'result', { max: 2000 }), boundedText(req.body.units || '', 'units', { required: false, max: 50 }), boundedText(req.body.reference_range || '', 'reference_range', { required: false, max: 100 }), Boolean(req.body.abnormal), boundedText(req.body.notes || '', 'notes', { required: false, max: 2000 })]);
    return res.status(201).json({ success: true, message: 'Diagnostic test recorded successfully.', data: result.rows[0] });
  } catch (error) { return fail(res, error, 'Failed to record diagnostic test.'); }
};

const checkDuplicateTest = async (req, res) => {
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    await authorizePatientAccess(req.user, patientId, { transferId: req.body.transfer_id || null, allowEmergency: false });
    const testName = boundedText(req.body.test_name, 'test_name', { max: 255 });
    const rows = (await query(`SELECT t.*, v.patient_id, v.admission_date, h.name as hospital_name, h.code as hospital_code FROM tests t JOIN visits v ON t.visit_id = v.id JOIN hospitals h ON v.hospital_id = h.id WHERE v.patient_id = $1 AND t.timestamp >= NOW() - INTERVAL '24 HOURS' ORDER BY t.timestamp DESC`, [patientId])).rows;
    const normalized = testName.toLowerCase();
    const matches = rows.filter(test => { const existing = String(test.test_name || '').toLowerCase().trim(); return existing === normalized || existing.includes(normalized) || normalized.includes(existing); });
    return res.json({ success: true, isDuplicate: matches.length > 0, matches, message: matches.length ? `Warning: a similar test "${matches[0].test_name}" is recorded within the past 24 hours. Clinician review is required.` : 'No duplicate tests detected in the past 24 hours.' });
  } catch (error) { return fail(res, error, 'Failed to perform duplicate test check.'); }
};

module.exports = { addTest, checkDuplicateTest };
