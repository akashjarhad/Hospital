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

    console.log('\n\x1b[32m%s\x1b[0m', '✅ ALL FEATURE 1 AUTH & ACCESS CONTROL TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
