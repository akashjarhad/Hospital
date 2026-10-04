const { INFORMATION_NOT_AVAILABLE, getSourceRecords, resourceTypeForTest } = require('./patientAggregateService');

const MOCK_MODEL = 'medtransfer-grounded-mock';
const MOCK_VERSION = '1.0.0';
const MOCK_LABEL = 'DEMO — deterministic mock output generated only from authorized records.';
const SAFETY = 'Decision-support draft only. A qualified clinician must verify accuracy. This output does not diagnose, prescribe, or make a final clinical or transfer decision.';

class AIProviderError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'AIProviderError';
    this.status = status;
  }
}

function available(value) {
  return value !== undefined && value !== null && value !== '' ? value : INFORMATION_NOT_AVAILABLE;
}

function sourceIds(projected) {
  return getSourceRecords(projected).map(source => source.source_id);
}

function latestVisit(projected) {
  return (projected.visits || []).slice().sort((a, b) => new Date(b.admission_date || 0) - new Date(a.admission_date || 0))[0] || null;
}

function tests(projected) {
  return (projected.visits || []).flatMap(visit => (visit.tests || []).map(test => ({ ...test, visit_id: visit.id })));
}

function mockHandover({ projected, transfer }) {
  const visit = latestVisit(projected);
  const recentTests = tests(projected).slice(0, 6).map(test => {
    const resourceType = resourceTypeForTest(test);
    return `${test.test_name}: ${test.result}${test.units ? ` ${test.units}` : ''} [${resourceType}/${test.id}]`;
  });
  const medications = (projected.medications || []).filter(medication => medication.is_current).map(medication => `${medication.medication_name} ${medication.dosage} ${medication.frequency} [MedicationRequest/${medication.id}]`);
  return {
    label: MOCK_LABEL,
    safety: SAFETY,
    sections: {
      patient: projected.name ? `${projected.name}${projected.unique_health_id ? ` (${projected.unique_health_id})` : ''}` : INFORMATION_NOT_AVAILABLE,
      current_situation: available(visit?.diagnosis),
      presenting_context: available(visit?.chief_complaint),
      medical_history: available(projected.medical_history),
      allergies: available(projected.allergies || projected.allergy_records?.map(item => item.substance).join(', ')),
      current_medications: medications.length ? medications : INFORMATION_NOT_AVAILABLE,
      recent_results: recentTests.length ? recentTests : INFORMATION_NOT_AVAILABLE,
      transfer_reason: available(transfer?.transfer_reason)
    },
    source_references: sourceIds(projected)
  };
}

function mockCritical({ projected }) {
  const items = [];
  if (projected.allergies) items.push({ source_id: `Patient/${projected.id}`, resource_type: 'Patient', source_date: null, label: 'Recorded allergies', value: projected.allergies, confidence_descriptor: 'DIRECT_RECORD_FIELD' });
  for (const allergy of projected.allergy_records || []) items.push({ source_id: `AllergyIntolerance/${allergy.id}`, resource_type: 'AllergyIntolerance', source_date: allergy.diagnosed_at || null, label: 'Recorded allergy or intolerance', value: [allergy.substance, allergy.reaction_type, allergy.severity].filter(Boolean).join(' — '), confidence_descriptor: 'DIRECT_STRUCTURED_RECORD' });
  for (const medication of (projected.medications || []).filter(item => item.is_current)) items.push({ source_id: `MedicationRequest/${medication.id}`, resource_type: 'MedicationRequest', source_date: medication.prescribed_at || null, label: 'Current recorded medication', value: `${medication.medication_name} ${medication.dosage} ${medication.frequency}`.trim(), confidence_descriptor: 'DIRECT_STRUCTURED_RECORD' });
  for (const test of tests(projected).filter(item => item.abnormal)) {
    const resourceType = resourceTypeForTest(test);
    items.push({ source_id: `${resourceType}/${test.id}`, resource_type: resourceType, source_date: test.timestamp || null, label: 'Result marked abnormal in source record', value: `${test.test_name}: ${test.result}${test.units ? ` ${test.units}` : ''}`, confidence_descriptor: 'SOURCE_FLAGGED_ABNORMAL' });
  }
  return { label: MOCK_LABEL, safety: SAFETY, items, unavailable_message: items.length ? null : INFORMATION_NOT_AVAILABLE };
}

function mockRelevance({ projected, transfer }) {
  const reasonByType = {
    Patient: 'Contains an authorized patient-level field in the transfer scope.',
    Encounter: 'Contains authorized encounter context for the current transfer.',
    Observation: 'Contains an authorized recorded result; clinician must decide whether to include it.',
    DiagnosticReport: 'Contains authorized diagnostic report metadata or result context.',
    MedicationRequest: 'Contains an authorized medication record for clinician review.',
    AllergyIntolerance: 'Contains an authorized allergy/intolerance record for clinician review.',
    DocumentReference: 'Contains authorized document metadata; document content was not inferred.'
  };
  return {
    label: MOCK_LABEL,
    safety: SAFETY,
    suggestions: getSourceRecords(projected).map(source => ({ ...source, suggested_relevant: source.resource_type !== 'DocumentReference' || /summary|report/i.test(source.fields.join(' ')), reason: `${reasonByType[source.resource_type] || 'Authorized source available for clinician review'} Transfer purpose: ${available(transfer?.transfer_reason)}` }))
  };
}

function mockSearch({ projected, question }) {
  const normalized = question.toLowerCase();
  const evidence = [];
  const add = (text, source_id) => { if (text && text !== INFORMATION_NOT_AVAILABLE) evidence.push({ text, source_id }); };
  if (/allerg|reaction/.test(normalized)) add(projected.allergies, `Patient/${projected.id}`);
  if (/medicat|drug|prescri/.test(normalized)) for (const item of projected.medications || []) add(`${item.medication_name} ${item.dosage} ${item.frequency}`.trim(), `MedicationRequest/${item.id}`);
  if (/diagnos|condition|complaint|visit|encounter/.test(normalized)) for (const item of projected.visits || []) add([item.diagnosis, item.chief_complaint].filter(Boolean).join(' — '), `Encounter/${item.id}`);
  if (/test|lab|result|observation|imaging|scan|x-ray/.test(normalized)) for (const item of tests(projected)) { const resourceType = resourceTypeForTest(item); add(`${item.test_name}: ${item.result}${item.units ? ` ${item.units}` : ''}`, `${resourceType}/${item.id}`); }
  if (/history|prior|medical/.test(normalized)) add(projected.medical_history, `Patient/${projected.id}`);
  if (/contact|phone/.test(normalized)) add([projected.emergency_contact_name, projected.emergency_contact_phone].filter(Boolean).join(' — '), `Patient/${projected.id}`);
  const unique = evidence.filter((item, index, array) => array.findIndex(other => other.source_id === item.source_id && other.text === item.text) === index).slice(0, 12);
  return {
    label: MOCK_LABEL,
    safety: SAFETY,
    answer: unique.length ? unique.map(item => `${item.text} [${item.source_id}]`).join('\n') : INFORMATION_NOT_AVAILABLE,
    evidence: unique,
    evidence_count: unique.length,
    source_references: unique.map(item => item.source_id)
  };
}

function mockDataQuality({ projected }) {
  const permitted = new Set(projected.permitted_categories || []);
  const expectedFields = [];
  if (permitted.has('Patient Demographics')) expectedFields.push('name', 'dob', 'gender', 'blood_group');
  if (permitted.has('Emergency Contact')) expectedFields.push('emergency_contact_name', 'emergency_contact_phone');
  if (permitted.has('Medical History')) expectedFields.push('medical_history');
  if (permitted.has('Allergies')) expectedFields.push('allergies');
  if (permitted.has('Current Diagnosis')) expectedFields.push('current_diagnosis');
  const present = expectedFields.filter(field => projected[field] !== undefined && projected[field] !== null && projected[field] !== '').length;
  const allTests = tests(projected);
  const groups = new Map();
  for (const test of allTests) {
    const name = String(test.test_name || '').trim().toLowerCase();
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(test);
  }
  const duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);
  const conflictingGroups = duplicateGroups.filter(([, items]) => new Set(items.map(item => String(item.result || '').trim())).size > 1);
  const dates = [
    ...(projected.visits || []).flatMap(visit => [visit.admission_date, ...(visit.tests || []).map(test => test.timestamp)]),
    ...(projected.medications || []).map(item => item.prescribed_at),
    ...(projected.documents || []).map(item => item.created_at)
  ].filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
  const ageDays = dates.length ? Math.max(0, (Date.now() - Math.max(...dates)) / 86400000) : null;
  const completeness = expectedFields.length ? Math.round((present / expectedFields.length) * 100) : 100;
  const consistency = Math.max(0, 100 - conflictingGroups.length * 25);
  const recency = ageDays === null ? 0 : ageDays <= 30 ? 100 : ageDays <= 180 ? 70 : ageDays <= 365 ? 40 : 20;
  const duplication = Math.max(0, 100 - duplicateGroups.length * 20);
  const total = Math.round((completeness + consistency + recency + duplication) / 4);
  const issues = [];
  for (const field of expectedFields.filter(field => projected[field] === undefined || projected[field] === null || projected[field] === '')) issues.push({ issue_type: 'COMPLETENESS', severity: 'LOW', description: `Authorized field ${field} is not available.`, source_ids: [`Patient/${projected.id}`], conflict_values: [] });
  for (const [name, items] of duplicateGroups) {
    const conflictValues = [...new Set(items.map(item => item.result))];
    issues.push({ issue_type: conflictingGroups.some(([conflictName]) => conflictName === name) ? 'CONSISTENCY' : 'DUPLICATION', severity: conflictValues.length > 1 ? 'HIGH' : 'MODERATE', description: `Multiple authorized results share the recorded test name "${name}"; clinician review is required.`, source_ids: items.map(item => `${resourceTypeForTest(item)}/${item.id}`), conflict_values: conflictValues });
  }
  if (ageDays === null) issues.push({ issue_type: 'RECENCY', severity: 'MODERATE', description: 'No authorized dated record is available for recency assessment.', source_ids: [], conflict_values: [] });
  return { label: MOCK_LABEL, safety: SAFETY, score: total, score_breakdown: { completeness, consistency, recency, duplication, calculation: 'Equal-weight mean of four 0-100 components.', component_notes: { completeness: `Checks only ${expectedFields.length} fields authorized by the current category scope.`, consistency: `${conflictingGroups.length} conflicting duplicate result group(s) detected.`, recency: ageDays === null ? 'No authorized dated record available.' : `Most recent authorized record is ${ageDays.toFixed(1)} day(s) old.`, duplication: `${duplicateGroups.length} duplicate test-name group(s) detected.` } }, issues };
}

function mockComplexity({ projected, transfer }) {
  const factors = [];
  if (transfer?.clinical_priority === 'EMERGENCY') factors.push({ factor: 'Transfer priority', value: 'EMERGENCY', weight: 2, source_id: `Transfer/${transfer.id}` });
  else if (transfer?.clinical_priority === 'URGENT') factors.push({ factor: 'Transfer priority', value: 'URGENT', weight: 1, source_id: `Transfer/${transfer.id}` });
  const visit = latestVisit(projected);
  if (visit?.status === 'critical') factors.push({ factor: 'Recorded encounter status', value: 'critical', weight: 2, source_id: `Encounter/${visit.id}` });
  const abnormalCount = tests(projected).filter(item => item.abnormal).length;
  if (abnormalCount) factors.push({ factor: 'Source-flagged abnormal results', value: abnormalCount, weight: abnormalCount >= 3 ? 2 : 1, source_id: 'Authorized Observation set' });
  if ((projected.medications || []).filter(item => item.is_current).length >= 3) factors.push({ factor: 'Current medication record count', value: projected.medications.filter(item => item.is_current).length, weight: 1, source_id: 'Authorized MedicationRequest set' });
  const score = factors.reduce((sum, factor) => sum + factor.weight, 0);
  return { label: MOCK_LABEL, safety: `${SAFETY} Workflow assistance only; complexity is not a clinical risk probability.`, level: score >= 5 ? 'HIGH' : score >= 2 ? 'MODERATE' : 'LOW', factors, transparent_score: score, scoring_note: 'DEMO additive workflow-complexity heuristic: LOW 0-1, MODERATE 2-4, HIGH 5+.' };
}

function minimizeExternalPayload(payload) {
  const transfer = payload.transfer ? { id: payload.transfer.id, transfer_reason: payload.transfer.transfer_reason, clinical_priority: payload.transfer.clinical_priority } : null;
  return { projected: payload.projected, question: payload.question, transfer };
}

function validateExternalOutput(operation, output, payload) {
  if (!output || typeof output !== 'object' || Array.isArray(output) || Buffer.byteLength(JSON.stringify(output)) > 50000) throw new Error('Invalid provider response');
  const requiredShapes = {
    generateHandover: () => output.sections && typeof output.sections === 'object' && Array.isArray(output.source_references),
    extractCriticalInformation: () => Array.isArray(output.items),
    analyzeRelevance: () => Array.isArray(output.suggestions),
    answerRecordQuestion: () => typeof output.answer === 'string' && Array.isArray(output.evidence) && Number.isInteger(output.evidence_count),
    analyzeDataQuality: () => Number.isFinite(output.score) && output.score_breakdown && Array.isArray(output.issues),
    calculateTransferComplexity: () => ['LOW', 'MODERATE', 'HIGH'].includes(output.level) && Array.isArray(output.factors)
  };
  if (!requiredShapes[operation]?.()) throw new Error('Provider response failed operation schema validation');
  if (operation === 'answerRecordQuestion' && (output.evidence_count !== output.evidence.length || (output.evidence_count === 0 && output.answer !== INFORMATION_NOT_AVAILABLE))) throw new Error('Provider response failed grounded no-evidence validation');
  const allowedSources = new Set(getSourceRecords(payload.projected).map(source => source.source_id));
  if (payload.transfer?.id) allowedSources.add(`Transfer/${payload.transfer.id}`);
  const referenced = [
    ...(output.source_references || []),
    ...(output.evidence || []).map(item => item.source_id),
    ...(output.items || []).map(item => item.source_id),
    ...(output.suggestions || []).map(item => item.source_id),
    ...(output.issues || []).flatMap(item => item.source_ids || []),
    ...(output.factors || []).map(item => item.source_id)
  ].filter(Boolean);
  if (referenced.some(source => !allowedSources.has(source))) throw new Error('Provider cited a source outside the authorized record set');
  return output;
}

class AIService {
  constructor() {
    this.provider = String(process.env.AI_PROVIDER || 'mock').toLowerCase();
    this.model = this.provider === 'mock' ? MOCK_MODEL : (process.env.AI_MODEL || 'external-model');
    this.version = this.provider === 'mock' ? MOCK_VERSION : (process.env.AI_MODEL_VERSION || 'provider-managed');
  }

  async run(operation, payload, mockFunction) {
    if (this.provider === 'mock') return mockFunction(payload);
    if (payload.emergency) return mockFunction(payload);
    if (String(process.env.AI_EXTERNAL_ENABLED || '').toLowerCase() !== 'true') return mockFunction(payload);
    try {
      return await this.callExternal(operation, payload);
    } catch (error) {
      console.warn(`[AI Engine] External provider failed for ${operation}: ${error.message}. Using deterministic grounded RAG fallback.`);
      const fallbackResult = mockFunction(payload);
      return { ...fallbackResult, provider_notice: `Grounded RAG Fallback (${error.message.substring(0, 80)})`, safety: SAFETY };
    }
  }

  async callExternal(operation, payload) {
    const url = process.env.AI_BASE_URL || 'http://localhost:11434/v1';
    const apiKey = process.env.AI_API_KEY || 'ollama';
    const timeoutMs = Math.min(Math.max(Number(process.env.AI_TIMEOUT_MS) || 60000, 1000), 120000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const systemPrompts = {
      answerRecordQuestion: `You are the MedTransfer Clinical Grounded RAG Assistant. Answer the question using ONLY the provided authorized patient records.
CRITICAL RULES:
1. Every medical fact, diagnosis, allergy, or lab result in your answer MUST cite its exact source ID in brackets, e.g. [Patient/1], [MedicationRequest/2], [Observation/3].
2. If the requested information is not in the records, set "answer" to "${INFORMATION_NOT_AVAILABLE}".
3. Do not diagnose, speculate, or recommend unprescribed medications.
4. Return pure JSON matching this exact schema:
{
  "answer": "Clear concise clinical answer with bracketed source citations [SourceID]",
  "evidence": [{"text": "Extracted fact from record", "source_id": "ExactSourceID"}],
  "evidence_count": 1,
  "source_references": ["ExactSourceID"]
}`,
      generateHandover: `You are the MedTransfer Clinical Handover Summarizer. Summarize the authorized patient data into a structured SBAR clinical transfer draft.
Return pure JSON with schema:
{
  "sections": {
    "patient": "Name and identifiers",
    "current_situation": "Admission diagnosis or chief complaint",
    "presenting_context": "Clinical history and background",
    "medical_history": "Past chronic conditions",
    "allergies": "Documented allergies",
    "current_medications": ["Medication A [MedicationRequest/1]"],
    "recent_results": ["Test A: Result [Observation/1]"],
    "transfer_reason": "Reason for transfer"
  },
  "source_references": ["SourceID1", "SourceID2"]
}`,
      extractCriticalInformation: `Extract all critical clinical entities (allergies, current medications, abnormal labs) from authorized records.
Return pure JSON with schema:
{
  "items": [
    {
      "source_id": "SourceID",
      "resource_type": "Patient|MedicationRequest|AllergyIntolerance|Observation",
      "source_date": "YYYY-MM-DD or null",
      "label": "Entity description",
      "value": "Value or dosage",
      "confidence_descriptor": "DIRECT_STRUCTURED_RECORD"
    }
  ]
}`
    };

    const sysPrompt = systemPrompts[operation] || `Return JSON for ${operation}. Use only supplied authorized records and cite only supplied source IDs. State unavailable information exactly as: ${INFORMATION_NOT_AVAILABLE} Do not diagnose, prescribe, or make final decisions.`;

    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: JSON.stringify(minimizeExternalPayload(payload)) }
          ],
          temperature: 0.1
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new AIProviderError(`External AI provider returned status ${response.status}.`, response.status);
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      if (!content) throw new AIProviderError('External AI provider returned empty response content.');
      
      let parsed;
      try {
        parsed = typeof content === 'string' ? JSON.parse(content) : content;
      } catch (parseErr) {
        // Attempt JSON extraction if LLM wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1]);
        else throw parseErr;
      }

      const validated = validateExternalOutput(operation, parsed, payload);
      return { ...validated, provider_notice: `Generated by ${this.model} (Grounded RAG)`, safety: SAFETY };
    } catch (error) {
      if (error.name === 'AbortError') throw new AIProviderError('External AI provider timed out (exceeded limit).', 504);
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(`External AI provider processing error: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  generateHandover(payload) { return this.run('generateHandover', payload, mockHandover); }
  extractCriticalInformation(payload) { return this.run('extractCriticalInformation', payload, mockCritical); }
  analyzeRelevance(payload) { return this.run('analyzeRelevance', payload, mockRelevance); }
  answerRecordQuestion(payload) { return this.run('answerRecordQuestion', payload, mockSearch); }
  analyzeDataQuality(payload) { return this.run('analyzeDataQuality', payload, mockDataQuality); }
  calculateTransferComplexity(payload) { return this.run('calculateTransferComplexity', payload, mockComplexity); }
}

module.exports = new AIService();
module.exports.AIProviderError = AIProviderError;
module.exports.MOCK_LABEL = MOCK_LABEL;
module.exports.SAFETY = SAFETY;
