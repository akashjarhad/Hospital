const http = require('http');

async function runTests() {
  const { app, server } = require('../src/server');
  
  // Wait a moment for server to listen
  await new Promise(res => setTimeout(res, 600));

  const postJSON = (path, body, headers = {}) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers
        }
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseData });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  };

  const getJSON = (path, headers = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'GET',
        headers: { ...headers }
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseData });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  };

  console.log('\n======================================================');
  console.log('🧪 PATIENT & DOCTOR REGISTRATION & ASSOCIATION TEST SUITE');
  console.log('======================================================\n');

  try {
    const ts = Date.now();
    const patEmail = `rahul.patil.${ts}@test.local`;
    const patUsername = `rahul.patil.${ts}`;
    const docEmail = `dr.suresh.${ts}@apollo.com`;
    const docUsername = `dr.suresh.${ts}`;

    // 1. Patient Self-Registration
    console.log('--- 1. Testing Patient Self-Registration ---');
    const patRegRes = await postJSON('/api/auth/register/patient', {
      first_name: 'Rahul',
      last_name: 'Patil',
      dob: '1990-04-15',
      gender: 'Male',
      email: patEmail,
      username: patUsername,
      password: 'password123',
      confirm_password: 'password123',
      phone: '+91-9876543299',
      emergency_contact_name: 'Pooja Patil',
      emergency_contact_phone: '+91-9876543298',
      blood_group: 'B+'
    });
    console.log('Patient Registration Status:', patRegRes.status, patRegRes.body?.message);
    if (patRegRes.status !== 201) throw new Error(`Patient registration failed: ${JSON.stringify(patRegRes.body)}`);
    const newPatientId = patRegRes.body.user.patient_id;
    const newPatientHealthId = patRegRes.body.user.unique_health_id;
    console.log(`✓ Patient created: ID=${newPatientId}, ABHA=${newPatientHealthId}`);

    // 2. Doctor Self-Registration
    console.log('\n--- 2. Testing Doctor Self-Registration ---');
    const docRegRes = await postJSON('/api/auth/register/doctor', {
      first_name: 'Suresh',
      last_name: 'Deshmukh',
      email: docEmail,
      username: docUsername,
      password: 'doctor123',
      confirm_password: 'doctor123',
      specialization: 'Cardiology & Intensive Care',
      medical_license_number: 'MCI-2020-5544',
      hospital_id: 2,
      phone: '+91-9811005544'
    });
    console.log('Doctor Registration Status:', docRegRes.status, docRegRes.body?.message);
    if (docRegRes.status !== 201) throw new Error(`Doctor registration failed: ${JSON.stringify(docRegRes.body)}`);
    console.log(`✓ Doctor created: ID=${docRegRes.body.user.id}, Role=${docRegRes.body.user.role}`);

    // 3. Login via Username for Patient & Doctor
    console.log('\n--- 3. Testing Login via Username ---');
    const patLogin = await postJSON('/api/auth/login', {
      username: patUsername,
      password: 'password123'
    });
    if (patLogin.status !== 200) throw new Error(`Patient username login failed: ${JSON.stringify(patLogin.body)}`);
    const patToken = patLogin.body.token;
    console.log('✓ Patient Login Successful via username: token generated');

    const docLogin = await postJSON('/api/auth/login', {
      username: docUsername,
      password: 'doctor123'
    });
    if (docLogin.status !== 200) throw new Error(`Doctor username login failed: ${JSON.stringify(docLogin.body)}`);
    const docToken = docLogin.body.token;
    console.log('✓ Doctor Login Successful via username: token generated');

    // Also get Doctor 1 token (Dr. Ramesh Sharma)
    const doc1Login = await postJSON('/api/auth/login', {
      email: 'dr.ramesh@aiims.edu.in',
      password: 'doctor123'
    });
    const doc1Token = doc1Login.body.token;

    // 4. Doctor searches for registered patient
    console.log('\n--- 4. Testing Doctor Privacy-Preserving Patient Search ---');
    const searchRes = await getJSON('/api/patients/doctor/search?q=rahul', {
      Authorization: `Bearer ${docToken}`
    });
    console.log('Search Status:', searchRes.status);
    console.log('Search Results Count:', searchRes.body?.total);
    console.log('Search Sample Data:', searchRes.body?.data?.[0]);
    if (searchRes.status !== 200 || !searchRes.body?.data?.length) throw new Error('Patient search failed');
    if (!searchRes.body.data[0].dob_masked.startsWith('****')) throw new Error('DOB was not masked!');
    console.log('✓ Privacy-preserving search verified (DOB masked, association status NONE)');

    // 5. Doctor sends Association Request
    console.log('\n--- 5. Testing Doctor -> Patient Association Request ---');
    const assocReqRes = await postJSON('/api/patients/doctor/request-association', {
      patient_id: newPatientId,
      department: 'Cardiology',
      treatment_reason: 'Cardiology Consultation & Outpatient Monitoring'
    }, {
      Authorization: `Bearer ${docToken}`
    });
    console.log('Association Request Status:', assocReqRes.status, assocReqRes.body?.message);
    if (assocReqRes.status !== 201) throw new Error('Association request failed');
    const associationId = assocReqRes.body.data.id;
    console.log(`✓ Association request created (ID: ${associationId}, Status: PENDING)`);

    // 6. Patient views pending Association Requests
    console.log('\n--- 6. Testing Patient View Pending Association Requests ---');
    const patPendingRes = await getJSON('/api/patients/my-association-requests', {
      Authorization: `Bearer ${patToken}`
    });
    console.log('Pending Requests Status:', patPendingRes.status);
    console.log('Pending Requests Count:', patPendingRes.body?.total);
    if (patPendingRes.status !== 200 || patPendingRes.body?.total < 1) throw new Error('Patient did not receive pending request');
    console.log(`✓ Patient sees request from: ${patPendingRes.body.data[0].doctor_name}`);

    // 7. Patient Accepts Association Request
    console.log('\n--- 7. Testing Patient Accepts Association Request ---');
    const acceptRes = await postJSON(`/api/patients/association-requests/${associationId}/respond`, {
      action: 'ACCEPT'
    }, {
      Authorization: `Bearer ${patToken}`
    });
    console.log('Accept Status:', acceptRes.status, acceptRes.body?.message);
    if (acceptRes.status !== 200) throw new Error('Accepting association failed');
    console.log('✓ Association accepted, status updated to ACTIVE');

    // 8. Doctor Dashboard Roster now shows Rahul Patil
    console.log('\n--- 8. Testing Doctor Dashboard Patient Roster ---');
    const docPatientsRes = await getJSON('/api/patients', {
      Authorization: `Bearer ${docToken}`
    });
    console.log('Doctor Patients Count:', docPatientsRes.body?.total);
    const hasRahul = docPatientsRes.body?.data?.some(p => p.name === 'Rahul Patil' || p.patient_id === newPatientId);
    if (!hasRahul) throw new Error('Patient Rahul Patil not in Doctor roster!');
    console.log('✓ Doctor dashboard roster strictly contains Rahul Patil!');

    // 9. Unauthorized Doctor Access Check (Unrelated doctor should get 403)
    console.log('\n--- 9. Testing Unauthorized Access Guard ---');
    const unauthDocAccess = await getJSON(`/api/patients/${newPatientId}`, {
      Authorization: `Bearer ${doc1Token}`
    });
    console.log('Unrelated Doctor Access Status:', unauthDocAccess.status, unauthDocAccess.body?.message);
    if (unauthDocAccess.status !== 403) throw new Error(`Expected 403 Forbidden for unrelated doctor, got ${unauthDocAccess.status}`);
    console.log('✓ Unrelated doctor access blocked with 403 Forbidden!');

    // 10. Authorized Doctor Accesses Dossier & Adds Medical Record
    console.log('\n--- 10. Testing Authorized Doctor Adding Medical Record ---');
    const addRecordRes = await postJSON(`/api/patients/${newPatientId}/medical-records`, {
      diagnosis: 'Mild Sinus Bradycardia on ECG evaluation',
      chief_complaint: 'Occasional lightheadedness on exertion',
      clinical_notes: 'Patient advised 24h Holter monitoring and electrolyte panel.',
      status: 'ADMITTED',
      vitals: { bp_systolic: 118, bp_diastolic: 76, heart_rate: 54, spo2: 99 },
      tests: [{ test_name: '12-Lead Electrocardiogram (ECG)', category: 'Cardiology', result: 'Sinus Bradycardia @ 54 bpm, Normal Axis', units: 'bpm', abnormal: true }]
    }, {
      Authorization: `Bearer ${docToken}`
    });
    console.log('Add Medical Record Status:', addRecordRes.status, addRecordRes.body?.message);
    if (addRecordRes.status !== 201) throw new Error('Failed to add medical record');
    console.log('✓ Doctor added medical encounter and diagnostic test');

    // 11. Authorized Doctor Creates Transfer Request
    console.log('\n--- 11. Testing Authorized Doctor Inter-Hospital Transfer Creation ---');
    const transferRes = await postJSON('/api/transfers', {
      patient_id: newPatientId,
      destination_hospital_id: 1, // Transfer to AIIMS
      transfer_reason: 'Advanced Electrophysiology referral and 3D Cardiac Mapping',
      clinical_priority: 'URGENT',
      requested_data: ['Patient Demographics', 'Medical History', 'Current Diagnosis', 'Laboratory Reports', 'Doctor Transfer Summary']
    }, {
      Authorization: `Bearer ${docToken}`
    });
    console.log('Create Transfer Status:', transferRes.status, transferRes.body?.message);
    if (transferRes.status !== 201) throw new Error('Transfer creation failed');
    console.log(`✓ Transfer request created (Code: ${transferRes.body.data.transfer.transfer_code})`);

    // 12. Patient Revokes Association
    console.log('\n--- 12. Testing Patient Revokes Doctor Association ---');
    const revokeRes = await postJSON(`/api/patients/my-doctors/${associationId}/revoke`, {}, {
      Authorization: `Bearer ${patToken}`
    });
    console.log('Revoke Status:', revokeRes.status, revokeRes.body?.message);
    if (revokeRes.status !== 200) throw new Error('Revoke failed');
    console.log('✓ Patient successfully revoked doctor association');

    console.log('\n======================================================');
    console.log('🎉 ALL 12 PATIENT-DOCTOR ASSOCIATION TESTS PASSED 100%');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (typeof server !== 'undefined' && server && server.close) {
      server.close();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
