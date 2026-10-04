const repository = require('../repositories/aiRepository');
const securityAnomalyService = require('../services/securityAnomalyService');
const aiService = require('../services/aiService');
const { OPERATIONS, logAIEvent } = require('../services/aiAuditService');
const { extractReqMeta } = require('../utils/auditLogger');
const { positiveInt, enumValue, boundedText } = require('../utils/validation');

function scope(req) {
  return req.user.role === 'SYSTEM_ADMIN' ? null : Number(req.user.hospital_id);
}

function inScope(req, anomaly) {
  return req.user.role === 'SYSTEM_ADMIN' || Number(anomaly.hospital_id) === Number(req.user.hospital_id);
}

function fail(res, error) {
  const status = error.status || 500;
  return res.status(status).json({ success: false, message: status === 500 ? 'Security analytics operation failed safely.' : error.message });
}

const listAnomalies = async (req, res) => {
  try {
    const hospitalId = scope(req);
    const rows = await repository.find('security_anomalies', hospitalId === null ? {} : { hospital_id: hospitalId });
    return res.json({ success: true, total: rows.length, notice: 'Review-only security metadata. No clinical PHI, accusations, or automatic blocking.', data: rows });
  } catch (error) { return fail(res, error); }
};

const getAnomaly = async (req, res) => {
  try {
    const id = positiveInt(req.params.id, 'anomaly id');
    const row = await repository.findOne('security_anomalies', { id });
    if (!row) return res.status(404).json({ success: false, message: 'Security anomaly not found.' });
    if (!inScope(req, row)) return res.status(403).json({ success: false, message: 'Hospital administrators may only view their own hospital security metadata.' });
    return res.json({ success: true, notice: 'Human review required; this event does not establish wrongdoing.', data: row });
  } catch (error) { return fail(res, error); }
};

const updateAnomaly = async (req, res) => {
  try {
    const id = positiveInt(req.params.id, 'anomaly id');
    const row = await repository.findOne('security_anomalies', { id });
    if (!row) return res.status(404).json({ success: false, message: 'Security anomaly not found.' });
    if (!inScope(req, row)) return res.status(403).json({ success: false, message: 'Hospital administrators may only review their own hospital events.' });
    const reviewStatus = enumValue(req.body.review_status, 'review_status', ['REVIEWED', 'DISMISSED', 'ESCALATED']);
    const reviewNote = boundedText(req.body.review_note, 'review_note', { required: false, max: 1000 });
    const updated = await repository.update('security_anomalies', id, { review_status: reviewStatus, review_note: reviewNote || null, reviewed_by: req.user.id, reviewed_at: new Date() });
    await logAIEvent({ operation: OPERATIONS.SECURITY_REVIEW, user: req.user, model: aiService.model, modelVersion: aiService.version, output: { id, review_status: reviewStatus }, approvalMetadata: { reviewed_by: req.user.id }, metadata: { provider: 'local-deterministic-security-prototype' }, requestMeta: extractReqMeta(req) });
    return res.json({ success: true, message: 'Review status updated. No account was automatically blocked.', data: updated });
  } catch (error) { return fail(res, error); }
};

const analyzeAnomalies = async (req, res) => {
  try {
    const hospitalId = scope(req);
    const result = await securityAnomalyService.analyze(hospitalId);
    for (const anomaly of result.anomalies) {
      if (!anomaly.actor_id) continue;
      await require('../config/db').query(`INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)`, [req.user.id, 'Security Pattern Review Suggested', `An explainable aggregate access-pattern event requires human review (event #${anomaly.id}). No access was blocked.`, 'SECURITY_ALERT', anomaly.id]);
    }
    await logAIEvent({ operation: OPERATIONS.SECURITY_ANALYZE, user: req.user, model: 'robust-feature-distance', modelVersion: '1.0.0-demo', sourceIds: [], output: { run_id: result.run_id, records_analyzed: result.records_analyzed, anomalies_created: result.anomalies_created }, metadata: { provider: 'local-deterministic-security-prototype', evidence_count: result.records_analyzed }, requestMeta: extractReqMeta(req) });
    return res.status(201).json({ success: true, data: result });
  } catch (error) { return fail(res, error); }
};

const getAnalytics = async (req, res) => {
  try { return res.json({ success: true, data: await securityAnomalyService.analytics(scope(req)) }); }
  catch (error) { return fail(res, error); }
};

module.exports = { listAnomalies, getAnomaly, updateAnomaly, analyzeAnomalies, getAnalytics };
