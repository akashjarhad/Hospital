const crypto = require('crypto');
const repository = require('../repositories/aiRepository');
const { recordAuditLog } = require('../utils/auditLogger');

const OPERATIONS = Object.freeze({
  HANDOVER_GENERATE: 'AI_HANDOVER_GENERATE',
  HANDOVER_VIEW: 'AI_HANDOVER_VIEW',
  HANDOVER_EDIT: 'AI_HANDOVER_EDIT',
  HANDOVER_APPROVE: 'AI_HANDOVER_APPROVE',
  RELEVANCE_ANALYZE: 'AI_RELEVANCE_ANALYZE',
  RELEVANCE_VIEW: 'AI_RELEVANCE_VIEW',
  RELEVANCE_REVIEW: 'AI_RELEVANCE_REVIEW',
  CRITICAL_EXTRACT: 'AI_CRITICAL_INFORMATION_EXTRACT',
  CRITICAL_VIEW: 'AI_CRITICAL_INFORMATION_VIEW',
  CRITICAL_REVIEW: 'AI_CRITICAL_INFORMATION_REVIEW',
  DATA_QUALITY_CHECK: 'AI_DATA_QUALITY_CHECK',
  DATA_QUALITY_VIEW: 'AI_DATA_QUALITY_VIEW',
  DATA_QUALITY_REVIEW: 'AI_DATA_QUALITY_REVIEW',
  TRANSFER_COMPLEXITY: 'AI_TRANSFER_COMPLEXITY',
  TRANSFER_COMPLEXITY_VIEW: 'AI_TRANSFER_COMPLEXITY_VIEW',
  RECORD_SEARCH: 'AI_RECORD_SEARCH',
  SEARCH_HISTORY_VIEW: 'AI_SEARCH_HISTORY_VIEW',
  SECURITY_ANALYZE: 'AI_SECURITY_ANOMALY_ANALYZE',
  SECURITY_REVIEW: 'AI_SECURITY_ANOMALY_REVIEW'
});

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function outputHash(output) {
  return crypto.createHash('sha256').update(stableStringify(output ?? null)).digest('hex');
}

async function logAIEvent({ operation, user, patientId = null, transferId = null, model = 'unknown', modelVersion = 'unknown', sourceIds = [], output = null, result = 'SUCCESS', approvalMetadata = {}, metadata = {}, requestMeta = {} }) {
  const hash = outputHash(output);
  const minimizedMetadata = {
    access_mode: metadata.access_mode || null,
    evidence_count: Number(metadata.evidence_count || sourceIds.length || 0),
    provider: metadata.provider || null,
    emergency_session_id: metadata.emergency_session_id || null
  };
  const event = await repository.insert('ai_audit_events', {
    operation,
    actor_id: user?.id || null,
    patient_id: patientId,
    transfer_id: transferId,
    model,
    model_version: modelVersion,
    source_ids: sourceIds,
    output_hash: hash,
    result,
    approval_metadata: approvalMetadata,
    metadata: minimizedMetadata
  });
  await recordAuditLog({
    userId: user?.id || null,
    role: user?.role || 'ANONYMOUS',
    action: operation,
    patientId,
    transferId,
    purpose: 'Consent-aware AI decision-support operation',
    result,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    metadata: { ai_audit_event_id: event.id, output_hash: hash, model, model_version: modelVersion, source_count: sourceIds.length, ...minimizedMetadata }
  });
  return event;
}

module.exports = { OPERATIONS, outputHash, logAIEvent };
