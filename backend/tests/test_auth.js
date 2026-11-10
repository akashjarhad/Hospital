const http = require('http');

async function runTests() {
  const { app, server } = require('../src/server');
  
  // Wait a moment for server to listen
  await new Promise(res => setTimeout(res, 500));

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
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseData) }));
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
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseData) }));
      });
      req.on('error', reject);
      req.end();
    });
  };

  try {
    console.log('\n--- 🧪 TEST 1: Login as AIIMS Doctor ---');
    const loginRes1 = await postJSON('/api/auth/login', {
      email: 'dr.ramesh@aiims.edu.in',
      password: 'doctor123'
    });
    console.log('Status:', loginRes1.status);
    console.log('User Name:', loginRes1.body.user?.name);
    console.log('Hospital Scope:', loginRes1.body.hospital?.name, `(#${loginRes1.body.hospital?.id})`);
    console.log('Token received:', !!loginRes1.body.token);

    if (loginRes1.status !== 200 || !loginRes1.body.token) throw new Error('Test 1 Failed');

    const token1 = loginRes1.body.token;

    console.log('\n--- 🧪 TEST 2: Verify /api/auth/me with JWT ---');
    const meRes = await getJSON('/api/auth/me', {
      Authorization: `Bearer ${token1}`
    });
    console.log('Status:', meRes.status);
    console.log('Profile:', meRes.body.user?.name, '-', meRes.body.user?.role);
    console.log('Hospital Affiliation:', meRes.body.hospital?.name);

    if (meRes.status !== 200 || meRes.body.user?.role.toLowerCase() !== 'doctor') throw new Error('Test 2 Failed');

    console.log('\n--- 🧪 TEST 3: Login as Apollo Doctor (Hospital B) ---');
    const loginRes2 = await postJSON('/api/auth/login', {
      email: 'dr.priya@apollo.com',
      password: 'doctor123'
    });
    console.log('Status:', loginRes2.status);
    console.log('User Name:', loginRes2.body.user?.name);
    console.log('Hospital Scope:', loginRes2.body.hospital?.name, `(#${loginRes2.body.hospital?.id})`);

    if (loginRes2.status !== 200 || loginRes2.body.hospital?.id !== 2) throw new Error('Test 3 Failed');

    console.log('\n--- 🧪 TEST 4: Fetch Network Hospitals List ---');
    const hospitalsRes = await getJSON('/api/hospitals');
    console.log('Status:', hospitalsRes.status);
    console.log('Total Hospitals in Network:', hospitalsRes.body.data?.length);

    if (hospitalsRes.status !== 200 || hospitalsRes.body.data?.length === 0) throw new Error('Test 4 Failed');

    console.log('\n--- 🧪 TEST 5: Invalid Credentials Rejection ---');
    const failRes = await postJSON('/api/auth/login', {
      email: 'dr.ramesh@aiims.edu.in',
      password: 'wrongpassword'
    });
    console.log('Status (Expected 401):', failRes.status);
    console.log('Message:', failRes.body.message);

    if (failRes.status !== 401) throw new Error('Test 5 Failed');

    console.log('\n--- 🧪 TEST 6: Login as Demo Patient via Email ---');
    const patEmailLogin = await postJSON('/api/auth/login', {
      email: 'patient@demo.local',
      password: 'patient123'
    });
    console.log('Status:', patEmailLogin.status, '| User:', patEmailLogin.body.user?.name, '| Role:', patEmailLogin.body.user?.role);
    if (patEmailLogin.status !== 200 || patEmailLogin.body.user?.role !== 'PATIENT') throw new Error('Test 6 Failed');

    console.log('\n--- 🧪 TEST 7: Login as Demo Patient via Username and Alias ---');
    const patUserLogin = await postJSON('/api/auth/login', {
      username: 'patient.rajesh',
      password: 'patient123'
    });
    if (patUserLogin.status !== 200) throw new Error('Test 7a Failed: patient.rajesh login');
    const patAliasLogin = await postJSON('/api/auth/login', {
      identifier: 'patient',
      password: 'patient123'
    });
    if (patAliasLogin.status !== 200) throw new Error('Test 7b Failed: patient alias login');
    console.log('✓ Successfully authenticated via username "patient.rajesh" and alias "patient"');

    console.log('\n--- 🧪 TEST 8: Login as Demo Patient via Health ID / Patient Code ---');
    const patCodeLogin = await postJSON('/api/auth/login', {
      identifier: 'P-10001',
      password: 'patient123'
    });
    if (patCodeLogin.status !== 200) throw new Error('Test 8a Failed: P-10001 code login');
    const patAbhaLogin = await postJSON('/api/auth/login', {
      identifier: 'ABHA-9821-4412-8801',
      password: 'patient123'
    });
    if (patAbhaLogin.status !== 200) throw new Error('Test 8b Failed: ABHA ID login');
    console.log('✓ Successfully authenticated via "P-10001" and "ABHA-9821-4412-8801"');

    console.log('\n--- 🧪 TEST 9: Patient Self-Registration (Flexible Fields) ---');
    const ts = Date.now();
    const regPayload = {
      name: `Vikram Singh ${ts}`,
      email: `vikram.${ts}@patient.test`,
      dob: '1991-07-22',
      gender: 'Male',
      password: 'password123',
      phone: '+91-9876599999',
      blood_group: 'A+'
    };
    const regRes = await postJSON('/api/auth/register/patient', regPayload);
    console.log('Registration Status:', regRes.status, '| Patient ABHA:', regRes.body.user?.unique_health_id);
    if (regRes.status !== 201 || !regRes.body.user?.patient_id) throw new Error('Test 9 Failed: Patient self-registration');

    console.log('\n--- 🧪 TEST 10: Authenticate Newly Registered Patient & Verify /api/auth/me ---');
    const newPatLogin = await postJSON('/api/auth/login', {
      identifier: `vikram.${ts}@patient.test`,
      password: 'password123'
    });
    if (newPatLogin.status !== 200 || !newPatLogin.body.token) throw new Error('Test 10a Failed: New patient login');
    const newPatMe = await getJSON('/api/auth/me', {
      Authorization: `Bearer ${newPatLogin.body.token}`
    });
    console.log('Status:', newPatMe.status, '| Profile:', newPatMe.body.user?.name, '| Role:', newPatMe.body.user?.role);
    if (newPatMe.status !== 200 || newPatMe.body.user?.role !== 'PATIENT' || !newPatMe.body.user?.patient_id) {
      throw new Error('Test 10b Failed: /api/auth/me for new patient');
    }

    console.log('\n\x1b[32m%s\x1b[0m', '✅ ALL 10 AUTH, IDENTIFIER & REGISTRATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
