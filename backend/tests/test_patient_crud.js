const http = require('http');

async function runPatientCrudTests() {
  const { app, server } = require('../src/server');
  
  await new Promise(res => setTimeout(res, 500));

  const makeRequest = (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (data) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(data);
      }

      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: reqHeaders
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch (e) {
            resolve({ status: res.statusCode, body: responseData });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  };

  try {
    console.log('\n--- 🧪 TEST 1: Authenticate as AIIMS Doctor (Hospital #1) ---');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'dr.ramesh@aiims.edu.in',
      password: 'doctor123'
    });
    console.log('Login Status:', loginRes.status);
    if (loginRes.status !== 200 || !loginRes.body.token) throw new Error('Login failed');
    const token = loginRes.body.token;

    console.log('\n--- 🧪 TEST 2: Fetch Hospital Patient Roster (GET /api/patients) ---');
    const rosterRes = await makeRequest('GET', '/api/patients', null, { Authorization: `Bearer ${token}` });
    console.log('Roster Status:', rosterRes.status);
    console.log('Total Patients Admitted at AIIMS:', rosterRes.body.total);
    console.log('Sample Patient:', rosterRes.body.data[0]?.name, '-', rosterRes.body.data[0]?.unique_health_id);
    if (rosterRes.status !== 200 || rosterRes.body.total === 0) throw new Error('Roster fetch failed');

    console.log('\n--- 🧪 TEST 3: Fetch Detailed Patient Dossier (GET /api/patients/:id) ---');
    const patientId = rosterRes.body.data[0].id;
    const detailRes = await makeRequest('GET', `/api/patients/${patientId}`, null, { Authorization: `Bearer ${token}` });
    console.log('Detail Status:', detailRes.status);
    console.log('Patient Name:', detailRes.body.data.name);
    console.log('Visits Count:', detailRes.body.data.visits?.length);
    console.log('Tests Recorded:', detailRes.body.data.visits?.[0]?.tests?.length);
    if (detailRes.status !== 200 || !detailRes.body.data.visits) throw new Error('Detail fetch failed');

    console.log('\n--- 🧪 TEST 4: Register & Admit New Patient (POST /api/patients) ---');
    const newPatientPayload = {
      name: 'Devendra Verma',
      dob: '1982-04-12',
      gender: 'Male',
      blood_group: 'AB+',
      phone: '+91-9876001122',
      emergency_contact_name: 'Pooja Verma (Spouse)',
      emergency_contact_phone: '+91-9876001123',
      medical_history: 'Known diabetic, smoker',
      allergies: 'Ciprofloxacin',
      diagnosis: 'Acute Pyelonephritis with Sepsis',
      status: 'critical',
      chief_complaint: 'High grade fever with chills, right flank pain, altered sensorium',
      clinical_notes: 'Urgent IV fluid resuscitation, broad-spectrum antibiotic coverage initiated.',
      vitals: {
        heart_rate: 112,
        blood_pressure: '94/60',
        spo2: 96,
        temperature: 102.4,
        respiratory_rate: 24
      },
      tests: [
        {
          test_name: 'Serum Lactate',
          category: 'Critical Care',
          result: '4.2',
          units: 'mmol/L',
          reference_range: '< 2.0 mmol/L',
          abnormal: true,
          notes: 'Severe sepsis marker'
        }
      ]
    };

    const createRes = await makeRequest('POST', '/api/patients', newPatientPayload, { Authorization: `Bearer ${token}` });
    console.log('Create Patient Status:', createRes.status);
    console.log('Created Patient ID:', createRes.body.data?.id);
    console.log('Generated ABHA ID:', createRes.body.data?.unique_health_id);
    console.log('Initial Visit ID:', createRes.body.data?.latest_visit?.id);
    console.log('Recorded Test Count:', createRes.body.data?.latest_visit?.tests?.length);
    if (createRes.status !== 201 || !createRes.body.data?.unique_health_id) throw new Error('Create patient failed');

    const createdVisitId = createRes.body.data.latest_visit.id;
    const createdPatientId = createRes.body.data.id;

    console.log('\n--- 🧪 TEST 5: Add Diagnostic Test (POST /api/tests) ---');
    const testPayload = {
      visit_id: createdVisitId,
      test_name: 'Blood Culture & Sensitivity',
      category: 'Microbiology',
      result: 'Gram-negative bacilli identified (E. coli)',
      units: 'Culture',
      reference_range: 'No growth',
      abnormal: true,
      notes: 'Sensitive to Meropenem'
    };
    const addTestRes = await makeRequest('POST', '/api/tests', testPayload, { Authorization: `Bearer ${token}` });
    console.log('Add Test Status:', addTestRes.status);
    console.log('Test Recorded:', addTestRes.body.data?.test_name);
    if (addTestRes.status !== 201) throw new Error('Add test failed');

    console.log('\n--- 🧪 TEST 6: Update Visit Status (PATCH /api/visits/:id/status) ---');
    const updateVisitRes = await makeRequest('PATCH', `/api/visits/${createdVisitId}/status`, {
      status: 'observation'
    }, { Authorization: `Bearer ${token}` });
    console.log('Update Visit Status:', updateVisitRes.status);
    console.log('New Status:', updateVisitRes.body.data?.status);
    if (updateVisitRes.status !== 200 || updateVisitRes.body.data?.status !== 'observation') throw new Error('Update visit failed');

    console.log('\n--- 🧪 TEST 7: Duplicate-Test Checker Rule (POST /api/tests/check-duplicate) ---');
    const duplicateCheckRes = await makeRequest('POST', '/api/tests/check-duplicate', {
      patient_id: createdPatientId,
      test_name: 'Serum Lactate'
    }, { Authorization: `Bearer ${token}` });
    console.log('Duplicate Check Status:', duplicateCheckRes.status);
    console.log('Is Duplicate Detected (Expected true):', duplicateCheckRes.body.isDuplicate);
    console.log('Warning Message:', duplicateCheckRes.body.message);
    if (duplicateCheckRes.status !== 200 || !duplicateCheckRes.body.isDuplicate) throw new Error('Duplicate check failed');

    console.log('\n\x1b[32m%s\x1b[0m', '✅ ALL STEP 3 PATIENT / VISIT / TEST CRUD & DUPLICATE CHECK TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ Patient CRUD test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runPatientCrudTests();
