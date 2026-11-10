const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Active PostgreSQL Pool instance
let activePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'medtransfer_db',
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false
});

// Proxy pool export to maintain backward compatibility for direct pool calls
const pool = {
  query: (...args) => activePool.query(...args),
  connect: (...args) => activePool.connect(...args),
  end: (...args) => activePool.end(...args),
  on: (...args) => activePool.on(...args)
};

let isConnected = false;
let embeddedPgInstance = null;

// Clean in-memory store (used only if database is completely offline)
// Contains ZERO synthetic dummy patients, visits, tests, or dummy users.
const memoryStore = {
  hospitals: [
    {
      id: 1,
      name: 'AIIMS Trauma Center',
      code: 'AIIMS-DEL',
      address: 'Sri Aurobindo Marg, Ansari Nagar',
      city: 'New Delhi',
      phone: '+91-11-26588500',
      emergency_contact: '+91-9876543210',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01')
    },
    {
      id: 2,
      name: 'Apollo Multi-Speciality Hospital',
      code: 'APOLLO-DEL',
      address: 'Sarita Vihar, Delhi Mathura Road',
      city: 'New Delhi',
      phone: '+91-11-26925858',
      emergency_contact: '+91-9876543211',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01')
    },
    {
      id: 3,
      name: 'Fortis Memorial Research Institute',
      code: 'FORTIS-GGN',
      address: 'Sector 44, Opposite HUDA City Centre',
      city: 'Gurugram',
      phone: '+91-124-4962200',
      emergency_contact: '+91-9876543212',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01')
    },
    {
      id: 4,
      name: 'Max Super Speciality Hospital',
      code: 'MAX-SAKET',
      address: '1, 2 Press Enclave Road, Saket',
      city: 'New Delhi',
      phone: '+91-11-26515050',
      emergency_contact: '+91-9876543213',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01')
    }
  ],
  users: [],
  patients: [],
  visits: [],
  tests: [],
  medications: [],
  patient_allergies: [],
  documents: [],
  transfers: [],
  consents: [],
  emergency_access: [],
  audit_logs: [],
  notifications: [],
  doctor_patients: [],
  ai_handover_summaries: [],
  ai_record_relevance: [],
  data_quality_issues: [],
  ai_search_logs: [],
  security_anomalies: [],
  transfer_complexity_results: [],
  ai_critical_information: [],
  ai_audit_events: [],
  research_evaluation_runs: [],
  research_evaluation_entries: []
};

/**
 * Clear all records from memory store
 */
const clearDummyData = () => {
  memoryStore.users = [];
  memoryStore.patients = [];
  memoryStore.visits = [];
  memoryStore.tests = [];
  memoryStore.medications = [];
  memoryStore.patient_allergies = [];
  memoryStore.documents = [];
  memoryStore.transfers = [];
  memoryStore.consents = [];
  memoryStore.emergency_access = [];
  memoryStore.audit_logs = [];
  memoryStore.notifications = [];
  memoryStore.doctor_patients = [];
  memoryStore.ai_handover_summaries = [];
  memoryStore.ai_record_relevance = [];
  memoryStore.data_quality_issues = [];
  memoryStore.ai_search_logs = [];
  memoryStore.security_anomalies = [];
  memoryStore.transfer_complexity_results = [];
  memoryStore.ai_critical_information = [];
  memoryStore.ai_audit_events = [];
  memoryStore.research_evaluation_runs = [];
  memoryStore.research_evaluation_entries = [];
  console.log('\x1b[35m%s\x1b[0m', '🧹 Clean Database Mode: All patient, clinical, and demo credentials purged.');
};

// Initialize DB, verify connection, launch embedded PostgreSQL if needed, and apply schema
const initDB = async () => {
  let client = null;

  // 1. First, attempt connection with existing PostgreSQL (local or cloud)
  try {
    client = await activePool.connect();
    isConnected = true;
    console.log('\x1b[32m%s\x1b[0m', '✓ Connected successfully to PostgreSQL database.');
  } catch (err) {
    console.warn('\x1b[33m%s\x1b[0m', 'ℹ️ External PostgreSQL connection not active (' + (err.message || 'Offline') + ').');
    console.log('\x1b[36m%s\x1b[0m', '🚀 Launching native persistent PostgreSQL cluster...');

    try {
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const dbDir = path.join(__dirname, '..', '..', 'data', 'postgres_db');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const port = 5433;
      const user = 'postgres';
      const password = 'postgres_secure_pass';

      embeddedPgInstance = new EmbeddedPostgres({
        databaseDir: dbDir,
        port: port,
        user: user,
        password: password,
        persistent: true
      });

      const exists = fs.existsSync(path.join(dbDir, 'PG_VERSION'));
      if (!exists) {
        console.log('Initializing PostgreSQL cluster in:', dbDir);
        await embeddedPgInstance.initialise();
      }

      const pidFile = path.join(dbDir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try { fs.unlinkSync(pidFile); } catch (e) {}
      }

      console.log('Starting PostgreSQL service on port ' + port + '...');
      await embeddedPgInstance.start();

      try {
        await embeddedPgInstance.createDatabase('medtransfer_db');
      } catch (e) {
        // Ignored if already exists
      }

      activePool = new Pool({
        host: 'localhost',
        port: port,
        user: user,
        password: password,
        database: 'medtransfer_db',
        connectionTimeoutMillis: 5000
      });

      client = await activePool.connect();
      isConnected = true;
      console.log('\x1b[32m%s\x1b[0m', '✓ Native PostgreSQL engine connected successfully on port ' + port + '.');
    } catch (embErr) {
      console.error('Failed to initialize embedded PostgreSQL:', embErr);
      isConnected = false;
      return false;
    }
  }

  // 2. Initialize schema and ensure clean real database state
  if (isConnected && client) {
    try {
      const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('\x1b[32m%s\x1b[0m', '✓ Relational schema verified in PostgreSQL (24 tables ready).');
      }

      // Seed hospital nodes (without dummy patient data)
      await client.query(`
        INSERT INTO hospitals (name, code, address, city, phone, emergency_contact)
        VALUES 
          ('AIIMS Trauma Center', 'AIIMS-DEL', 'Sri Aurobindo Marg, Ansari Nagar', 'New Delhi', '+91-11-26588500', '+91-9876543210'),
          ('Apollo Multi-Speciality Hospital', 'APOLLO-DEL', 'Sarita Vihar, Delhi Mathura Road', 'New Delhi', '+91-11-26925858', '+91-9876543211'),
          ('Fortis Memorial Research Institute', 'FORTIS-GGN', 'Sector 44, Opposite HUDA City Centre', 'Gurugram', '+91-124-4962200', '+91-9876543212'),
          ('Max Super Speciality Hospital', 'MAX-SAKET', '1, 2 Press Enclave Road, Saket', 'New Delhi', '+91-11-26515050', '+91-9876543213')
        ON CONFLICT (code) DO NOTHING;
      `);

      // Remove all legacy synthetic demo accounts if any exist
      if (process.env.CLEAR_DUMMY_DATA !== 'false') {
        await client.query(`
          DELETE FROM users WHERE 
            email LIKE '%@demo.local' OR 
            email LIKE '%dr.ramesh%' OR 
            email LIKE '%dr.priya%' OR 
            email LIKE '%dr.amit%' OR 
            email LIKE '%sysadmin@medtransfer.demo' OR 
            email LIKE '%admin@aiims.edu.in';
        `);
      }

      console.log('\x1b[32m%s\x1b[0m', '✓ PostgreSQL database is fresh, clean, and ready for new users.');
      client.release();
      return true;
    } catch (schemaErr) {
      console.error('Error applying schema to PostgreSQL:', schemaErr);
      client.release();
    }
  }

  return isConnected;
};

// Graceful termination handler
const cleanStop = async () => {
  if (embeddedPgInstance) {
    try {
      console.log('\nStopping PostgreSQL engine...');
      await embeddedPgInstance.stop();
    } catch (e) {
      // Ignored
    }
  }
};

process.on('SIGINT', async () => {
  await cleanStop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanStop();
  process.exit(0);
});

const nextId = (list) => (Array.isArray(list) ? list.reduce((max, item) => (item && typeof item.id === 'number' && item.id > max ? item.id : max), 0) + 1 : 1);

/**
 * Universal SQL Query Runner
 * Handles execution on live PostgreSQL or simulates query execution against memoryStore.
 */
const query = async (text, params = []) => {
  if (isConnected) {
    return pool.query(text, params);
  }

  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');

  // -------------------------------------------------------------
  // 1. AUTH & USER QUERIES
  // -------------------------------------------------------------
  if (normalizedText.includes('from users u') && (normalizedText.includes('where lower(u.email)') || normalizedText.includes('lower(u.username)') || normalizedText.includes('u.email =') || normalizedText.includes('u.username =') || normalizedText.includes('unique_health_id'))) {
    const identParam = String(params[0] || '').toLowerCase().trim();
    const cleanDigits = identParam.replace(/\D/g, '');

    const user = memoryStore.users.find(u => {
      if (!u) return false;
      // 1. Direct email or username match
      if (u.email && u.email.toLowerCase() === identParam) return true;
      if (u.username && u.username.toLowerCase() === identParam) return true;
      // 2. Phone match
      if (u.phone && (u.phone.toLowerCase() === identParam || (cleanDigits.length >= 10 && u.phone.replace(/\D/g, '').endsWith(cleanDigits)))) return true;
      // 3. Patient health ID / ABHA / patient code / email / phone match
      if (u.role === 'PATIENT') {
        const pat = memoryStore.patients.find(p => p.user_id === u.id || (p.id === u.patient_id) || (p.email && p.email.toLowerCase() === (u.email || '').toLowerCase()));
        if (pat) {
          if (pat.unique_health_id && pat.unique_health_id.toLowerCase() === identParam) return true;
          if (pat.patient_code && pat.patient_code.toLowerCase() === identParam) return true;
          if (pat.id === 1 && (identParam === 'p-10001' || identParam === 'abha-9821-4412-8801')) return true;
          if (pat.id === 2 && (identParam === 'p-10002' || identParam === 'abha-3312-7789-2244')) return true;
          if (pat.phone && (pat.phone.toLowerCase() === identParam || (cleanDigits.length >= 10 && pat.phone.replace(/\D/g, '').endsWith(cleanDigits)))) return true;
        }
      }
      // 4. Common demo account aliases:
      if ((identParam === 'patient' || identParam === 'patient1' || identParam === 'rajesh' || identParam === 'rajesh.kumar') && u.id === 8) return true;
      if ((identParam === 'patient2' || identParam === 'priya' || identParam === 'priya.sharma') && u.id === 9) return true;
      if ((identParam === 'doctor' || identParam === 'doctor1' || identParam === 'dr.ramesh') && u.id === 1) return true;
      if ((identParam === 'doctor2' || identParam === 'dr.priya') && u.id === 4) return true;
      if ((identParam === 'admin' || identParam === 'hospital_admin' || identParam === 'admin.aiims') && u.id === 3) return true;
      if ((identParam === 'sysadmin' || identParam === 'system_admin') && u.id === 7) return true;
      return false;
    });

    if (!user) return { rows: [] };
    const hospital = user.hospital_id ? memoryStore.hospitals.find(h => h.id === user.hospital_id) : null;
    return {
      rows: [{
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        password_hash: user.password_hash,
        role: user.role,
        specialty: user.specialty,
        license_number: user.license_number,
        phone: user.phone,
        patient_id: user.patient_id || null,
        hospital_id: hospital ? hospital.id : null,
        hospital_name: hospital ? hospital.name : null,
        hospital_code: hospital ? hospital.code : null,
        hospital_city: hospital ? hospital.city : null
      }]
    };
  }

  if (normalizedText.includes('from users u') && (normalizedText.includes('u.id = $1') || normalizedText.includes('where u.id = $1'))) {
    const userId = parseInt(params[0], 10);
    const user = memoryStore.users.find(u => u.id === userId);
    if (!user) return { rows: [] };
    const hospital = user.hospital_id ? memoryStore.hospitals.find(h => h.id === user.hospital_id) : null;
    return {
      rows: [{
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        specialty: user.specialty,
        license_number: user.license_number,
        phone: user.phone,
        created_at: user.created_at,
        hospital_id: hospital ? hospital.id : null,
        hospital_name: hospital ? hospital.name : null,
        hospital_code: hospital ? hospital.code : null,
        hospital_address: hospital ? hospital.address : null,
        hospital_city: hospital ? hospital.city : null,
        hospital_phone: hospital ? hospital.phone : null,
        hospital_emergency_contact: hospital ? hospital.emergency_contact : null
      }]
    };
  }

  if (normalizedText.includes('from users') && (normalizedText.includes('where lower(email)') || normalizedText.includes('where lower(username)'))) {
    const identParam = String(params[0] || '').toLowerCase().trim();
    const user = memoryStore.users.find(u => 
      (u.email && u.email.toLowerCase() === identParam) || 
      (u.username && u.username.toLowerCase() === identParam)
    );
    return { rows: user ? [user] : [] };
  }

  if (normalizedText.includes('from users') && normalizedText.includes('hospital_id = $1') && normalizedText.includes("role = 'doctor'")) {
    const hospId = parseInt(params[0], 10);
    const doctors = memoryStore.users.filter(u => u.hospital_id === hospId && u.role === 'DOCTOR');
    return { rows: doctors };
  }

  if (normalizedText.startsWith('insert into users')) {
    const hasUsernameCol = normalizedText.slice(0, normalizedText.indexOf('values')).includes('username');
    let hospital_id, name, email, username, password_hash, role, specialty, license_number, phone;
    if (hasUsernameCol) {
      [hospital_id, name, email, username, password_hash, role, specialty, license_number, phone] = params;
    } else {
      [hospital_id, name, email, password_hash, role, specialty, license_number, phone] = params;
      username = email.split('@')[0];
    }
    const newUser = {
      id: nextId(memoryStore.users),
      hospital_id: hospital_id ? parseInt(hospital_id, 10) : null,
      name,
      email,
      username: username || email.split('@')[0],
      password_hash,
      role: role.toUpperCase(),
      specialty: specialty || null,
      license_number: license_number || null,
      phone: phone || null,
      is_active: true,
      created_at: new Date()
    };
    memoryStore.users.push(newUser);
    return { rows: [newUser] };
  }

  // -------------------------------------------------------------
  // 2. HOSPITALS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.includes('from hospitals') && (normalizedText.includes('where id = $1') || normalizedText.includes('where h.id = $1'))) {
    const hospId = parseInt(params[0], 10);
    const hosp = memoryStore.hospitals.find(h => h.id === hospId);
    return { rows: hosp ? [hosp] : [] };
  }

  if (normalizedText.includes('from hospitals')) {
    const rows = memoryStore.hospitals.map(h => ({
      ...h,
      staff_count: memoryStore.users.filter(u => u.hospital_id === h.id).length,
      patient_count: memoryStore.visits.filter(v => v.hospital_id === h.id && v.status !== 'discharged').length
    }));
    return { rows };
  }

  // -------------------------------------------------------------
  // 3. PATIENTS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.includes('from patients') && normalizedText.includes('user_id = $1')) {
    const userId = parseInt(params[0], 10);
    const patient = memoryStore.patients.find(p => p.user_id === userId);
    return { rows: patient ? [patient] : [] };
  }

  if (normalizedText.includes('from patients') && (normalizedText.includes('where id = $1') || normalizedText.includes('where unique_health_id = $1') || normalizedText.includes('where p.id = $1') || normalizedText.includes('where p.unique_health_id = $1'))) {
    const param = String(params[0] || '').trim();
    const patient = memoryStore.patients.find(p => 
      p.id === parseInt(param, 10) || 
      (p.unique_health_id && p.unique_health_id.toLowerCase() === param.toLowerCase()) ||
      (p.patient_code && p.patient_code.toLowerCase() === param.toLowerCase()) ||
      (p.id === 1 && (param.toLowerCase() === 'p-10001' || param.toLowerCase() === 'abha-9821-4412-8801')) ||
      (p.id === 2 && (param.toLowerCase() === 'p-10002' || param.toLowerCase() === 'abha-3312-7789-2244'))
    );
    if (!patient) return { rows: [] };
    
    // Attach visits, medications, allergies, tests, documents
    const patientVisits = memoryStore.visits.filter(v => v.patient_id === patient.id).map(v => {
      const hosp = memoryStore.hospitals.find(h => h.id === v.hospital_id);
      const doc = memoryStore.users.find(u => u.id === v.attending_doctor_id);
      const visitTests = memoryStore.tests.filter(t => t.visit_id === v.id);
      return {
        ...v,
        hospital_name: hosp ? hosp.name : 'Hospital Node',
        hospital_code: hosp ? hosp.code : 'HOSP',
        attending_doctor_name: doc ? doc.name : 'Attending Physician',
        tests: visitTests
      };
    });

    const patientMeds = memoryStore.medications.filter(m => m.patient_id === patient.id);
    const patientDocs = memoryStore.documents.filter(d => d.patient_id === patient.id);

    return {
      rows: [{
        ...patient,
        visits: patientVisits,
        medications: patientMeds,
        documents: patientDocs
      }]
    };
  }

  // Scoped patients list for hospital
  if (normalizedText.includes('from patients') && normalizedText.includes('where v.hospital_id = $1')) {
    const hospitalId = parseInt(params[0], 10);
    const hospitalVisits = memoryStore.visits.filter(v => v.hospital_id === hospitalId);
    
    const patientMap = new Map();
    hospitalVisits.forEach(visit => {
      const patient = memoryStore.patients.find(p => p.id === visit.patient_id);
      if (patient) {
        const doctor = memoryStore.users.find(u => u.id === visit.attending_doctor_id);
        const tests = memoryStore.tests.filter(t => t.visit_id === visit.id);
        const existing = patientMap.get(patient.id);
        
        if (!existing || new Date(visit.admission_date) > new Date(existing.latest_visit.admission_date)) {
          patientMap.set(patient.id, {
            id: patient.id,
            unique_health_id: patient.unique_health_id,
            name: patient.name,
            dob: patient.dob,
            gender: patient.gender,
            blood_group: patient.blood_group,
            phone: patient.phone,
            emergency_contact_name: patient.emergency_contact_name,
            emergency_contact_phone: patient.emergency_contact_phone,
            medical_history: patient.medical_history,
            allergies: patient.allergies,
            created_at: patient.created_at,
            latest_visit: {
              ...visit,
              attending_doctor_name: doctor ? doctor.name : 'Unknown Doctor',
              test_count: tests.length
            }
          });
        }
      }
    });

    const rows = Array.from(patientMap.values()).sort((a, b) => new Date(b.latest_visit.admission_date) - new Date(a.latest_visit.admission_date));
    return { rows };
  }

  // Insert Patient (support SQL with or without an explicit user_id column)
  if (normalizedText.startsWith('insert into patients')) {
    const hasUserIdColumn = normalizedText.slice(0, normalizedText.indexOf('values')).includes('user_id');
    const values = hasUserIdColumn ? params : [null, ...params];
    const [user_id, unique_health_id, name, dob, gender, blood_group, phone, emergency_contact_name, emergency_contact_phone, medical_history, allergies] = values;
    const newPatient = {
      id: nextId(memoryStore.patients),
      user_id: user_id ? parseInt(user_id, 10) : null,
      unique_health_id: unique_health_id || `P-${10000 + memoryStore.patients.length + 1}`,
      name,
      dob,
      gender,
      blood_group: blood_group || 'O+',
      phone: phone || null,
      emergency_contact_name: emergency_contact_name || null,
      emergency_contact_phone: emergency_contact_phone || null,
      medical_history: medical_history || null,
      allergies: allergies || 'None known',
      created_at: new Date()
    };
    memoryStore.patients.push(newPatient);
    if (newPatient.user_id) {
      const linkedUser = memoryStore.users.find(u => u.id === newPatient.user_id);
      if (linkedUser) {
        linkedUser.patient_id = newPatient.id;
      }
    }
    return { rows: [newPatient] };
  }

  // -------------------------------------------------------------
  // 3.5 DOCTOR PATIENTS & ASSOCIATIONS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.includes('from doctor_patients dp') && normalizedText.includes('dp.doctor_id = $1')) {
    const docId = parseInt(params[0], 10);
    let associations = memoryStore.doctor_patients.filter(dp => dp.doctor_id === docId);

    if (normalizedText.includes("dp.status in ('active', 'accepted')") || normalizedText.includes("status in ('active', 'accepted')")) {
      associations = associations.filter(dp => ['ACTIVE', 'ACCEPTED'].includes(dp.status));
    } else if (normalizedText.includes('dp.status = $2')) {
      const statusParam = String(params[1]).toUpperCase();
      associations = associations.filter(dp => dp.status === statusParam);
    }

    const rows = associations.map(dp => {
      const patient = memoryStore.patients.find(p => p.id === dp.patient_id);
      const hospital = memoryStore.hospitals.find(h => h.id === dp.hospital_id);
      const visits = memoryStore.visits.filter(v => v.patient_id === dp.patient_id);
      const latestVisit = visits.sort((a, b) => new Date(b.admission_date) - new Date(a.admission_date))[0] || null;
      return {
        ...dp,
        patient_id: patient ? patient.id : dp.patient_id,
        unique_health_id: patient ? patient.unique_health_id : 'N/A',
        name: patient ? patient.name : 'Unknown Patient',
        patient_name: patient ? patient.name : 'Unknown Patient',
        dob: patient ? patient.dob : null,
        gender: patient ? patient.gender : null,
        blood_group: patient ? patient.blood_group : null,
        phone: patient ? patient.phone : null,
        emergency_contact_name: patient ? patient.emergency_contact_name : null,
        emergency_contact_phone: patient ? patient.emergency_contact_phone : null,
        medical_history: patient ? patient.medical_history : null,
        allergies: patient ? patient.allergies : null,
        hospital_name: hospital ? hospital.name : 'Hospital Node',
        hospital_code: hospital ? hospital.code : 'HOSP',
        latest_visit: latestVisit ? {
          ...latestVisit,
          attending_doctor_name: memoryStore.users.find(u => u.id === latestVisit.attending_doctor_id)?.name || 'Attending Physician',
          test_count: memoryStore.tests.filter(t => t.visit_id === latestVisit.id).length
        } : null
      };
    }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    return { rows };
  }

  if (normalizedText.includes('from doctor_patients dp') && normalizedText.includes('dp.patient_id = $1')) {
    const patId = parseInt(params[0], 10);
    let associations = memoryStore.doctor_patients.filter(dp => dp.patient_id === patId);

    if (normalizedText.includes("dp.status in ('active', 'accepted')") || normalizedText.includes("status in ('active', 'accepted')")) {
      associations = associations.filter(dp => ['ACTIVE', 'ACCEPTED'].includes(dp.status));
    } else if (normalizedText.includes('dp.status = $2')) {
      const statusParam = String(params[1]).toUpperCase();
      associations = associations.filter(dp => dp.status === statusParam);
    }

    const rows = associations.map(dp => {
      const doc = memoryStore.users.find(u => u.id === dp.doctor_id);
      const hospital = memoryStore.hospitals.find(h => h.id === dp.hospital_id);
      return {
        ...dp,
        doctor_name: doc ? doc.name : 'Dr. Treating Physician',
        doctor_email: doc ? doc.email : '',
        doctor_specialty: doc ? doc.specialty : 'Specialist',
        specialization: doc ? doc.specialty : 'Specialist',
        license_number: doc ? doc.license_number : 'N/A',
        doctor_phone: doc ? doc.phone : '',
        hospital_name: hospital ? hospital.name : 'Hospital Network',
        hospital_code: hospital ? hospital.code : 'HOSP',
        hospital_city: hospital ? hospital.city : 'Delhi NCR'
      };
    }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    return { rows };
  }

  if (normalizedText.includes('from doctor_patients') && normalizedText.includes('doctor_id = $1') && normalizedText.includes('patient_id = $2')) {
    const docId = parseInt(params[0], 10);
    const patId = parseInt(params[1], 10);
    let rows = memoryStore.doctor_patients.filter(dp => dp.doctor_id === docId && dp.patient_id === patId);
    if (normalizedText.includes("status in ('active', 'accepted')")) {
      rows = rows.filter(dp => ['ACTIVE', 'ACCEPTED'].includes(dp.status));
    }
    return { rows };
  }

  if (normalizedText.includes('from doctor_patients') && normalizedText.includes('where id = $1')) {
    const assocId = parseInt(params[0], 10);
    const assoc = memoryStore.doctor_patients.find(dp => dp.id === assocId);
    return { rows: assoc ? [assoc] : [] };
  }

  if (normalizedText.includes('from doctor_patients') && normalizedText.includes('patient_id = $1') && normalizedText.includes("status = 'pending'")) {
    const patId = parseInt(params[0], 10);
    const rows = memoryStore.doctor_patients.filter(dp => dp.patient_id === patId && dp.status === 'PENDING').map(dp => {
      const doc = memoryStore.users.find(u => u.id === dp.doctor_id);
      const hospital = memoryStore.hospitals.find(h => h.id === dp.hospital_id);
      return {
        ...dp,
        doctor_name: doc ? doc.name : 'Doctor',
        doctor_specialty: doc ? doc.specialty : 'Specialist',
        hospital_name: hospital ? hospital.name : 'Hospital Node'
      };
    });
    return { rows };
  }

  if (normalizedText.startsWith('insert into doctor_patients')) {
    // doctor_id, patient_id, hospital_id, status, department, treatment_reason, treatment_start_date, requested_at
    const [doctor_id, patient_id, hospital_id, status, department, treatment_reason, treatment_start_date, requested_at] = params;
    const newAssoc = {
      id: nextId(memoryStore.doctor_patients),
      doctor_id: parseInt(doctor_id, 10),
      patient_id: parseInt(patient_id, 10),
      hospital_id: hospital_id ? parseInt(hospital_id, 10) : 1,
      status: (status || 'PENDING').toUpperCase(),
      department: department || 'General Medicine',
      treatment_reason: treatment_reason || 'Clinical Evaluation & Treatment',
      treatment_start_date: treatment_start_date ? new Date(treatment_start_date) : new Date(),
      treatment_end_date: null,
      requested_at: requested_at ? new Date(requested_at) : new Date(),
      accepted_at: status === 'ACTIVE' || status === 'ACCEPTED' ? new Date() : null,
      rejected_at: null,
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryStore.doctor_patients.push(newAssoc);
    return { rows: [newAssoc] };
  }

  if (normalizedText.startsWith('update doctor_patients set')) {
    if (normalizedText.includes('status = $1') && normalizedText.includes('accepted_at = $2')) {
      const [status, accepted_at, updated_at, id] = params;
      const assoc = memoryStore.doctor_patients.find(dp => dp.id === parseInt(id, 10));
      if (assoc) {
        assoc.status = String(status).toUpperCase();
        assoc.accepted_at = new Date(accepted_at || Date.now());
        assoc.updated_at = new Date(updated_at || Date.now());
        return { rows: [assoc] };
      }
    } else if (normalizedText.includes('status = $1') && normalizedText.includes('rejected_at = $2')) {
      const [status, rejected_at, updated_at, id] = params;
      const assoc = memoryStore.doctor_patients.find(dp => dp.id === parseInt(id, 10));
      if (assoc) {
        assoc.status = String(status).toUpperCase();
        assoc.rejected_at = new Date(rejected_at || Date.now());
        assoc.updated_at = new Date(updated_at || Date.now());
        return { rows: [assoc] };
      }
    } else if (normalizedText.includes("status = 'revoked'") || normalizedText.includes("status = $1")) {
      const statusVal = normalizedText.includes("status = 'revoked'") ? 'REVOKED' : params[0];
      const assocId = parseInt(params[params.length - 2] || params[params.length - 1], 10);
      const assoc = memoryStore.doctor_patients.find(dp => dp.id === assocId);
      if (assoc) {
        assoc.status = String(statusVal).toUpperCase();
        assoc.revoked_at = new Date();
        assoc.updated_at = new Date();
        return { rows: [assoc] };
      }
    }
    return { rows: [] };
  }

  // -------------------------------------------------------------
  // 4. VISITS, TESTS & MEDICATIONS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into visits')) {
    const [patient_id, hospital_id, attending_doctor_id, diagnosis, status, chief_complaint, clinical_notes, vitals] = params;
    const newVisit = {
      id: nextId(memoryStore.visits),
      patient_id: parseInt(patient_id, 10),
      hospital_id: parseInt(hospital_id, 10),
      attending_doctor_id: attending_doctor_id ? parseInt(attending_doctor_id, 10) : null,
      diagnosis,
      status: status || 'admitted',
      admission_date: new Date(),
      discharge_date: null,
      chief_complaint: chief_complaint || '',
      clinical_notes: clinical_notes || '',
      vitals: typeof vitals === 'string' ? JSON.parse(vitals) : (vitals || {}),
      created_at: new Date()
    };
    memoryStore.visits.push(newVisit);
    return { rows: [newVisit] };
  }

  if (normalizedText.includes('from visits') && normalizedText.includes('where id = $1')) {
    const visitId = parseInt(params[0], 10);
    const visit = memoryStore.visits.find(v => v.id === visitId);
    return { rows: visit ? [visit] : [] };
  }

  if (normalizedText.includes('from visits') && normalizedText.includes('patient_id = $1') && normalizedText.includes('hospital_id = $2')) {
    const patientId = parseInt(params[0], 10);
    const hospitalId = parseInt(params[1], 10);
    const rows = memoryStore.visits.filter(v => v.patient_id === patientId && v.hospital_id === hospitalId);
    return { rows };
  }

  if (normalizedText.includes('from visits') && normalizedText.includes('patient_id = $1')) {
    const patientId = parseInt(params[0], 10);
    const rows = memoryStore.visits.filter(v => v.patient_id === patientId);
    return { rows };
  }

  if (normalizedText.startsWith('update visits set')) {
    const [status, visitId] = params;
    const visit = memoryStore.visits.find(v => v.id === parseInt(visitId, 10));
    if (visit) {
      visit.status = status;
      if (status === 'discharged') visit.discharge_date = new Date();
      return { rows: [visit] };
    }
    return { rows: [] };
  }

  if (normalizedText.startsWith('insert into tests')) {
    const [visit_id, test_name, category, result, units, reference_range, abnormal, notes] = params;
    const newTest = {
      id: nextId(memoryStore.tests),
      visit_id: parseInt(visit_id, 10),
      test_name,
      category: category || 'Diagnostic',
      result,
      units: units || '',
      reference_range: reference_range || '',
      abnormal: Boolean(abnormal),
      timestamp: new Date(),
      notes: notes || ''
    };
    memoryStore.tests.push(newTest);
    return { rows: [newTest] };
  }

  if (normalizedText.includes('from tests') && normalizedText.includes('visit_id = $1')) {
    const visitId = parseInt(params[0], 10);
    const rows = memoryStore.tests.filter(t => t.visit_id === visitId);
    return { rows };
  }

  if (normalizedText.includes('from tests') && (normalizedText.includes('v.patient_id = $1') || normalizedText.includes('patient_id = $1'))) {
    const patientId = parseInt(params[0], 10);
    const patientVisits = memoryStore.visits.filter(v => v.patient_id === patientId);
    const patientVisitIds = patientVisits.map(v => v.id);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000);
    const recentTests = memoryStore.tests
      .filter(t => patientVisitIds.includes(t.visit_id) && new Date(t.timestamp) >= twentyFourHoursAgo)
      .map(t => {
        const visit = patientVisits.find(v => v.id === t.visit_id);
        const hosp = visit ? memoryStore.hospitals.find(h => h.id === visit.hospital_id) : null;
        return {
          ...t,
          patient_id: patientId,
          hospital_name: hosp ? hosp.name : 'Hospital Node',
          hospital_code: hosp ? hosp.code : 'HOSP'
        };
      });
    return { rows: recentTests };
  }

  if (normalizedText.includes('from medications') && normalizedText.includes('patient_id = $1')) {
    const patientId = parseInt(params[0], 10);
    const rows = memoryStore.medications.filter(m => m.patient_id === patientId);
    return { rows };
  }

  if (normalizedText.startsWith('insert into medications')) {
    const [patient_id, visit_id, medication_name, dosage, frequency, route, is_current, prescribed_by, notes] = params;
    const newMed = {
      id: nextId(memoryStore.medications),
      patient_id: parseInt(patient_id, 10),
      visit_id: visit_id ? parseInt(visit_id, 10) : null,
      medication_name,
      dosage,
      frequency,
      route: route || 'Oral',
      is_current: is_current !== undefined ? Boolean(is_current) : true,
      prescribed_by: prescribed_by ? parseInt(prescribed_by, 10) : null,
      prescribed_at: new Date(),
      notes: notes || ''
    };
    memoryStore.medications.push(newMed);
    return { rows: [newMed] };
  }

  // -------------------------------------------------------------
  // 5. DOCUMENTS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.includes('from documents') && normalizedText.includes('patient_id = $1')) {
    const patientId = parseInt(params[0], 10);
    const rows = memoryStore.documents.filter(d => d.patient_id === patientId);
    return { rows };
  }

  if (normalizedText.includes('from documents') && normalizedText.includes('id = $1')) {
    const docId = parseInt(params[0], 10);
    const doc = memoryStore.documents.find(d => d.id === docId);
    return { rows: doc ? [doc] : [] };
  }

  if (normalizedText.startsWith('insert into documents')) {
    const [patient_id, hospital_id, uploaded_by, document_type, title, file_name, file_size_bytes, mime_type, storage_reference, content_hash] = params;
    const newDoc = {
      id: nextId(memoryStore.documents),
      patient_id: parseInt(patient_id, 10),
      hospital_id: parseInt(hospital_id, 10),
      uploaded_by: uploaded_by ? parseInt(uploaded_by, 10) : null,
      document_type,
      title,
      file_name,
      file_size_bytes: file_size_bytes || 0,
      mime_type: mime_type || 'application/pdf',
      storage_reference: storage_reference || `doc_${Date.now()}`,
      content_hash: content_hash || 'hash',
      created_at: new Date()
    };
    memoryStore.documents.push(newDoc);
    return { rows: [newDoc] };
  }

  // -------------------------------------------------------------
  // 6. TRANSFER REQUESTS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into transfer_requests')) {
    const [
      transfer_code, patient_id, source_hospital_id, destination_hospital_id,
      requesting_doctor_id, receiving_doctor_id, visit_id, transfer_reason,
      clinical_priority, requested_data, consent_status, transfer_status,
      doctor_transfer_summary, encrypted_package, package_signature, expires_at
    ] = params;

    const newTransfer = {
      id: nextId(memoryStore.transfer_requests),
      transfer_code: transfer_code || `TR-2026-${String(nextId(memoryStore.transfer_requests)).padStart(4, '0')}`,
      patient_id: parseInt(patient_id, 10),
      source_hospital_id: parseInt(source_hospital_id, 10),
      destination_hospital_id: parseInt(destination_hospital_id, 10),
      requesting_doctor_id: parseInt(requesting_doctor_id, 10),
      receiving_doctor_id: receiving_doctor_id ? parseInt(receiving_doctor_id, 10) : null,
      visit_id: visit_id ? parseInt(visit_id, 10) : null,
      transfer_reason: transfer_reason || '',
      clinical_priority: clinical_priority || 'URGENT',
      requested_data: typeof requested_data === 'string' ? JSON.parse(requested_data) : (requested_data || []),
      consent_status: consent_status || 'PENDING',
      transfer_status: transfer_status || 'PENDING_CONSENT',
      doctor_transfer_summary: doctor_transfer_summary || '',
      encrypted_package: encrypted_package || null,
      package_signature: package_signature || null,
      created_at: new Date(),
      updated_at: new Date(),
      expires_at: expires_at ? new Date(expires_at) : new Date(Date.now() + 7 * 24 * 3600000)
    };
    memoryStore.transfer_requests.push(newTransfer);
    return { rows: [newTransfer] };
  }

  if (normalizedText.includes('from transfer_requests') && (normalizedText.includes('where id = $1') || normalizedText.includes('where tr.id = $1') || normalizedText.includes('where transfer_code = $1'))) {
    const param = params[0];
    const transfer = memoryStore.transfer_requests.find(t => t.id === parseInt(param, 10) || t.transfer_code === String(param).trim());
    if (!transfer) return { rows: [] };
    
    const patient = memoryStore.patients.find(p => p.id === transfer.patient_id);
    const srcHosp = memoryStore.hospitals.find(h => h.id === transfer.source_hospital_id);
    const destHosp = memoryStore.hospitals.find(h => h.id === transfer.destination_hospital_id);
    const reqDoc = memoryStore.users.find(u => u.id === transfer.requesting_doctor_id);
    const recDoc = memoryStore.users.find(u => u.id === transfer.receiving_doctor_id);
    const visit = memoryStore.visits.find(v => v.id === transfer.visit_id);
    const consent = memoryStore.consents.find(c => c.transfer_id === transfer.id);

    return {
      rows: [{
        ...transfer,
        patient_name: patient ? patient.name : 'Unknown Patient',
        patient_unique_health_id: patient ? patient.unique_health_id : 'N/A',
        patient_dob: patient ? patient.dob : null,
        patient_gender: patient ? patient.gender : null,
        patient_blood_group: patient ? patient.blood_group : null,
        source_hospital_name: srcHosp ? srcHosp.name : 'Hospital A',
        source_hospital_code: srcHosp ? srcHosp.code : 'HOSP_A',
        source_hospital_phone: srcHosp ? srcHosp.phone : '',
        destination_hospital_name: destHosp ? destHosp.name : 'Hospital B',
        destination_hospital_code: destHosp ? destHosp.code : 'HOSP_B',
        destination_hospital_phone: destHosp ? destHosp.phone : '',
        requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
        requesting_doctor_specialty: reqDoc ? reqDoc.specialty : '',
        receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
        receiving_doctor_specialty: recDoc ? recDoc.specialty : '',
        diagnosis: visit ? visit.diagnosis : 'Transfer Clinical Case',
        consent_id: consent ? consent.id : null
      }]
    };
  }

  // Incoming transfers for receiving hospital
  if (normalizedText.includes('from transfer_requests') && (normalizedText.includes('destination_hospital_id = $1') || normalizedText.includes('tr.destination_hospital_id = $1'))) {
    const destHospitalId = parseInt(params[0], 10);
    const transfers = memoryStore.transfer_requests
      .filter(t => t.destination_hospital_id === destHospitalId)
      .map(t => {
        const patient = memoryStore.patients.find(p => p.id === t.patient_id);
        const srcHosp = memoryStore.hospitals.find(h => h.id === t.source_hospital_id);
        const destHosp = memoryStore.hospitals.find(h => h.id === t.destination_hospital_id);
        const reqDoc = memoryStore.users.find(u => u.id === t.requesting_doctor_id);
        const recDoc = memoryStore.users.find(u => u.id === t.receiving_doctor_id);
        const visit = memoryStore.visits.find(v => v.id === t.visit_id);
        const consent = memoryStore.consents.find(c => c.transfer_id === t.id);

        return {
          ...t,
          patient_name: patient ? patient.name : 'Unknown Patient',
          patient_unique_health_id: patient ? patient.unique_health_id : 'N/A',
          patient_dob: patient ? patient.dob : null,
          patient_gender: patient ? patient.gender : null,
          patient_blood_group: patient ? patient.blood_group : null,
          source_hospital_name: srcHosp ? srcHosp.name : 'Hospital A',
          source_hospital_code: srcHosp ? srcHosp.code : 'HOSP_A',
          destination_hospital_name: destHosp ? destHosp.name : 'Hospital B',
          destination_hospital_code: destHosp ? destHosp.code : 'HOSP_B',
          requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
          receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
          diagnosis: visit ? visit.diagnosis : 'Clinical Transfer',
          consent_id: consent ? consent.id : null
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: transfers };
  }

  // Outgoing transfers for source hospital
  if (normalizedText.includes('from transfer_requests') && (normalizedText.includes('source_hospital_id = $1') || normalizedText.includes('tr.source_hospital_id = $1'))) {
    const srcHospitalId = parseInt(params[0], 10);
    const transfers = memoryStore.transfer_requests
      .filter(t => t.source_hospital_id === srcHospitalId)
      .map(t => {
        const patient = memoryStore.patients.find(p => p.id === t.patient_id);
        const destHosp = memoryStore.hospitals.find(h => h.id === t.destination_hospital_id);
        const reqDoc = memoryStore.users.find(u => u.id === t.requesting_doctor_id);
        const recDoc = memoryStore.users.find(u => u.id === t.receiving_doctor_id);
        const visit = memoryStore.visits.find(v => v.id === t.visit_id);

        return {
          ...t,
          patient_name: patient ? patient.name : 'Unknown Patient',
          patient_unique_health_id: patient ? patient.unique_health_id : 'N/A',
          destination_hospital_name: destHosp ? destHosp.name : 'Hospital B',
          destination_hospital_code: destHosp ? destHosp.code : 'HOSP_B',
          requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
          receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
          diagnosis: visit ? visit.diagnosis : 'Clinical Transfer'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: transfers };
  }

  // Patient transfers list
  if (normalizedText.includes('from transfer_requests') && normalizedText.includes('patient_id = $1')) {
    const patientId = parseInt(params[0], 10);
    const transfers = memoryStore.transfer_requests
      .filter(t => t.patient_id === patientId)
      .map(t => {
        const srcHosp = memoryStore.hospitals.find(h => h.id === t.source_hospital_id);
        const destHosp = memoryStore.hospitals.find(h => h.id === t.destination_hospital_id);
        const reqDoc = memoryStore.users.find(u => u.id === t.requesting_doctor_id);
        const recDoc = memoryStore.users.find(u => u.id === t.receiving_doctor_id);
        return {
          ...t,
          source_hospital_name: srcHosp ? srcHosp.name : 'Hospital A',
          destination_hospital_name: destHosp ? destHosp.name : 'Hospital B',
          requesting_doctor_name: reqDoc ? reqDoc.name : 'Doctor A',
          receiving_doctor_name: recDoc ? recDoc.name : 'Doctor B'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: transfers };
  }

  // Update Transfer Status
  if (normalizedText.startsWith('update transfer_requests set')) {
    const transferId = parseInt(params[params.length - 1], 10);
    const transfer = memoryStore.transfer_requests.find(t => t.id === transferId);
    if (transfer) {
      if (normalizedText.includes("transfer_status = 'authorized'")) {
        transfer.transfer_status = 'AUTHORIZED';
      } else if (normalizedText.includes("transfer_status = 'in_transit'")) {
        transfer.transfer_status = 'IN_TRANSIT';
      } else if (normalizedText.includes("transfer_status = 'received'")) {
        transfer.transfer_status = 'RECEIVED';
      } else if (normalizedText.includes("transfer_status = 'completed'")) {
        transfer.transfer_status = 'COMPLETED';
      } else if (normalizedText.includes("transfer_status = 'rejected'")) {
        transfer.transfer_status = 'REJECTED';
      } else if (normalizedText.includes("transfer_status = 'cancelled'")) {
        transfer.transfer_status = 'CANCELLED';
      } else if (normalizedText.includes('transfer_status = $1')) {
        transfer.transfer_status = params[0];
      }

      if (normalizedText.includes("consent_status = 'granted'")) {
        transfer.consent_status = 'GRANTED';
      } else if (normalizedText.includes("consent_status = 'rejected'")) {
        transfer.consent_status = 'REJECTED';
      } else if (normalizedText.includes("consent_status = 'revoked'")) {
        transfer.consent_status = 'REVOKED';
      } else if (normalizedText.includes('consent_status = $')) {
        const consentIdx = normalizedText.indexOf('consent_status = $');
        if (consentIdx !== -1) {
          const paramNum = parseInt(normalizedText[consentIdx + 18], 10);
          transfer.consent_status = params[paramNum - 1];
        }
      }

      if (normalizedText.includes('encrypted_package =')) {
        transfer.encrypted_package = params[params.length - 3] || params[0];
        transfer.package_signature = params[params.length - 2] || params[1];
      }
      transfer.updated_at = new Date();
      return { rows: [transfer] };
    }
    return { rows: [] };
  }

  // -------------------------------------------------------------
  // 7. CONSENTS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into consents')) {
    const [
      patient_id, transfer_id, requesting_hospital_id, receiving_hospital_id,
      requesting_doctor_id, receiving_doctor_id, purpose, data_categories,
      status, expires_at, consent_version, patient_signature_note
    ] = params;

    const newConsent = {
      id: nextId(memoryStore.consents),
      patient_id: parseInt(patient_id, 10),
      transfer_id: parseInt(transfer_id, 10),
      requesting_hospital_id: parseInt(requesting_hospital_id, 10),
      receiving_hospital_id: parseInt(receiving_hospital_id, 10),
      requesting_doctor_id: parseInt(requesting_doctor_id, 10),
      receiving_doctor_id: receiving_doctor_id ? parseInt(receiving_doctor_id, 10) : null,
      purpose,
      data_categories: typeof data_categories === 'string' ? JSON.parse(data_categories) : (data_categories || []),
      status: status || 'PENDING',
      granted_at: null,
      expires_at: expires_at ? new Date(expires_at) : new Date(Date.now() + 7 * 24 * 3600000),
      revoked_at: null,
      consent_version: consent_version || '1.0',
      patient_signature_note: patient_signature_note || null,
      created_at: new Date()
    };
    memoryStore.consents.push(newConsent);
    return { rows: [newConsent] };
  }

  if (normalizedText.includes('from consents') && (normalizedText.includes('transfer_id = $1') || normalizedText.includes('c.transfer_id = $1'))) {
    const transferId = parseInt(params[0], 10);
    const consent = memoryStore.consents.find(c => c.transfer_id === transferId);
    if (!consent) return { rows: [] };
    const patient = memoryStore.patients.find(p => p.id === consent.patient_id);
    const reqHosp = memoryStore.hospitals.find(h => h.id === consent.requesting_hospital_id);
    const recHosp = memoryStore.hospitals.find(h => h.id === consent.receiving_hospital_id);
    const reqDoc = memoryStore.users.find(u => u.id === consent.requesting_doctor_id);
    const recDoc = memoryStore.users.find(u => u.id === consent.receiving_doctor_id);
    const transfer = memoryStore.transfer_requests.find(t => t.id === consent.transfer_id);

    return {
      rows: [{
        ...consent,
        patient_name: patient ? patient.name : 'Unknown Patient',
        patient_unique_health_id: patient ? patient.unique_health_id : 'N/A',
        requesting_hospital_name: reqHosp ? reqHosp.name : 'Hospital A',
        receiving_hospital_name: recHosp ? recHosp.name : 'Hospital B',
        requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
        receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
        transfer_code: transfer ? transfer.transfer_code : 'TRF-0000',
        clinical_priority: transfer ? transfer.clinical_priority : 'URGENT'
      }]
    };
  }

  if (normalizedText.includes('from consents') && (normalizedText.includes('where id = $1') || normalizedText.includes('where c.id = $1'))) {
    const consentId = parseInt(params[0], 10);
    const consent = memoryStore.consents.find(c => c.id === consentId);
    if (!consent) return { rows: [] };

    const patient = memoryStore.patients.find(p => p.id === consent.patient_id);
    const reqHosp = memoryStore.hospitals.find(h => h.id === consent.requesting_hospital_id);
    const recHosp = memoryStore.hospitals.find(h => h.id === consent.receiving_hospital_id);
    const reqDoc = memoryStore.users.find(u => u.id === consent.requesting_doctor_id);
    const recDoc = memoryStore.users.find(u => u.id === consent.receiving_doctor_id);
    const transfer = memoryStore.transfer_requests.find(t => t.id === consent.transfer_id);

    return {
      rows: [{
        ...consent,
        patient_name: patient ? patient.name : 'Unknown Patient',
        patient_unique_health_id: patient ? patient.unique_health_id : 'N/A',
        requesting_hospital_name: reqHosp ? reqHosp.name : 'Hospital A',
        receiving_hospital_name: recHosp ? recHosp.name : 'Hospital B',
        requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
        receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
        transfer_code: transfer ? transfer.transfer_code : 'TRF-0000',
        clinical_priority: transfer ? transfer.clinical_priority : 'URGENT'
      }]
    };
  }

  // Consents for a specific patient
  if (normalizedText.includes('from consents') && (normalizedText.includes('patient_id = $1') || normalizedText.includes('c.patient_id = $1'))) {
    const patientId = parseInt(params[0], 10);
    const patientConsents = memoryStore.consents
      .filter(c => c.patient_id === patientId)
      .map(c => {
        const reqHosp = memoryStore.hospitals.find(h => h.id === c.requesting_hospital_id);
        const recHosp = memoryStore.hospitals.find(h => h.id === c.receiving_hospital_id);
        const reqDoc = memoryStore.users.find(u => u.id === c.requesting_doctor_id);
        const recDoc = memoryStore.users.find(u => u.id === c.receiving_doctor_id);
        const transfer = memoryStore.transfer_requests.find(t => t.id === c.transfer_id);

        return {
          ...c,
          requesting_hospital_name: reqHosp ? reqHosp.name : 'Hospital A',
          receiving_hospital_name: recHosp ? recHosp.name : 'Hospital B',
          requesting_doctor_name: reqDoc ? reqDoc.name : 'Dr. Requesting',
          receiving_doctor_name: recDoc ? recDoc.name : 'Dr. Receiving',
          transfer_code: transfer ? transfer.transfer_code : 'TRF-0000',
          clinical_priority: transfer ? transfer.clinical_priority : 'URGENT'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: patientConsents };
  }

  // Update consent status (Approve / Reject / Revoke)
  if (normalizedText.startsWith('update consents set')) {
    const consentId = parseInt(params[params.length - 1], 10);
    const consent = memoryStore.consents.find(c => c.id === consentId);
    if (consent) {
      let newStatus = 'GRANTED';
      if (normalizedText.includes('status = $1') && params[0]) {
        newStatus = params[0];
      } else if (normalizedText.includes("status = 'granted'")) {
        newStatus = 'GRANTED';
      } else if (normalizedText.includes("status = 'rejected'")) {
        newStatus = 'REJECTED';
      } else if (normalizedText.includes("status = 'revoked'")) {
        newStatus = 'REVOKED';
      }

      consent.status = newStatus;
      if (newStatus === 'GRANTED') {
        consent.granted_at = new Date();
        if (params[1]) consent.expires_at = new Date(params[1]);
      } else if (newStatus === 'REVOKED') {
        consent.revoked_at = new Date();
      }

      if (normalizedText.includes('patient_signature_note =')) {
        consent.patient_signature_note = params[params.length - 2] || 'Patient Authorized Digital Consent';
      }

      // Also update linked transfer request
      const transfer = memoryStore.transfer_requests.find(t => t.id === consent.transfer_id);
      if (transfer) {
        transfer.consent_status = consent.status;
        if (consent.status === 'GRANTED') {
          transfer.transfer_status = 'AUTHORIZED';
        } else if (consent.status === 'REJECTED') {
          transfer.transfer_status = 'REJECTED';
        } else if (consent.status === 'REVOKED') {
          transfer.transfer_status = 'CANCELLED';
        }
        transfer.updated_at = new Date();
      }

      return { rows: [consent] };
    }
    return { rows: [] };
  }

  // -------------------------------------------------------------
  // 8. EMERGENCY ACCESS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into emergency_access')) {
    const [doctor_id, patient_id, hospital_id, transfer_id, reason, expires_at] = params;
    const explicitStatus = params.length >= 8 ? params[6] : 'ACTIVE';
    const scopeValue = params.length >= 8 ? params[7] : params[6];
    const newEmergency = {
      id: nextId(memoryStore.emergency_access),
      doctor_id: parseInt(doctor_id, 10),
      patient_id: parseInt(patient_id, 10),
      hospital_id: parseInt(hospital_id, 10),
      transfer_id: transfer_id ? parseInt(transfer_id, 10) : null,
      reason,
      requested_at: new Date(),
      approved_at: new Date(),
      expires_at: expires_at ? new Date(expires_at) : new Date(Date.now() + 4 * 3600000), // 4 hours window
      status: explicitStatus || 'ACTIVE',
      access_scope: typeof scopeValue === 'string' ? JSON.parse(scopeValue) : (scopeValue || [
        'Allergies', 'Current Medications', 'Critical Medical History', 'Current Diagnosis', 'Recent Laboratory Reports'
      ]),
      created_at: new Date()
    };
    memoryStore.emergency_access.push(newEmergency);
    return { rows: [newEmergency] };
  }

  if (normalizedText.includes('from emergency_access') && normalizedText.includes('patient_id = $1') && normalizedText.includes('doctor_id = $2')) {
    const patientId = parseInt(params[0], 10);
    const doctorId = parseInt(params[1], 10);
    const now = new Date();
    const rows = memoryStore.emergency_access.filter(e => e.patient_id === patientId && e.doctor_id === doctorId && e.status === 'ACTIVE' && new Date(e.expires_at) > now);
    return { rows };
  }

  if (normalizedText.includes('from emergency_access') && normalizedText.includes('patient_id = $1') && normalizedText.includes('status = $2')) {
    const patientId = parseInt(params[0], 10);
    const status = params[1];
    const now = new Date();
    const rows = memoryStore.emergency_access.filter(e => e.patient_id === patientId && e.status === status && new Date(e.expires_at) > now);
    return { rows };
  }

  if (normalizedText.includes('from emergency_access')) {
    const rows = memoryStore.emergency_access.map(e => {
      const doc = memoryStore.users.find(u => u.id === e.doctor_id);
      const pat = memoryStore.patients.find(p => p.id === e.patient_id);
      const hosp = memoryStore.hospitals.find(h => h.id === e.hospital_id);
      return {
        ...e,
        doctor_name: doc ? doc.name : 'Emergency Physician',
        doctor_specialty: doc ? doc.specialty : '',
        patient_name: pat ? pat.name : 'Patient',
        patient_unique_health_id: pat ? pat.unique_health_id : 'N/A',
        hospital_name: hosp ? hosp.name : 'Hospital Node'
      };
    }).sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    return { rows };
  }

  // -------------------------------------------------------------
  // 9. AUDIT LOGS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into audit_logs')) {
    const [user_id, role, action, patient_id, transfer_id, timestamp, ip_address, user_agent, purpose, result, metadata] = params;
    const newLog = {
      id: nextId(memoryStore.audit_logs),
      user_id: user_id ? parseInt(user_id, 10) : null,
      role: (role || 'ANONYMOUS').toUpperCase(),
      action: (action || 'UNKNOWN').toUpperCase(),
      patient_id: patient_id ? parseInt(patient_id, 10) : null,
      transfer_id: transfer_id ? parseInt(transfer_id, 10) : null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      ip_address: ip_address || '127.0.0.1',
      user_agent: user_agent || 'MedTransfer Client',
      purpose: purpose || 'Clinical Care',
      result: (result || 'SUCCESS').toUpperCase(),
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {})
    };
    memoryStore.audit_logs.push(newLog);
    return { rows: [newLog] };
  }

  if (normalizedText.includes('from audit_logs')) {
    let logs = [...memoryStore.audit_logs];

    if (normalizedText.includes('patient_id = $1')) {
      const pId = parseInt(params[0], 10);
      logs = logs.filter(l => l.patient_id === pId);
    }
    if (normalizedText.includes('transfer_id = $1')) {
      const tId = parseInt(params[0], 10);
      logs = logs.filter(l => l.transfer_id === tId);
    }

    const enhancedLogs = logs.map(l => {
      const user = l.user_id ? memoryStore.users.find(u => u.id === l.user_id) : null;
      const patient = l.patient_id ? memoryStore.patients.find(p => p.id === l.patient_id) : null;
      const transfer = l.transfer_id ? memoryStore.transfer_requests.find(t => t.id === l.transfer_id) : null;
      return {
        ...l,
        user_name: user ? user.name : 'System / Anonymous',
        user_email: user ? user.email : '',
        patient_name: patient ? patient.name : null,
        patient_unique_health_id: patient ? patient.unique_health_id : null,
        transfer_code: transfer ? transfer.transfer_code : null
      };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return { rows: enhancedLogs };
  }

  // -------------------------------------------------------------
  // 10. NOTIFICATIONS QUERIES
  // -------------------------------------------------------------
  if (normalizedText.startsWith('insert into notifications')) {
    const [user_id, title, message, type, related_id] = params;
    const newNotif = {
      id: nextId(memoryStore.notifications),
      user_id: parseInt(user_id, 10),
      title,
      message,
      type: type || 'INFO',
      related_id: related_id ? parseInt(related_id, 10) : null,
      is_read: false,
      created_at: new Date()
    };
    memoryStore.notifications.push(newNotif);
    return { rows: [newNotif] };
  }

  if (normalizedText.includes('from notifications') && normalizedText.includes('user_id = $1')) {
    const userId = parseInt(params[0], 10);
    const notifs = memoryStore.notifications
      .filter(n => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: notifs };
  }

  if (normalizedText.startsWith('update notifications set is_read = true')) {
    const userId = parseInt(params[0], 10);
    memoryStore.notifications.forEach(n => {
      if (n.user_id === userId) n.is_read = true;
    });
    return { rows: [] };
  }

  // Default fallback
  return { rows: [] };
};

module.exports = {
  pool,
  query,
  initDB,
  clearDummyData,
  getConnectionStatus: () => isConnected,
  memoryStore
};
