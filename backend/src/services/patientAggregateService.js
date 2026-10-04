const { query, memoryStore, getConnectionStatus } = require('../config/db');

const CATEGORY_DEFINITIONS = {
  DEMOGRAPHICS: 'Patient Demographics',
  EMERGENCY_CONTACT: 'Emergency Contact',
  MEDICAL_HISTORY: 'Medical History',
  CURRENT_DIAGNOSIS: 'Current Diagnosis',
  ALLERGIES: 'Allergies',
  CURRENT_MEDICATIONS: 'Current Medications',
  PREVIOUS_MEDICATIONS: 'Previous Medications',
  LAB_REPORTS: 'Laboratory Reports',
  DIAGNOSTIC_REPORTS: 'Diagnostic Reports',
  IMAGING_REPORTS: 'Imaging Reports',
  CLINICAL_NOTES: 'Clinical Notes',
  TREATMENT_HISTORY: 'Treatment History',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  SURGICAL_HISTORY: 'Surgical History',
  TRANSFER_SUMMARY: 'Doctor Transfer Summary'
};

const CATEGORY_LOOKUP = Object.entries(CATEGORY_DEFINITIONS).reduce((map, [code, label]) => {
  map.set(code, code);
  map.set(label.toLowerCase(), code);
  return map;
}, new Map([
  ['critical medical history', 'MEDICAL_HISTORY'],
  ['recent laboratory reports', 'LAB_REPORTS'],
  ['diagnosis', 'CURRENT_DIAGNOSIS'],
  ['medication', 'CURRENT_MEDICATIONS'],
  ['documents', 'DIAGNOSTIC_REPORTS']
]));

const ALL_CATEGORY_LABELS = Object.values(CATEGORY_DEFINITIONS);
const INFORMATION_NOT_AVAILABLE = 'Information not available in authorized records.';

function normalizeCategories(categories = []) {
  if (!Array.isArray(categories)) return [];
  const codes = categories
    .map(value => CATEGORY_LOOKUP.get(String(value || '').trim()) || CATEGORY_LOOKUP.get(String(value || '').trim().toLowerCase()))
    .filter(Boolean);
  return [...new Set(codes)];
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function loadPatientIdentity(patientId) {
  const numericId = Number(patientId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  if (!getConnectionStatus()) return clone(memoryStore.patients.find(row => row.id === numericId) || null);
  const result = await query('SELECT id, user_id, unique_health_id, name FROM patients WHERE id = $1', [numericId]);
  return result.rows[0] || null;
}

async function loadPatientAggregate(patientId, recordScope = null) {
  const numericId = Number(patientId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  const scopedHospitalId = recordScope?.hospitalId ? Number(recordScope.hospitalId) : null;
  const scopedVisitIds = Array.isArray(recordScope?.visitIds) && recordScope.visitIds.length ? recordScope.visitIds.map(Number) : null;
  const visitAllowed = visit => visit.patient_id === numericId && (!scopedHospitalId || Number(visit.hospital_id) === scopedHospitalId) && (!scopedVisitIds || scopedVisitIds.includes(Number(visit.id)));

  if (!getConnectionStatus()) {
    const patient = memoryStore.patients.find(row => row.id === numericId);
    if (!patient) return null;
    const visits = memoryStore.visits
      .filter(visitAllowed)
      .sort((a, b) => new Date(b.admission_date || 0) - new Date(a.admission_date || 0))
      .map(visit => ({
        ...clone(visit),
        hospital_name: memoryStore.hospitals.find(h => h.id === visit.hospital_id)?.name || null,
        attending_doctor_name: memoryStore.users.find(u => u.id === visit.attending_doctor_id)?.name || null,
        tests: clone(memoryStore.tests.filter(test => test.visit_id === visit.id))
      }));
    const allowedVisitIds = new Set(visits.map(visit => Number(visit.id)));
    return {
      ...clone(patient),
      visits,
      medications: clone(memoryStore.medications.filter(row => row.patient_id === numericId && (!recordScope || (row.visit_id && allowedVisitIds.has(Number(row.visit_id)))))),
      allergy_records: clone(memoryStore.patient_allergies.filter(row => row.patient_id === numericId)),
      documents: clone(memoryStore.documents.filter(row => row.patient_id === numericId && (!scopedHospitalId || Number(row.hospital_id) === scopedHospitalId)))
    };
  }

  const patientResult = await query('SELECT * FROM patients WHERE id = $1', [numericId]);
  if (!patientResult.rows.length) return null;
  const visitWhere = [scopedHospitalId ? 'v.hospital_id = $2' : null, scopedVisitIds ? `v.id = ANY($${scopedHospitalId ? 3 : 2}::int[])` : null].filter(Boolean);
  const visitParams = [numericId, ...(scopedHospitalId ? [scopedHospitalId] : []), ...(scopedVisitIds ? [scopedVisitIds] : [])];
  const visitsResult = await query(`SELECT v.*, h.name AS hospital_name, u.name AS attending_doctor_name
           FROM visits v LEFT JOIN hospitals h ON h.id = v.hospital_id
           LEFT JOIN users u ON u.id = v.attending_doctor_id
           WHERE v.patient_id = $1${visitWhere.length ? ` AND ${visitWhere.join(' AND ')}` : ''} ORDER BY v.admission_date DESC`, visitParams);
  const allowedVisitIds = visitsResult.rows.map(visit => Number(visit.id));
  const [medicationsResult, allergiesResult, documentsResult] = await Promise.all([
    recordScope
      ? (allowedVisitIds.length ? query('SELECT * FROM medications WHERE patient_id = $1 AND visit_id = ANY($2::int[]) ORDER BY prescribed_at DESC', [numericId, allowedVisitIds]) : Promise.resolve({ rows: [] }))
      : query('SELECT * FROM medications WHERE patient_id = $1 ORDER BY prescribed_at DESC', [numericId]),
    query('SELECT * FROM patient_allergies WHERE patient_id = $1 ORDER BY diagnosed_at DESC', [numericId]),
    scopedHospitalId
      ? query('SELECT * FROM documents WHERE patient_id = $1 AND hospital_id = $2 ORDER BY created_at DESC', [numericId, scopedHospitalId])
      : query('SELECT * FROM documents WHERE patient_id = $1 ORDER BY created_at DESC', [numericId])
  ]);
  const visits = await Promise.all(visitsResult.rows.map(async visit => ({ ...visit, tests: (await query('SELECT * FROM tests WHERE visit_id = $1 ORDER BY timestamp DESC', [visit.id])).rows })));
  return { ...patientResult.rows[0], visits, medications: medicationsResult.rows, allergy_records: allergiesResult.rows, documents: documentsResult.rows };
}

function testMatches(test, codes) {
  const category = String(test.category || test.test_category || '').toLowerCase();
  if (codes.has('LAB_REPORTS') && category.includes('lab')) return true;
  if (codes.has('IMAGING_REPORTS') && /(imag|radio|ultra|x-ray|scan)/.test(category)) return true;
  if (codes.has('DIAGNOSTIC_REPORTS') && !category.includes('lab')) return true;
  return false;
}

function projectByCategories(aggregate, categories = []) {
  if (!aggregate) return null;
  const normalized = normalizeCategories(categories);
  const codes = new Set(normalized);
  const projected = {
    id: aggregate.id,
    permitted_categories: normalized.map(code => CATEGORY_DEFINITIONS[code]),
    representation: 'FHIR-oriented prototype; not a formal FHIR conformance claim.'
  };

  if (codes.has('DEMOGRAPHICS')) {
    Object.assign(projected, {
      unique_health_id: aggregate.unique_health_id,
      name: aggregate.name,
      dob: aggregate.dob,
      gender: aggregate.gender,
      blood_group: aggregate.blood_group,
      phone: aggregate.phone
    });
  }
  if (codes.has('EMERGENCY_CONTACT')) {
    projected.emergency_contact_name = aggregate.emergency_contact_name;
    projected.emergency_contact_phone = aggregate.emergency_contact_phone;
  }
  if (codes.has('MEDICAL_HISTORY')) projected.medical_history = aggregate.medical_history;
  if (codes.has('ALLERGIES')) {
    projected.allergies = aggregate.allergies;
    projected.allergy_records = clone(aggregate.allergy_records || []);
  }
  if (codes.has('CURRENT_MEDICATIONS') || codes.has('PREVIOUS_MEDICATIONS')) {
    projected.medications = (aggregate.medications || []).filter(medication =>
      (codes.has('CURRENT_MEDICATIONS') && medication.is_current) ||
      (codes.has('PREVIOUS_MEDICATIONS') && !medication.is_current)
    );
  }

  const includeVisits = ['CURRENT_DIAGNOSIS', 'LAB_REPORTS', 'DIAGNOSTIC_REPORTS', 'IMAGING_REPORTS', 'CLINICAL_NOTES', 'TREATMENT_HISTORY', 'DISCHARGE_SUMMARY', 'SURGICAL_HISTORY'].some(code => codes.has(code));
  if (includeVisits) {
    const orderedVisits = (aggregate.visits || []).slice().sort((a, b) => new Date(b.admission_date || 0) - new Date(a.admission_date || 0));
    const visitMap = new Map();
    const entry = visit => {
      if (!visitMap.has(visit.id)) visitMap.set(visit.id, { id: visit.id });
      return visitMap.get(visit.id);
    };
    if (codes.has('CURRENT_DIAGNOSIS') && orderedVisits[0]) {
      entry(orderedVisits[0]).diagnosis = orderedVisits[0].diagnosis;
      projected.diagnosis = orderedVisits[0].diagnosis;
      projected.current_diagnosis = orderedVisits[0].diagnosis;
    }
    if (codes.has('TREATMENT_HISTORY')) {
      for (const visit of orderedVisits) Object.assign(entry(visit), { hospital_id: visit.hospital_id, hospital_name: visit.hospital_name, admission_date: visit.admission_date, discharge_date: visit.discharge_date, status: visit.status, diagnosis: visit.diagnosis, chief_complaint: visit.chief_complaint, clinical_notes: visit.clinical_notes, vitals: clone(visit.vitals || {}) });
    } else {
      if (codes.has('CLINICAL_NOTES')) for (const visit of orderedVisits) Object.assign(entry(visit), { admission_date: visit.admission_date, clinical_notes: visit.clinical_notes });
      if (codes.has('DISCHARGE_SUMMARY')) for (const visit of orderedVisits.filter(item => item.discharge_date)) Object.assign(entry(visit), { discharge_date: visit.discharge_date, clinical_notes: visit.clinical_notes });
      if (codes.has('SURGICAL_HISTORY')) for (const visit of orderedVisits.filter(item => /surg|operat|procedure/i.test(`${item.diagnosis || ''} ${item.clinical_notes || ''}`))) Object.assign(entry(visit), { admission_date: visit.admission_date, diagnosis: visit.diagnosis, clinical_notes: visit.clinical_notes });
    }
    if (codes.has('LAB_REPORTS') || codes.has('DIAGNOSTIC_REPORTS') || codes.has('IMAGING_REPORTS')) {
      for (const visit of orderedVisits) {
        const authorizedTests = (visit.tests || []).filter(test => testMatches(test, codes));
        if (authorizedTests.length) entry(visit).tests = clone(authorizedTests);
      }
    }
    projected.visits = [...visitMap.values()];
  }

  if (codes.has('LAB_REPORTS') || codes.has('DIAGNOSTIC_REPORTS') || codes.has('IMAGING_REPORTS') || codes.has('TRANSFER_SUMMARY')) {
    projected.documents = (aggregate.documents || []).filter(document => {
      const type = String(document.document_type || '').toLowerCase();
      return (codes.has('LAB_REPORTS') && type.includes('lab')) ||
        (codes.has('DIAGNOSTIC_REPORTS') && type.includes('diag')) ||
        (codes.has('IMAGING_REPORTS') && /(imag|radio|scan)/.test(type)) ||
        (codes.has('TRANSFER_SUMMARY') && type.includes('summary'));
    }).map(({ storage_reference, ...metadata }) => metadata);
  }

  return projected;
}

function resourceTypeForTest(test) {
  return /imag|radio|scan|x-ray|ultra/i.test(String(test?.category || test?.test_category || '')) ? 'DiagnosticReport' : 'Observation';
}

function getSourceRecords(projected) {
  if (!projected) return [];
  const sources = [];
  const patientFields = ['name', 'dob', 'gender', 'blood_group', 'medical_history', 'allergies', 'emergency_contact_name'].filter(key => projected[key] !== undefined && projected[key] !== null && projected[key] !== '');
  if (patientFields.length) sources.push({ resource_type: 'Patient', source_id: `Patient/${projected.id}`, date: null, fields: patientFields });
  for (const visit of projected.visits || []) {
    const fields = ['diagnosis', 'chief_complaint', 'clinical_notes', 'vitals'].filter(key => visit[key] !== undefined && visit[key] !== null && visit[key] !== '');
    if (fields.length) sources.push({ resource_type: 'Encounter', source_id: `Encounter/${visit.id}`, date: visit.admission_date, fields });
    for (const test of visit.tests || []) {
      const resourceType = resourceTypeForTest(test);
      sources.push({ resource_type: resourceType, source_id: `${resourceType}/${test.id}`, date: test.timestamp, fields: ['test_name', 'result', 'units', 'abnormal', 'notes'] });
    }
  }
  for (const medication of projected.medications || []) sources.push({ resource_type: 'MedicationRequest', source_id: `MedicationRequest/${medication.id}`, date: medication.prescribed_at, fields: ['medication_name', 'dosage', 'frequency', 'route', 'is_current'] });
  for (const allergy of projected.allergy_records || []) sources.push({ resource_type: 'AllergyIntolerance', source_id: `AllergyIntolerance/${allergy.id}`, date: allergy.diagnosed_at, fields: ['substance', 'reaction_type', 'severity'] });
  for (const document of projected.documents || []) sources.push({ resource_type: 'DocumentReference', source_id: `DocumentReference/${document.id}`, date: document.created_at, fields: ['document_type', 'title', 'content_hash'] });
  return sources;
}

module.exports = { ALL_CATEGORY_LABELS, CATEGORY_DEFINITIONS, INFORMATION_NOT_AVAILABLE, normalizeCategories, loadPatientIdentity, loadPatientAggregate, projectByCategories, getSourceRecords, resourceTypeForTest };
