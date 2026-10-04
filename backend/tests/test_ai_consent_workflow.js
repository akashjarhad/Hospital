const http = require('http');
const assert = require('assert');

process.env.PORT = '5060';
process.env.AI_PROVIDER = 'mock';
process.env.AI_SEARCH_RETENTION = 'redacted';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: 5060, path, method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, response => {
      let raw = '';
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch (_) {}
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function login(email, password) {
  const response = await request('POST', '/api/auth/login', { email, password });
  assert.equal(response.status, 200, `Login failed for ${email}: ${JSON.stringify(response.body)}`);
  return response.body.token;
}

async function run() {
  const { server } = require('../src/server');
  try {
    await new Promise(resolve => setTimeout(resolve, 2600));
    const [source, secondSourceDoctor, destination, patient, unrelated, admin] = await Promise.all([
      login('dr.ramesh@aiims.edu.in', 'doctor123'),
      login('dr.ananya@aiims.edu.in', 'doctor123'),
      login('dr.priya@apollo.com', 'doctor123'),
      login('patient@demo.local', 'patient123'),
      login('dr.amit@fortis.in', 'doctor123'),
      login('admin@aiims.edu.in', 'admin123')
    ]);

    const created = await request('POST', '/api/transfers', {
      patient_id: 1,
      destination_hospital_id: 2,
      receiving_doctor_id: 4,
      transfer_reason: 'Consent-aware deterministic AI handover workflow validation.',
      clinical_priority: 'URGENT',
      requested_data: ['Patient Demographics', 'Medical History', 'Current Diagnosis', 'Allergies', 'Current Medications', 'Laboratory Reports', 'Diagnostic Reports', 'Doctor Transfer Summary']
    }, source);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const transferId = created.body.data.transfer.id;
    const consentId = created.body.data.consent.id;

    const nonAttendingCreate = await request('POST', '/api/transfers', { patient_id: 2, destination_hospital_id: 2, receiving_doctor_id: 4, transfer_reason: 'Unauthorized same-hospital non-attending transfer attempt.' }, source);
    assert.equal(nonAttendingCreate.status, 403, 'Same-hospital non-attending doctors must not create transfers');

    const narrowTransfer = await request('POST', '/api/transfers', { patient_id: 2, destination_hospital_id: 2, receiving_doctor_id: 4, transfer_reason: 'Narrow category projection boundary validation.', requested_data: ['Allergies'] }, secondSourceDoctor);
    assert.equal(narrowTransfer.status, 201, JSON.stringify(narrowTransfer.body));
    const narrowHandover = await request('POST', `/api/transfers/${narrowTransfer.body.data.transfer.id}/ai/handover`, {}, secondSourceDoctor);
    assert.equal(narrowHandover.status, 201, JSON.stringify(narrowHandover.body));
    assert.equal(narrowHandover.body.data.original_content.sections.current_situation, 'Information not available in authorized records.');
    assert.equal(narrowHandover.body.data.original_content.sections.current_medications, 'Information not available in authorized records.');
    assert.ok(!JSON.stringify(narrowHandover.body).includes('Respiratory Failure'), 'Narrow allergy scope must not leak diagnosis');

    const adminTransfers = await request('GET', '/api/transfers', undefined, admin);
    assert.equal(adminTransfers.status, 200);
    assert.ok(adminTransfers.body.data.every(item => !('patient_id' in item) && !('doctor_transfer_summary' in item) && !('encrypted_package' in item)), 'Admin transfer list must be metadata-only');

    const handover = await request('POST', `/api/transfers/${transferId}/ai/handover`, {}, source);
    assert.equal(handover.status, 201, JSON.stringify(handover.body));
    assert.match(handover.body.data.original_content.label, /DEMO/);
    assert.match(handover.body.data.original_content.safety, /does not diagnose, prescribe/);
    assert.ok(handover.body.data.source_ids.length > 0);

    assert.equal((await request('GET', `/api/transfers/${transferId}/ai/handover`, undefined, destination)).status, 403);
    assert.equal((await request('GET', `/api/transfers/${transferId}/ai/handover`, undefined, patient)).status, 403);
    assert.equal((await request('POST', `/api/consents/${consentId}/approve`, {}, source)).status, 403, 'Doctor must not approve consent');

    const approvedConsent = await request('POST', `/api/consents/${consentId}/approve`, { signature_note: 'Patient test confirmation' }, patient);
    assert.equal(approvedConsent.status, 200, JSON.stringify(approvedConsent.body));
    assert.equal((await request('GET', `/api/transfers/${transferId}/ai/handover`, undefined, patient)).status, 403, 'Patient must not see unapproved draft');

    const edited = await request('PUT', `/api/transfers/${transferId}/ai/handover`, { edited_content: { sections: { clinician_note: 'Reviewed against authorized records.' } } }, source);
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.ok(edited.body.data.original_content.sections);
    assert.equal(edited.body.data.status, 'EDITED');
    assert.equal((await request('POST', `/api/transfers/${transferId}/ai/handover/approve`, { accuracy_confirmed: false }, source)).status, 400);
    const approvedHandover = await request('POST', `/api/transfers/${transferId}/ai/handover/approve`, { accuracy_confirmed: true }, source);
    assert.equal(approvedHandover.status, 200, JSON.stringify(approvedHandover.body));
    assert.equal((await request('GET', `/api/transfers/${transferId}/ai/handover`, undefined, patient)).status, 200);

    const relevance = await request('POST', `/api/transfers/${transferId}/ai/relevance`, {}, destination);
    assert.equal(relevance.status, 201, JSON.stringify(relevance.body));
    if (relevance.body.data.length) {
      const relevanceReview = await request('PUT', `/api/transfers/${transferId}/ai/relevance`, { items: [{ id: relevance.body.data[0].id, selected: true, review_status: 'REVIEWED' }] }, destination);
      assert.equal(relevanceReview.status, 200, JSON.stringify(relevanceReview.body));
    }

    const critical = await request('POST', `/api/transfers/${transferId}/ai/critical-information`, {}, destination);
    assert.equal(critical.status, 201, JSON.stringify(critical.body));
    if (critical.body.data.length) {
      const criticalReview = await request('PUT', `/api/transfers/${transferId}/ai/critical-information`, { items: [{ id: critical.body.data[0].id, status: 'CONFIRMED' }] }, destination);
      assert.equal(criticalReview.status, 200, JSON.stringify(criticalReview.body));
    }

    const complexity = await request('POST', `/api/transfers/${transferId}/ai/complexity`, {}, destination);
    assert.equal(complexity.status, 201, JSON.stringify(complexity.body));
    assert.ok(['LOW', 'MODERATE', 'HIGH'].includes(complexity.body.data.level));

    const search = await request('POST', '/api/patients/1/ai/search', { transfer_id: transferId, question: 'What allergies are recorded?' }, destination);
    assert.equal(search.status, 201, JSON.stringify(search.body));
    assert.ok(search.body.data.evidence_count > 0);
    assert.equal((await request('POST', '/api/patients/1/ai/search', { question: 'What is the favorite color?' }, source)).body.data.answer, 'Information not available in authorized records.');
    assert.equal((await request('POST', '/api/patients/1/ai/search', { transfer_id: transferId, question: 'What allergies are recorded?' }, unrelated)).status, 403);

    const quality = await request('POST', '/api/patients/1/data-quality/check', { transfer_id: transferId }, destination);
    assert.equal(quality.status, 201, JSON.stringify(quality.body));
    assert.ok(['completeness', 'consistency', 'recency', 'duplication'].every(key => Number.isFinite(quality.body.score_breakdown[key])));
    const localQuality = await request('POST', '/api/patients/1/data-quality/check', {}, source);
    assert.equal(localQuality.status, 201, JSON.stringify(localQuality.body));
    const destinationQuality = await request('GET', `/api/patients/1/data-quality?transfer_id=${transferId}`, undefined, destination);
    assert.equal(destinationQuality.status, 200, JSON.stringify(destinationQuality.body));
    assert.ok(destinationQuality.body.data.every(issue => Number(issue.transfer_id) === transferId), 'Derived findings outside transfer scope must stay hidden');
    if (quality.body.data.length) {
      const qualityReview = await request('PUT', `/api/data-quality/${quality.body.data[0].id}`, { review_status: 'VERIFIED' }, destination);
      assert.equal(qualityReview.status, 200, JSON.stringify(qualityReview.body));
    }

    const { loadPatientAggregate, projectByCategories, getSourceRecords } = require('../src/services/patientAggregateService');
    const imagingProjection = projectByCategories(await loadPatientAggregate(2, { hospitalId: 1, visitIds: [2] }), ['Imaging Reports']);
    assert.ok(getSourceRecords(imagingProjection).some(item => item.source_id === 'DiagnosticReport/5'), 'Imaging provenance must use DiagnosticReport');

    const sent = await request('POST', `/api/transfers/${transferId}/send`, {}, source);
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const received = await request('POST', `/api/transfers/${transferId}/receive`, {}, destination);
    assert.equal(received.status, 200, JSON.stringify(received.body));
    const fhir = await request('GET', `/api/transfers/${transferId}/fhir`, undefined, destination);
    assert.equal(fhir.status, 200, JSON.stringify(fhir.body));
    assert.match(fhir.body.prototypeNotice, /prototype/);

    const emergency = await request('POST', '/api/emergency-access/request', { patient_id: 4, reason: 'Patient is unconscious and requires immediate emergency review.', access_scope: ['Allergies', 'Current Diagnosis', 'Financial Information'] }, source);
    assert.equal(emergency.status, 200, JSON.stringify(emergency.body));
    assert.ok(!emergency.body.emergency_session.scope.includes('Financial Information'));
    assert.equal((await request('POST', '/api/patients/4/ai/search', { question: 'What allergies are recorded?' }, unrelated)).status, 403, 'Emergency session must be doctor-specific');
    const emergencySearch = await request('POST', '/api/patients/4/ai/search', { question: 'What allergies are recorded?' }, source);
    assert.equal(emergencySearch.status, 201, JSON.stringify(emergencySearch.body));

    const security = await request('POST', '/api/security/anomalies/analyze', {}, admin);
    assert.equal(security.status, 201, JSON.stringify(security.body));
    assert.match(security.body.data.method, /no auto-blocking/);

    const { memoryStore } = require('../src/config/db');
    assert.ok(memoryStore.ai_audit_events.length >= 15, 'AI operations must create provenance events');
    assert.ok(memoryStore.ai_audit_events.every(event => /^[a-f0-9]{64}$/.test(event.output_hash)), 'Every AI audit event needs SHA-256 output hash');
    assert.ok(memoryStore.ai_search_logs.every(log => log.query_text === null || log.query_text.startsWith('[REDACTED_QUERY')), 'Queries should be redacted by default');

    console.log('AI consent-aware workflow tests passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
