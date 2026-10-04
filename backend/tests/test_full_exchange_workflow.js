const http = require('http');

async function runFullExchangeTests() {
  const { app, server } = require('../src/server');
  
  // Wait a moment for server to listen
  await new Promise(res => setTimeout(res, 600));

  const postJSON = (path, body, headers = {}) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
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
            resolve({ status: res.statusCode, body: responseData });
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
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers: {
          ...headers
        }
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
      req.end();
    });
  };

  try {
    console.log('\n============================================================');
    console.log('🧪 TEST SUITE: SECURE CONSENT-BASED INTER-HOSPITAL DATA EXCHANGE');
    console.log('============================================================\n');

    // 1. Authenticate Doctor A (AIIMS Trauma Center - Sending Hospital)
    console.log('🔹 STEP 1: Authenticate Doctor A (AIIMS Trauma Center)');
    const docALogin = await postJSON('/api/auth/login', {
      email: 'dr.ramesh@aiims.edu.in',
      password: 'doctor123'
    });
    console.log('Status:', docALogin.status, '| User:', docALogin.body.user?.name, '| Hospital:', docALogin.body.hospital?.name);
    if (docALogin.status !== 200 || !docALogin.body.token) throw new Error('Step 1 Failed: Doctor A Login');
    const tokenDocA = docALogin.body.token;

    // 2. Authenticate Doctor B (Apollo Multi-Speciality - Receiving Hospital)
    console.log('\n🔹 STEP 2: Authenticate Doctor B (Apollo Hospital)');
    const docBLogin = await postJSON('/api/auth/login', {
      email: 'dr.priya@apollo.com',
      password: 'doctor123'
    });
    console.log('Status:', docBLogin.status, '| User:', docBLogin.body.user?.name, '| Hospital:', docBLogin.body.hospital?.name);
    if (docBLogin.status !== 200 || !docBLogin.body.token) throw new Error('Step 2 Failed: Doctor B Login');
    const tokenDocB = docBLogin.body.token;

    // 3. Authenticate Patient (Rajesh Kumar - P-10001)
    console.log('\n🔹 STEP 3: Authenticate Patient Rajesh Kumar (P-10001)');
    const patLogin = await postJSON('/api/auth/login', {
      email: 'patient@demo.local',
      password: 'patient123'
    });
    console.log('Status:', patLogin.status, '| User:', patLogin.body.user?.name, '| Role:', patLogin.body.user?.role);
    if (patLogin.status !== 200 || !patLogin.body.token) throw new Error('Step 3 Failed: Patient Login');
    const tokenPatient = patLogin.body.token;

    // 4. Authenticate Doctor C (Fortis - Unrelated Hospital for Unauthorized Access Test)
    console.log('\n🔹 STEP 4: Authenticate Doctor C (Fortis Hospital - Unauthorized Third-Party)');
    const docCLogin = await postJSON('/api/auth/login', {
      email: 'dr.amit@fortis.in',
      password: 'doctor123'
    });
    if (docCLogin.status !== 200 || !docCLogin.body.token) throw new Error('Step 4 Failed: Doctor C Login');
    const tokenDocC = docCLogin.body.token;

    // 5. Doctor A creates Transfer Request with Data Minimization categories
    console.log('\n🔹 STEP 5: Doctor A creates Transfer Request with Data Minimization');
    const transferPayload = {
      patient_id: 1,
      destination_hospital_id: 2,
      receiving_doctor_id: 4,
      transfer_reason: 'Urgent Cath Lab Transfer for primary PCI catheterization',
      clinical_priority: 'URGENT',
      requested_data: [
        'Patient Demographics',
        'Emergency Contact',
        'Medical History',
        'Current Diagnosis',
        'Allergies',
        'Current Medications',
        'Laboratory Reports',
        'Diagnostic Reports',
        'Doctor Transfer Summary'
      ],
      doctor_transfer_summary: '54M NSTEMI in cardiogenic shock. Stabilized on inotropes.'
    };
    const createTransferRes = await postJSON('/api/transfers', transferPayload, {
      Authorization: `Bearer ${tokenDocA}`
    });
    console.log('Status:', createTransferRes.status, '| Transfer Code:', createTransferRes.body.data?.transfer?.transfer_code);
    console.log('Consent Status:', createTransferRes.body.data?.transfer?.consent_status, '(Expected PENDING)');
    if (createTransferRes.status !== 201) throw new Error('Step 5 Failed: Create Transfer');
    const transferId = createTransferRes.body.data.transfer.id;
    const consentId = createTransferRes.body.data.consent.id;

    // 6. Doctor B attempts to view transfer clinical data BEFORE patient consent -> EXPECT 403 FORBIDDEN
    console.log('\n🔹 STEP 6: Doctor B attempts data access BEFORE consent is granted (Expected: 403 FORBIDDEN)');
    const preConsentAccess = await getJSON(`/api/transfers/${transferId}/data`, {
      Authorization: `Bearer ${tokenDocB}`
    });
    console.log('Status (Expected 403):', preConsentAccess.status, '| Message:', preConsentAccess.body.message);
    if (preConsentAccess.status !== 403) throw new Error('Step 6 Failed: System failed to block unconsented access!');

    // 7. Patient reviews and APPROVES Consent via Patient Portal
    console.log('\n🔹 STEP 7: Patient Rajesh Kumar grants explicit Consent');
    const approveConsentRes = await postJSON(`/api/consents/${consentId}/approve`, {
      signature_note: 'Rajesh Kumar Digital Authorization for Apollo Transfer'
    }, {
      Authorization: `Bearer ${tokenPatient}`
    });
    console.log('Status:', approveConsentRes.status, '| Consent Status:', approveConsentRes.body.data?.status);
    if (approveConsentRes.status !== 200 || approveConsentRes.body.data?.status !== 'GRANTED') {
      throw new Error('Step 7 Failed: Approve Consent');
    }

    // 8. Doctor A Dispatches Encrypted Transfer Package
    console.log('\n🔹 STEP 8: Hospital A dispatches AES-256-GCM encrypted transfer package');
    const sendRes = await postJSON(`/api/transfers/${transferId}/send`, {}, {
      Authorization: `Bearer ${tokenDocA}`
    });
    console.log('Status:', sendRes.status, '| Package Signature:', sendRes.body.package_signature?.substring(0, 24) + '...');
    if (sendRes.status !== 200) throw new Error('Step 8 Failed: Send Transfer');

    // 9. Doctor B accesses authorized data AFTER consent is granted -> EXPECT 200 OK + Filtered categories
    console.log('\n🔹 STEP 9: Doctor B accesses authorized clinical data under active consent');
    const postConsentAccess = await getJSON(`/api/transfers/${transferId}/data`, {
      Authorization: `Bearer ${tokenDocB}`
    });
    console.log('Status (Expected 200):', postConsentAccess.status, '| Access Mode:', postConsentAccess.body.access_mode);
    console.log('Released Patient:', postConsentAccess.body.data?.name, '| Diagnosis:', postConsentAccess.body.data?.diagnosis);
    console.log('Categories Count:', postConsentAccess.body.permitted_categories?.length);
    if (postConsentAccess.status !== 200 || !postConsentAccess.body.data?.allergies) {
      throw new Error('Step 9 Failed: Authorized data access failed');
    }

    // 10. Doctor C (Unauthorized Hospital) attempts access -> EXPECT 403 FORBIDDEN
    console.log('\n🔹 STEP 10: Unauthorized Doctor C attempts access (Expected: 403 FORBIDDEN)');
    const unauthorizedAccess = await getJSON(`/api/transfers/${transferId}/data`, {
      Authorization: `Bearer ${tokenDocC}`
    });
    console.log('Status (Expected 403):', unauthorizedAccess.status, '| Message:', unauthorizedAccess.body.message);
    if (unauthorizedAccess.status !== 403) throw new Error('Step 10 Failed: Doctor C access was not blocked!');

    // 11. Break-Glass Emergency Access Test
    console.log('\n🔹 STEP 11: Break-Glass Emergency Access workflow');
    const emergencyRes = await postJSON('/api/emergency-access/request', {
      patient_id: 4, // Patient Meera Deshmukh (Unconscious polytrauma)
      reason: 'Patient is unconscious in shock following RTA and requires emergency surgical intervention.'
    }, {
      Authorization: `Bearer ${tokenDocA}`
    });
    console.log('Status:', emergencyRes.status, '| Emergency Session:', emergencyRes.body.emergency_session?.status);
    console.log('Emergency Scope:', emergencyRes.body.emergency_session?.scope);
    if (emergencyRes.status !== 200) throw new Error('Step 11 Failed: Emergency Break-Glass');

    // 12. Verify Append-Only Audit Trail contains all events
    console.log('\n🔹 STEP 12: Verify Append-Only Audit Logs');
    const auditRes = await getJSON('/api/audit-logs', {
      Authorization: `Bearer ${tokenDocA}`
    });
    console.log('Status:', auditRes.status, '| Total Audit Records:', auditRes.body.total);
    const actions = auditRes.body.data.map(l => l.action);
    console.log('Recorded Actions:', actions.slice(0, 8).join(', '));
    if (auditRes.status !== 200 || auditRes.body.total < 6) throw new Error('Step 12 Failed: Audit trail verification');

    console.log('\n\x1b[32m%s\x1b[0m', '✅ ALL 12 END-TO-END SECURE DATA EXCHANGE TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runFullExchangeTests();
