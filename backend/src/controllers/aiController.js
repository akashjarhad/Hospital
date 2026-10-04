const crypto = require('crypto');
const repository = require('../repositories/aiRepository');
const aiService = require('../services/aiService');
const { authorizeTransferAI, authorizePatientAccess, AccessDeniedError } = require('../services/clinicalAccessPolicy');
const { loadPatientAggregate, projectByCategories, getSourceRecords, INFORMATION_NOT_AVAILABLE } = require('../services/patientAggregateService');
const { OPERATIONS, logAIEvent } = require('../services/aiAuditService');
const { extractReqMeta } = require('../utils/auditLogger');
const { ValidationError, positiveInt, boundedText, enumValue } = require('../utils/validation');

const HANDOVER_WARNING = 'AI-generated DEMO decision-support draft. Clinician review and explicit approval are required; this is not a diagnosis, prescription, or final transfer decision.';

function sourceIds(projected) {
  return getSourceRecords(projected).map(source => source.source_id);
}

function qualityIssueVisible(issue, access, user, transferId) {
  const currentCategories = new Set((access.categories || []).map(value => String(value)));
  const generatedCategories = issue.authorized_categories || [];
  if (!generatedCategories.every(category => currentCategories.has(String(category)))) return false;
  if (user.role === 'PATIENT') return access.accessMode === 'PATIENT_SELF';
  if (access.accessMode === 'DESTINATION_CONSENT') return Number(issue.transfer_id) === Number(transferId);
  if (access.accessMode === 'BREAK_GLASS_EMERGENCY') return false;
  return Number(issue.generated_by) === Number(user.id);
}

function responseError(res, error) {
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  return res.status(status).json({ success: false, message: status === 500 ? 'The AI decision-support operation could not be completed safely.' : error.message });
}

function aiEndpoint(operation, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const transferId = req.baseUrl.includes('/transfers') ? (Number(req.params.id) || null) : (Number(req.body?.transfer_id) || null);
      const patientParam = req.params.patientId || (req.baseUrl.includes('/patients') ? req.params.id : req.body?.patient_id);
      const patientId = Number(patientParam) || null;
      try {
        await logAIEvent({ operation, user: req.user, patientId, transferId, model: aiService.model, modelVersion: aiService.version, result: error instanceof AccessDeniedError ? 'DENIED' : 'FAILED', metadata: { provider: aiService.provider }, requestMeta: extractReqMeta(req) });
      } catch (auditError) {
        console.error('AI audit failure:', auditError.message);
      }
      console.error(`${operation} failed:`, error.message);
      return responseError(res, error);
    }
  };
}

async function transferProjection(user, transferId, action = 'READ') {
  const access = await authorizeTransferAI(user, transferId, action);
  const aggregate = await loadPatientAggregate(access.transfer.patient_id, access.recordScope);
  if (!aggregate) throw new AccessDeniedError('Patient record not found.', 404);
  const projected = projectByCategories(aggregate, access.categories);
  return { access, aggregate, projected, sources: sourceIds(projected) };
}

const generateHandover = aiEndpoint(OPERATIONS.HANDOVER_GENERATE, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const context = await transferProjection(req.user, transferId, 'WRITE');
  if (context.access.accessMode !== 'SOURCE_LOCAL_CARE') throw new AccessDeniedError('Only the assigned source doctor or legitimate local attending may generate the handover draft.');
  const output = await aiService.generateHandover({ projected: context.projected, transfer: context.access.transfer, emergency: false });
  const record = await repository.insert('ai_handover_summaries', {
    transfer_id: transferId,
    patient_id: context.access.transfer.patient_id,
    original_content: output,
    edited_content: null,
    status: 'DRAFT',
    model: aiService.model,
    model_version: aiService.version,
    source_ids: context.sources,
    generated_by: req.user.id,
    generated_at: new Date(),
    accuracy_confirmed: false
  });
  await logAIEvent({ operation: OPERATIONS.HANDOVER_GENERATE, user: req.user, patientId: record.patient_id, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids, output, metadata: { provider: aiService.provider, access_mode: context.access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, warning: HANDOVER_WARNING, data: record });
});

const getHandover = aiEndpoint(OPERATIONS.HANDOVER_VIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'READ');
  const record = await repository.findOne('ai_handover_summaries', { transfer_id: transferId }, { sortField: 'generated_at' });
  if (!record) return res.status(404).json({ success: false, message: 'No AI handover draft has been generated for this transfer.' });
  if (req.user.role === 'PATIENT' && record.status !== 'APPROVED') throw new AccessDeniedError('The handover is not available to the patient until a doctor approves it.');
  await logAIEvent({ operation: OPERATIONS.HANDOVER_VIEW, user: req.user, patientId: record.patient_id, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids || [], output: { id: record.id, status: record.status }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: HANDOVER_WARNING, data: record });
});

const updateHandover = aiEndpoint(OPERATIONS.HANDOVER_EDIT, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Only an authorized doctor may edit a handover.');
  const record = await repository.findOne('ai_handover_summaries', { transfer_id: transferId }, { sortField: 'generated_at' });
  if (!record) return res.status(404).json({ success: false, message: 'No AI handover draft has been generated.' });
  if (record.status === 'APPROVED') throw new ValidationError('Approved handovers cannot be edited; generate a new draft instead.');
  if (!req.body.edited_content || typeof req.body.edited_content !== 'object' || Array.isArray(req.body.edited_content)) throw new ValidationError('edited_content must be a JSON object.');
  if (Buffer.byteLength(JSON.stringify(req.body.edited_content)) > 20000) throw new ValidationError('edited_content must not exceed 20 KB.');
  const edited = { ...req.body.edited_content, safety: HANDOVER_WARNING };
  const updated = await repository.update('ai_handover_summaries', record.id, { edited_content: edited, status: 'EDITED', edited_by: req.user.id, edited_at: new Date(), approved_by: null, approved_at: null, accuracy_confirmed: false });
  await logAIEvent({ operation: OPERATIONS.HANDOVER_EDIT, user: req.user, patientId: record.patient_id, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids || [], output: edited, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: HANDOVER_WARNING, data: updated });
});

const approveHandover = aiEndpoint(OPERATIONS.HANDOVER_APPROVE, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Only an authorized doctor may approve a handover.');
  if (req.body.accuracy_confirmed !== true) throw new ValidationError('Explicit accuracy_confirmed=true is required for approval.');
  const record = await repository.findOne('ai_handover_summaries', { transfer_id: transferId }, { sortField: 'generated_at' });
  if (!record) return res.status(404).json({ success: false, message: 'No AI handover draft has been generated.' });
  const updated = await repository.update('ai_handover_summaries', record.id, { status: 'APPROVED', approved_by: req.user.id, approved_at: new Date(), accuracy_confirmed: true });
  await logAIEvent({ operation: OPERATIONS.HANDOVER_APPROVE, user: req.user, patientId: record.patient_id, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids || [], output: { id: record.id, status: 'APPROVED' }, approvalMetadata: { approved_by: req.user.id, accuracy_confirmed: true, approved_at: updated.approved_at }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: HANDOVER_WARNING, data: updated });
});

const generateRelevance = aiEndpoint(OPERATIONS.RELEVANCE_ANALYZE, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const context = await transferProjection(req.user, transferId, 'WRITE');
  const output = await aiService.analyzeRelevance({ projected: context.projected, transfer: context.access.transfer, emergency: false });
  const rows = [];
  for (const suggestion of output.suggestions || []) rows.push(await repository.insert('ai_record_relevance', {
    transfer_id: transferId, patient_id: context.access.transfer.patient_id, source_id: suggestion.source_id, resource_type: suggestion.resource_type,
    reason: suggestion.reason, suggested_relevant: Boolean(suggestion.suggested_relevant), selected: null, review_status: 'SUGGESTED', model: aiService.model,
    model_version: aiService.version, generated_by: req.user.id, created_at: new Date()
  }));
  await logAIEvent({ operation: OPERATIONS.RELEVANCE_ANALYZE, user: req.user, patientId: context.access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: context.sources, output, metadata: { provider: aiService.provider, access_mode: context.access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, warning: HANDOVER_WARNING, data: rows });
});

const getRelevance = aiEndpoint(OPERATIONS.RELEVANCE_VIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'READ');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Relevance selection is available to authorized doctors only.');
  const rows = await repository.find('ai_record_relevance', { transfer_id: transferId });
  await logAIEvent({ operation: OPERATIONS.RELEVANCE_VIEW, user: req.user, patientId: access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: rows.map(row => row.source_id), output: { count: rows.length }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: 'Suggestions do not alter source records or patient consent. The doctor remains the selector.', data: rows });
});

const updateRelevance = aiEndpoint(OPERATIONS.RELEVANCE_REVIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Only an authorized doctor may review relevance suggestions.');
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length || items.length > 100) throw new ValidationError('items must contain between 1 and 100 relevance updates.');
  const updated = [];
  for (const item of items) {
    const id = positiveInt(item.id, 'relevance item id');
    const existing = await repository.findOne('ai_record_relevance', { id, transfer_id: transferId });
    if (!existing) throw new ValidationError(`Relevance item ${id} does not belong to this transfer.`);
    const reviewStatus = enumValue(item.review_status || 'REVIEWED', 'review_status', ['REVIEWED', 'DISMISSED']);
    updated.push(await repository.update('ai_record_relevance', id, { selected: reviewStatus === 'DISMISSED' ? false : Boolean(item.selected), review_status: reviewStatus, reviewed_by: req.user.id, reviewed_at: new Date() }));
  }
  await logAIEvent({ operation: OPERATIONS.RELEVANCE_REVIEW, user: req.user, patientId: access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: updated.map(row => row.source_id), output: updated.map(row => ({ id: row.id, selected: row.selected, review_status: row.review_status })), approvalMetadata: { reviewed_by: req.user.id }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, message: 'Review state updated. Source clinical records and consent were not changed.', data: updated });
});

const generateCriticalInformation = aiEndpoint(OPERATIONS.CRITICAL_EXTRACT, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const context = await transferProjection(req.user, transferId, 'WRITE');
  const output = await aiService.extractCriticalInformation({ projected: context.projected, transfer: context.access.transfer, emergency: false });
  const rows = [];
  for (const item of output.items || []) rows.push(await repository.insert('ai_critical_information', {
    transfer_id: transferId, patient_id: context.access.transfer.patient_id, source_id: item.source_id, resource_type: item.resource_type,
    source_date: item.source_date, label: item.label, value: item.value, confidence_descriptor: item.confidence_descriptor, status: 'UNCONFIRMED',
    edited_value: null, model: aiService.model, model_version: aiService.version, generated_by: req.user.id, created_at: new Date()
  }));
  await logAIEvent({ operation: OPERATIONS.CRITICAL_EXTRACT, user: req.user, patientId: context.access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: context.sources, output, metadata: { provider: aiService.provider, access_mode: context.access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, warning: HANDOVER_WARNING, unavailable_message: output.unavailable_message, data: rows });
});

const getCriticalInformation = aiEndpoint(OPERATIONS.CRITICAL_VIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'READ');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Critical-information review is available to authorized doctors only.');
  const rows = await repository.find('ai_critical_information', { transfer_id: transferId });
  await logAIEvent({ operation: OPERATIONS.CRITICAL_VIEW, user: req.user, patientId: access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: rows.map(row => row.source_id), output: { count: rows.length }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: HANDOVER_WARNING, data: rows });
});

const updateCriticalInformation = aiEndpoint(OPERATIONS.CRITICAL_REVIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'WRITE');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Only an authorized doctor may review critical-information items.');
  const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
  if (!items.length || items.length > 100) throw new ValidationError('Provide between 1 and 100 item updates.');
  const updated = [];
  for (const item of items) {
    const id = positiveInt(item.id, 'critical-information item id');
    const existing = await repository.findOne('ai_critical_information', { id, transfer_id: transferId });
    if (!existing) throw new ValidationError(`Critical-information item ${id} does not belong to this transfer.`);
    const status = enumValue(item.status, 'status', ['CONFIRMED', 'EDITED', 'DISMISSED']);
    const editedValue = status === 'EDITED' ? boundedText(item.edited_value, 'edited_value', { max: 2000 }) : existing.edited_value;
    updated.push(await repository.update('ai_critical_information', id, { status, edited_value: editedValue, reviewed_by: req.user.id, reviewed_at: new Date() }));
  }
  await logAIEvent({ operation: OPERATIONS.CRITICAL_REVIEW, user: req.user, patientId: access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: updated.map(row => row.source_id), output: updated.map(row => ({ id: row.id, status: row.status })), approvalMetadata: { reviewed_by: req.user.id }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, message: 'Review state updated; no source clinical record was changed.', data: updated });
});

const calculateComplexity = aiEndpoint(OPERATIONS.TRANSFER_COMPLEXITY, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const context = await transferProjection(req.user, transferId, 'WRITE');
  const output = await aiService.calculateTransferComplexity({ projected: context.projected, transfer: context.access.transfer, emergency: false });
  const record = await repository.insert('transfer_complexity_results', { transfer_id: transferId, patient_id: context.access.transfer.patient_id, level: output.level, factors: output.factors, model: aiService.model, model_version: aiService.version, source_ids: context.sources, generated_by: req.user.id, created_at: new Date() });
  await logAIEvent({ operation: OPERATIONS.TRANSFER_COMPLEXITY, user: req.user, patientId: record.patient_id, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids, output, metadata: { provider: aiService.provider, access_mode: context.access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, warning: output.safety, data: { ...record, transparent_score: output.transparent_score, scoring_note: output.scoring_note } });
});

const getComplexity = aiEndpoint(OPERATIONS.TRANSFER_COMPLEXITY_VIEW, async (req, res) => {
  const transferId = positiveInt(req.params.id, 'transfer id');
  const access = await authorizeTransferAI(req.user, transferId, 'READ');
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Complexity workflow assistance is available to authorized doctors only.');
  const rows = await repository.find('transfer_complexity_results', { transfer_id: transferId });
  await logAIEvent({ operation: OPERATIONS.TRANSFER_COMPLEXITY_VIEW, user: req.user, patientId: access.transfer.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: rows.flatMap(row => row.source_ids || []), output: { count: rows.length }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, warning: 'Workflow assistance only; results are not clinical risk probabilities or final decisions.', data: rows });
});

function retainedQuery(question) {
  const mode = String(process.env.AI_SEARCH_RETENTION || 'redacted').toLowerCase();
  if (mode === 'none' || mode === 'hash') return null;
  if (mode === 'full') return question;
  const concepts = ['allerg', 'medicat', 'diagnos', 'condition', 'test', 'lab', 'result', 'imaging', 'history', 'contact'].filter(term => question.toLowerCase().includes(term));
  return `[REDACTED_QUERY${concepts.length ? `: ${concepts.join(',')}` : ''}]`;
}

const searchPatientRecord = aiEndpoint(OPERATIONS.RECORD_SEARCH, async (req, res) => {
  const patientId = positiveInt(req.params.id, 'patient id');
  const question = boundedText(req.body.question, 'question', { min: 3, max: 500 });
  const transferId = req.body.transfer_id ? positiveInt(req.body.transfer_id, 'transfer_id') : null;
  const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
  const aggregate = await loadPatientAggregate(patientId, access.recordScope);
  if (!aggregate) throw new AccessDeniedError('Patient record not found.', 404);
  const projected = projectByCategories(aggregate, access.categories);
  const output = await aiService.answerRecordQuestion({ projected, question, transfer: access.transfer, emergency: Boolean(access.emergency) });
  const queryHash = crypto.createHash('sha256').update(question).digest('hex');
  const record = await repository.insert('ai_search_logs', { patient_id: patientId, transfer_id: transferId, actor_id: req.user.id, query_text: retainedQuery(question), query_hash: queryHash, answer: output, source_ids: output.source_references || [], evidence_count: output.evidence_count || 0, model: aiService.model, model_version: aiService.version, created_at: new Date() });
  await logAIEvent({ operation: OPERATIONS.RECORD_SEARCH, user: req.user, patientId, transferId, model: record.model, modelVersion: record.model_version, sourceIds: record.source_ids, output, metadata: { provider: aiService.provider, access_mode: access.accessMode, evidence_count: record.evidence_count, emergency_session_id: access.emergency?.id }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, warning: output.safety, data: { id: record.id, answer: output.answer || INFORMATION_NOT_AVAILABLE, evidence: output.evidence || [], evidence_count: output.evidence_count || 0, source_references: output.source_references || [], model: record.model, model_version: record.model_version, label: output.label || output.provider_notice } });
});

const getSearchHistory = aiEndpoint(OPERATIONS.SEARCH_HISTORY_VIEW, async (req, res) => {
  const patientId = positiveInt(req.params.id, 'patient id');
  const transferId = req.query.transfer_id ? positiveInt(req.query.transfer_id, 'transfer_id') : null;
  const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
  let rows = await repository.find('ai_search_logs', { patient_id: patientId, actor_id: req.user.id });
  if (transferId) rows = rows.filter(row => Number(row.transfer_id) === transferId);
  await logAIEvent({ operation: OPERATIONS.SEARCH_HISTORY_VIEW, user: req.user, patientId, transferId, model: aiService.model, modelVersion: aiService.version, output: { count: rows.length }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, query_retention: process.env.AI_SEARCH_RETENTION || 'redacted', data: rows });
});

const checkDataQuality = aiEndpoint(OPERATIONS.DATA_QUALITY_CHECK, async (req, res) => {
  const patientId = positiveInt(req.params.id, 'patient id');
  const transferId = req.body.transfer_id ? positiveInt(req.body.transfer_id, 'transfer_id') : null;
  const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
  const aggregate = await loadPatientAggregate(patientId, access.recordScope);
  if (!aggregate) throw new AccessDeniedError('Patient record not found.', 404);
  const projected = projectByCategories(aggregate, access.categories);
  const output = await aiService.analyzeDataQuality({ projected, emergency: Boolean(access.emergency) });
  const runId = `DQ-${Date.now()}-${crypto.createHash('sha256').update(`${patientId}:${req.user.id}:${output.score}`).digest('hex').slice(0, 8)}`;
  const issueInput = output.issues.length ? output.issues : [{ issue_type: 'SUMMARY', severity: 'INFO', description: 'No quality issue was identified by this deterministic demo check.', source_ids: [], conflict_values: [] }];
  const rows = [];
  for (const issue of issueInput) rows.push(await repository.insert('data_quality_issues', { patient_id: patientId, transfer_id: transferId, generated_by: req.user.id, authorized_categories: projected.permitted_categories || [], access_mode: access.accessMode, check_run_id: runId, issue_type: issue.issue_type, severity: issue.severity, description: issue.description, source_ids: issue.source_ids || [], conflict_values: issue.conflict_values || [], score_breakdown: { ...output.score_breakdown, total: output.score }, review_status: 'OPEN', created_at: new Date() }));
  await logAIEvent({ operation: OPERATIONS.DATA_QUALITY_CHECK, user: req.user, patientId, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: sourceIds(projected), output, metadata: { provider: aiService.provider, access_mode: access.accessMode, emergency_session_id: access.emergency?.id }, requestMeta: extractReqMeta(req) });
  return res.status(201).json({ success: true, label: output.label || output.provider_notice, warning: `${output.safety} Data-quality findings never modify clinical data automatically.`, check_run_id: runId, score: output.score, score_breakdown: output.score_breakdown, data: rows });
});

const getDataQuality = aiEndpoint(OPERATIONS.DATA_QUALITY_VIEW, async (req, res) => {
  const patientId = positiveInt(req.params.id, 'patient id');
  const transferId = req.query.transfer_id ? positiveInt(req.query.transfer_id, 'transfer_id') : null;
  const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
  let rows = await repository.find('data_quality_issues', { patient_id: patientId });
  rows = rows.filter(issue => qualityIssueVisible(issue, access, req.user, transferId));
  await logAIEvent({ operation: OPERATIONS.DATA_QUALITY_VIEW, user: req.user, patientId, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: rows.flatMap(row => row.source_ids || []), output: { count: rows.length }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, label: aiService.provider === 'mock' ? 'DEMO — persisted mock data-quality findings.' : 'External-provider persisted findings.', warning: 'Review-only findings; clinical data is never changed automatically.', data: rows });
});

const updateDataQualityIssue = aiEndpoint(OPERATIONS.DATA_QUALITY_REVIEW, async (req, res) => {
  const issueId = positiveInt(req.params.id, 'data-quality issue id');
  const issue = await repository.findOne('data_quality_issues', { id: issueId });
  if (!issue) return res.status(404).json({ success: false, message: 'Data-quality issue not found.' });
  const transferId = req.body.transfer_id || issue.transfer_id || null;
  const access = await authorizePatientAccess(req.user, issue.patient_id, { transferId, allowEmergency: false });
  if (req.user.role !== 'DOCTOR') throw new AccessDeniedError('Only an authorized doctor may review or verify a data-quality issue.');
  if (!qualityIssueVisible(issue, access, req.user, transferId)) throw new AccessDeniedError('This derived quality finding was generated outside the current authorized transfer/category scope.');
  const reviewStatus = enumValue(req.body.review_status, 'review_status', ['REVIEWED', 'VERIFIED', 'IGNORED']);
  const reviewNote = boundedText(req.body.review_note, 'review_note', { required: false, max: 1000 });
  const updated = await repository.update('data_quality_issues', issueId, { review_status: reviewStatus, reviewed_by: req.user.id, reviewed_at: new Date(), review_note: reviewNote || null });
  await logAIEvent({ operation: OPERATIONS.DATA_QUALITY_REVIEW, user: req.user, patientId: issue.patient_id, transferId, model: aiService.model, modelVersion: aiService.version, sourceIds: issue.source_ids || [], output: { id: issueId, review_status: reviewStatus }, approvalMetadata: { reviewed_by: req.user.id }, metadata: { provider: aiService.provider, access_mode: access.accessMode }, requestMeta: extractReqMeta(req) });
  return res.json({ success: true, message: 'Review state updated; no clinical source data was changed.', data: updated });
});

module.exports = { generateHandover, getHandover, updateHandover, approveHandover, generateRelevance, getRelevance, updateRelevance, generateCriticalInformation, getCriticalInformation, updateCriticalInformation, calculateComplexity, getComplexity, searchPatientRecord, getSearchHistory, checkDataQuality, getDataQuality, updateDataQualityIssue };
