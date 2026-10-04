const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.PORT = '5061';
process.env.AI_PROVIDER = 'mock';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: 5061, path, method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, response => {
      let raw = ''; response.on('data', chunk => { raw += chunk; }); response.on('end', () => {
        let parsed = raw; try { parsed = JSON.parse(raw); } catch (_) {}
        resolve({ status: response.statusCode, body: parsed, type: response.headers['content-type'] });
      });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}

async function login(email, password) {
  const response = await request('POST', '/api/auth/login', { email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.token;
}

async function run() {
  const { server } = require('../src/server');
  try {
    await new Promise(resolve => setTimeout(resolve, 2600));
    const [patientOne, patientTwo, destination, rejectedDestination, admin] = await Promise.all([
      login('patient@demo.local', 'patient123'), login('patient.anjali@demo.local', 'patient123'),
      login('dr.priya@apollo.com', 'doctor123'), login('dr.amit@fortis.in', 'doctor123'), login('admin@aiims.edu.in', 'admin123')
    ]);

    const expiredJwt = jwt.sign({ id: 1, role: 'DOCTOR', hospital_id: 1 }, require('../src/middleware/auth').JWT_SECRET, { expiresIn: -1 });
    assert.equal((await request('GET', '/api/auth/me', undefined, expiredJwt)).status, 401, 'Expired session must be rejected');

    const expiredConsent = await request('GET', '/api/consents/5', undefined, patientOne);
    assert.equal(expiredConsent.status, 200);
    assert.equal(expiredConsent.body.data.effective_status, 'EXPIRED');
    assert.equal((await request('POST', '/api/consents/3/approve', {}, patientOne)).status, 409, 'Rejected consent cannot be approved');
    assert.equal((await request('POST', '/api/consents/4/revoke', {}, patientTwo)).status, 409, 'Revoked consent cannot be revoked again');
    assert.equal((await request('GET', '/api/transfers/4/data', undefined, destination)).status, 403, 'Revoked consent must block destination data');
    assert.equal((await request('GET', '/api/transfers/3/data', undefined, rejectedDestination)).status, 403, 'Rejected consent must block destination data');

    const anomalyRun = await request('POST', '/api/security/anomalies/analyze', {}, admin);
    assert.equal(anomalyRun.status, 201, JSON.stringify(anomalyRun.body));
    const anomalies = (await request('GET', '/api/security/anomalies', undefined, admin)).body.data;
    assert.ok(anomalies.some(event => event.actor_id === 10), 'Deliberately anomalous synthetic actor should be flagged');
    assert.ok(!anomalies.some(event => event.actor_id === 1 && event.severity === 'HIGH'), 'Normal attending behavior should not be marked high risk');
    assert.ok(anomalies.every(event => /does not establish wrongdoing|does not block access/.test(event.explanation)));

    const created = await request('POST', '/api/research/runs', { name: 'Measured synthetic workflow comparison', description: 'No fabricated results.' }, admin);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const runId = created.body.data.id;
    assert.equal((await request('POST', `/api/research/runs/${runId}/entries`, { metric_name: 'manual_preparation_time_minutes', actual_value: 18, unit: 'minutes' }, admin)).status, 201);
    assert.equal((await request('POST', `/api/research/runs/${runId}/entries`, { metric_name: 'ai_assisted_preparation_time_minutes', baseline_value: 18, actual_value: 7, unit: 'minutes' }, admin)).status, 201);
    const summary = await request('GET', `/api/research/runs/${runId}/summary`, undefined, admin);
    assert.equal(summary.status, 200);
    const assisted = summary.body.data.metrics.find(item => item.metric === 'ai_assisted_preparation_time_minutes');
    assert.equal(assisted.improvement_percent, 61.11);
    const csv = await request('GET', `/api/research/runs/${runId}/export.csv`, undefined, admin);
    assert.equal(csv.status, 200); assert.match(csv.type, /text\/csv/); assert.ok(!String(csv.body).includes('P-10001'), 'Research CSV must not contain patient identifiers');

    console.log('Security, consent-state, session-expiry, and research workflow tests passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
