const bcrypt = require('bcryptjs');
const { pool, initDB } = require('../config/db');

async function seed() {
  console.log('🌱 Starting MedTransfer Database Seeding...');
  
  const connected = await initDB();
  if (!connected) {
    console.error('❌ Could not connect to PostgreSQL. Please start PostgreSQL and create medtransfer_db first.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Hospitals
    console.log('🏥 Seeding Hospitals...');
    const hospitalRes = await client.query(`
      INSERT INTO hospitals (name, code, address, city, phone, emergency_contact)
      VALUES 
        ('AIIMS Trauma Center', 'AIIMS-DEL', 'Sri Aurobindo Marg, Ansari Nagar', 'New Delhi', '+91-11-26588500', '+91-9876543210'),
        ('Apollo Multi-Speciality Hospital', 'APOLLO-DEL', 'Sarita Vihar, Delhi Mathura Road', 'New Delhi', '+91-11-26925858', '+91-9876543211'),
        ('Fortis Memorial Research Institute', 'FORTIS-GGN', 'Sector 44, Opposite HUDA City Centre', 'Gurugram', '+91-124-4962200', '+91-9876543212'),
        ('Max Super Speciality Hospital', 'MAX-SAKET', '1, 2 Press Enclave Road, Saket', 'New Delhi', '+91-11-26515050', '+91-9876543213')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code;
    `);

    const hospitals = hospitalRes.rows;
    const aiimsId = hospitals.find(h => h.code === 'AIIMS-DEL')?.id || 1;
    const apolloId = hospitals.find(h => h.code === 'APOLLO-DEL')?.id || 2;
    const fortisId = hospitals.find(h => h.code === 'FORTIS-GGN')?.id || 3;

    // 2. Seed Users (Doctors, Admins, Patients)
    console.log('👨‍⚕️ Seeding Users (Doctors, Admins, Patients)...');
    const doctorPass = await bcrypt.hash('doctor123', 10);
    const adminPass = await bcrypt.hash('admin123', 10);
    const patientPass = await bcrypt.hash('patient123', 10);

    const userRes = await client.query(`
      INSERT INTO users (hospital_id, name, email, password_hash, role, specialty, license_number)
      VALUES 
        -- AIIMS Hospital Staff
        ($1, 'Dr. Ramesh Sharma', 'dr.ramesh@aiims.edu.in', $4, 'DOCTOR', 'Emergency Medicine & Trauma', 'MCI-2015-8849'),
        ($1, 'Dr. Ananya Iyer', 'dr.ananya@aiims.edu.in', $4, 'DOCTOR', 'Critical Care & Pulmonology', 'MCI-2018-4521'),
        ($1, 'Rajesh Verma', 'admin@aiims.edu.in', $5, 'HOSPITAL_ADMIN', 'Hospital Operations Lead', 'ADM-DEL-01'),

        -- Apollo Hospital Staff
        ($2, 'Dr. Priya Patel', 'dr.priya@apollo.com', $4, 'DOCTOR', 'Interventional Cardiology', 'MCI-2014-9912'),
        ($2, 'Sunita Rao', 'admin@apollo.com', $5, 'HOSPITAL_ADMIN', 'Patient Transfer Coordinator', 'ADM-APL-02'),

        -- Fortis Hospital Staff
        ($3, 'Dr. Amit Sengupta', 'dr.amit@fortis.in', $4, 'DOCTOR', 'Neurosurgery & Trauma', 'MCI-2012-3341'),

        -- System Admin
        (NULL, 'System Administrator', 'sysadmin@medtransfer.gov.in', $5, 'SYSTEM_ADMIN', 'National Exchange Security', 'SYS-ADMIN-01'),

        -- Demo Patients
        (NULL, 'Rajesh Kumar', 'patient@demo.local', $6, 'PATIENT', NULL, NULL),
        (NULL, 'Priya Sharma', 'patient.anjali@demo.local', $6, 'PATIENT', NULL, NULL)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, email, role;
    `, [aiimsId, apolloId, fortisId, doctorPass, adminPass, patientPass]);

    const users = userRes.rows;
    const patientUser1 = users.find(u => u.email === 'patient@demo.local');
    const patientUser2 = users.find(u => u.email === 'patient.anjali@demo.local');
    const drRamesh = users.find(u => u.email === 'dr.ramesh@aiims.edu.in');
    const drAnanya = users.find(u => u.email === 'dr.ananya@aiims.edu.in');

    // 3. Seed Patients Master Index
    console.log('🧑‍🤝‍🧑 Seeding Patients...');
    const patientRes = await client.query(`
      INSERT INTO patients (user_id, unique_health_id, name, dob, gender, blood_group, phone, emergency_contact_name, emergency_contact_phone, medical_history, allergies)
      VALUES 
        ($1, 'ABHA-9821-4412-8801', 'Rajesh Kumar', '1972-04-15', 'Male', 'B+', '+91-9876501234', 'Sunita Kumar (Wife)', '+91-9876501235', 'Type-2 Diabetes Mellitus (diagnosed 2018, on Metformin), Essential Hypertension (diagnosed 2020), Mild Dyslipidemia', 'Penicillin (Anaphylaxis), Sulfa Drugs (Rash)'),
        ($2, 'ABHA-3312-7788-9902', 'Priya Sharma', '1985-08-22', 'Female', 'O+', '+91-9876502345', 'Anand Sharma (Brother)', '+91-9876502346', 'Bronchial Asthma (childhood onset), Seasonal allergic rhinitis', 'Aspirin (Bronchospasm), NSAIDs (Gastric upset)'),
        (NULL, 'ABHA-4455-6677-1123', 'Vikram Malhotra', '1965-11-03', 'Male', 'A+', '+91-9876503456', 'Kavita Malhotra (Daughter)', '+91-9876503457', 'Chronic Obstructive Pulmonary Disease (COPD Gold Stage II), Cor Pulmonale', 'Codeine (Nausea), Iodine Contrast (Mild urticaria)'),
        (NULL, 'ABHA-1122-3344-5566', 'Ananya Sen', '1998-02-14', 'Female', 'AB-', '+91-9876504567', 'Debashis Sen (Father)', '+91-9876504568', 'Migraine with aura, Polycystic Ovarian Syndrome (PCOS)', 'No known drug allergies (NKDA)')
      ON CONFLICT (unique_health_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, unique_health_id;
    `, [patientUser1?.id || null, patientUser2?.id || null]);

    const patients = patientRes.rows;
    const p1Id = patients[0]?.id || 1;
    const p2Id = patients[1]?.id || 2;

    // 4. Seed Doctor-Patient Associations
    console.log('🩺 Seeding Doctor-Patient Associations...');
    await client.query(`
      INSERT INTO doctor_patients (doctor_id, patient_id, hospital_id, status, department, treatment_reason)
      VALUES 
        ($1, $2, $4, 'ACCEPTED', 'Emergency & Cardiology', 'Acute ST-Elevation Myocardial Infarction care'),
        ($3, $5, $4, 'ACCEPTED', 'Pulmonology & Critical Care', 'Asthma flare-up and bronchial management')
      ON CONFLICT DO NOTHING;
    `, [drRamesh?.id || 1, p1Id, drAnanya?.id || 2, aiimsId, p2Id]);

    // 5. Seed Encounters / Visits
    console.log('🏥 Seeding Clinical Visits...');
    const visitRes = await client.query(`
      INSERT INTO visits (patient_id, hospital_id, attending_doctor_id, diagnosis, status, admission_date, chief_complaint, clinical_notes, vitals)
      VALUES 
        ($1, $3, $4, 'Acute ST-Elevation Myocardial Infarction (STEMI) - Anterolateral Wall, Killip Class II', 'critical', '2026-09-20 08:30:00+00', 'Acute substernal chest pain radiating to left arm and jaw with diaphoresis, nausea, and severe dyspnea for 2 hours', 'Emergency ECG confirmed anterolateral STEMI. Placed on high-flow oxygen, dual antiplatelet loading doses, and heparin infusion.', '{"heart_rate": 104, "blood_pressure": "148/92", "respiratory_rate": 22, "temperature": "98.6", "spo2": 94}'::jsonb),
        ($2, $3, $5, 'Severe Acute Bronchial Asthma Exacerbation', 'observation', '2026-09-21 10:00:00+00', 'Acute asthma exacerbation with wheezing and mild tachypnea', 'Nebulized bronchodilators administered. Monitored for respiratory stabilization.', '{"heart_rate": 88, "blood_pressure": "120/80", "respiratory_rate": 18, "temperature": "98.4", "spo2": 97}'::jsonb)
      RETURNING id, patient_id;
    `, [p1Id, p2Id, aiimsId, drRamesh?.id || 1, drAnanya?.id || 2]);

    const v1Id = visitRes.rows[0]?.id || 1;
    const v2Id = visitRes.rows[1]?.id || 2;

    // 6. Seed Diagnostic Tests
    console.log('🔬 Seeding Tests & Labs...');
    await client.query(`
      INSERT INTO tests (visit_id, test_name, category, result, units, reference_range, abnormal, notes)
      VALUES 
        ($1, 'Troponin I (High-Sensitivity)', 'Cardiac Biomarkers', '14.8 ng/mL', 'ng/mL', '< 0.04 ng/mL', TRUE, 'Significantly elevated cardiac troponin indicating acute myocardial necrosis.'),
        ($1, 'Creatine Kinase-MB (CK-MB)', 'Cardiac Biomarkers', '88 U/L', 'U/L', '< 25 U/L', TRUE, 'Elevated CK-MB corroborates acute myocardial injury.'),
        ($1, '12-Lead Electrocardiogram (ECG)', 'Diagnostic Cardiology', 'Marked ST-elevation (4mm) in leads V1-V4', '', 'Normal sinus rhythm', TRUE, 'Diagnostic for acute anterolateral transmural infarction.'),
        ($1, 'Serum Creatinine', 'Renal Function', '1.1 mg/dL', 'mg/dL', '0.7 - 1.3 mg/dL', FALSE, 'Preserved renal function for catheterization.'),
        ($2, 'Chest X-Ray (PA View)', 'Diagnostic Radiology / Imaging', 'Hyperinflation with bilateral peribronchial cuffing, clear lung fields, no pneumothorax', '', 'Clear lung fields', FALSE, 'Findings consistent with acute asthma exacerbation.'),
        ($1, 'Transthoracic Echocardiogram (2D Echo)', 'Diagnostic Cardiology', 'Anteroseptal and apical wall akinesis, LVEF 38%', '', 'LVEF 55-70%', TRUE, 'Moderate LV systolic dysfunction secondary to acute ischemic insult.'),
        ($1, 'Blood Potassium', 'Electrolytes', '4.2 mEq/L', 'mEq/L', '3.5 - 5.0 mEq/L', FALSE, 'Normal electrolyte balance.')
    `, [v1Id, v2Id]);

    // 7. Seed Medications
    console.log('💊 Seeding Medications...');
    await client.query(`
      INSERT INTO medications (patient_id, visit_id, medication_name, dosage, frequency, route, is_current, notes)
      VALUES 
        ($1, $2, 'Aspirin (Dispirin)', '325 mg', 'Stat chewable loading dose', 'Oral', TRUE, 'Antiplatelet therapy'),
        ($1, $2, 'Clopidogrel (Plavix)', '600 mg', 'Stat loading dose, then 75 mg daily', 'Oral', TRUE, 'P2Y12 inhibitor dual antiplatelet'),
        ($1, $2, 'Atorvastatin', '80 mg', 'Once daily at bedtime', 'Oral', TRUE, 'High-intensity statin therapy'),
        ($1, $2, 'Metoprolol Succinate', '25 mg', 'Once daily', 'Oral', TRUE, 'Beta-blocker for heart rate control'),
        ($1, $2, 'Unfractionated Heparin', '1000 units/hour', 'Continuous IV Infusion', 'Intravenous', TRUE, 'Anticoagulation for acute coronary syndrome')
    `, [p1Id, v1Id]);

    // 8. Seed Allergies
    console.log('⚠️ Seeding Allergies...');
    await client.query(`
      INSERT INTO patient_allergies (patient_id, substance, reaction_type, severity)
      VALUES 
        ($1, 'Penicillin', 'Anaphylaxis & Angioedema', 'HIGH'),
        ($1, 'Sulfa Drugs / Sulfonamides', 'Maculopapular Rash & Pruritus', 'MODERATE')
    `, [p1Id]);

    await client.query('COMMIT');
    console.log('\x1b[32m%s\x1b[0m', '✅ Database seeded successfully with full multi-hospital clinical dataset!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during seeding:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
