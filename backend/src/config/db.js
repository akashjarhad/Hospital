const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// PostgreSQL Pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'medtransfer_db',
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false
});

let isConnected = false;

// Safe password hashes
const doctorHash = bcrypt.hashSync('doctor123', 10);
const patientHash = bcrypt.hashSync('patient123', 10);
const adminHash = bcrypt.hashSync('admin123', 10);
const sysAdminHash = bcrypt.hashSync('sysadmin123', 10);

// Comprehensive In-Memory Clinical & Transfer Store
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

  users: [
    {
      id: 1,
      hospital_id: 1,
      name: 'Dr. Ramesh Sharma',
      email: 'dr.ramesh@aiims.edu.in',
      username: 'dr.ramesh',
      password_hash: doctorHash,
      role: 'DOCTOR',
      specialty: 'Emergency Medicine & Trauma',
      license_number: 'MCI-2015-8849',
      phone: '+91-9811001122',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 2,
      hospital_id: 1,
      name: 'Dr. Ananya Iyer',
      email: 'dr.ananya@aiims.edu.in',
      username: 'dr.ananya',
      password_hash: doctorHash,
      role: 'DOCTOR',
      specialty: 'Critical Care & Pulmonology',
      license_number: 'MCI-2018-4521',
      phone: '+91-9811001123',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 3,
      hospital_id: 1,
      name: 'Rajesh Verma (AIIMS Admin)',
      email: 'admin@aiims.edu.in',
      username: 'admin.aiims',
      password_hash: adminHash,
      role: 'HOSPITAL_ADMIN',
      specialty: 'Hospital Operations Lead',
      license_number: 'ADM-DEL-01',
      phone: '+91-9811001124',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 4,
      hospital_id: 2,
      name: 'Dr. Priya Patel',
      email: 'dr.priya@apollo.com',
      username: 'dr.priya',
      password_hash: doctorHash,
      role: 'DOCTOR',
      specialty: 'Interventional Cardiology',
      license_number: 'MCI-2014-9912',
      phone: '+91-9811001125',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 5,
      hospital_id: 2,
      name: 'Sunita Rao (Apollo Admin)',
      email: 'admin@apollo.com',
      username: 'admin.apollo',
      password_hash: adminHash,
      role: 'HOSPITAL_ADMIN',
      specialty: 'Patient Transfer Coordinator',
      license_number: 'ADM-APL-02',
      phone: '+91-9811001126',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 6,
      hospital_id: 3,
      name: 'Dr. Amit Sengupta',
      email: 'dr.amit@fortis.in',
      username: 'dr.amit',
      password_hash: doctorHash,
      role: 'DOCTOR',
      specialty: 'Neurosurgery & Trauma',
      license_number: 'MCI-2012-3341',
      phone: '+91-9811001127',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 7,
      hospital_id: null,
      name: 'System Security Administrator',
      email: 'sysadmin@medtransfer.demo',
      username: 'sysadmin',
      password_hash: sysAdminHash,
      role: 'SYSTEM_ADMIN',
      specialty: 'Cybersecurity & Compliance',
      license_number: 'SYS-SEC-01',
      phone: '+91-9800000001',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 8,
      hospital_id: 1,
      name: 'Rajesh Kumar',
      email: 'patient@demo.local',
      username: 'patient.rajesh',
      password_hash: patientHash,
      role: 'PATIENT',
      patient_id: 1,
      specialty: 'Verified Patient Account',
      license_number: 'PAT-DEL-10001',
      phone: '+91-9876543210',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 9,
      hospital_id: 1,
      name: 'Priya Sharma',
      email: 'patient.anjali@demo.local',
      username: 'patient.anjali',
      password_hash: patientHash,
      role: 'PATIENT',
      patient_id: 2,
      specialty: 'Verified Patient Account',
      license_number: 'PAT-DEL-10002',
      phone: '+91-9811223344',
      is_active: true,
      created_at: new Date('2026-01-01')
    },
    {
      id: 10,
      hospital_id: 1,
      name: 'Synthetic Suspicious Account',
      email: 'sec_test_actor10@aiims.edu.in',
      username: 'sec_actor10',
      password_hash: doctorHash,
      role: 'DOCTOR',
      specialty: 'Radiology Resident',
      license_number: 'SYN-RAD-10',
      phone: '+91-9800000010',
      is_active: false,
      created_at: new Date('2026-01-01')
    }
  ],

  patients: [
    {
      id: 1,
      user_id: 8,
      unique_health_id: 'ABHA-9821-4412-8801',
      name: 'Rajesh Kumar',
      dob: '1985-06-15',
      gender: 'Male',
      blood_group: 'O+',
      phone: '+91-9876543210',
      email: 'patient@demo.local',
      address: 'House 42, Pocket B, Mayur Vihar Phase 1, New Delhi',
      emergency_contact_name: 'Sunita Kumar (Wife)',
      emergency_contact_phone: '+91-9876543211',
      medical_history: 'Hypertension (5 yrs), Type 2 Diabetes Mellitus (3 yrs), Hyperlipidemia',
      allergies: 'Penicillin (Anaphylaxis), Sulfa Drugs (Severe Rash)',
      current_hospital_id: 1,
      created_at: new Date('2026-01-10')
    },
    {
      id: 2,
      user_id: 9,
      unique_health_id: 'ABHA-3312-7789-2244',
      name: 'Priya Sharma',
      dob: '1992-11-20',
      gender: 'Female',
      blood_group: 'B+',
      phone: '+91-9811223344',
      email: 'patient.anjali@demo.local',
      address: 'Flat 302, Green Glen Layout, Bellandur, Bengaluru',
      emergency_contact_name: 'Rohan Sharma (Brother)',
      emergency_contact_phone: '+91-9811223345',
      medical_history: 'Bronchial Asthma (since childhood), Mild Anemia',
      allergies: 'Aspirin (Bronchospasm), NSAIDs',
      current_hospital_id: 1,
      created_at: new Date('2026-02-01')
    },
    {
      id: 3,
      user_id: null,
      unique_health_id: 'ABHA-5521-8833-1109',
      name: 'Amit Verma',
      dob: '1978-03-25',
      gender: 'Male',
      blood_group: 'A+',
      phone: '+91-9822334455',
      email: 'amit.verma@demo.local',
      address: 'Sector 15, Noida, Uttar Pradesh',
      emergency_contact_name: 'Kavita Verma (Spouse)',
      emergency_contact_phone: '+91-9822334456',
      medical_history: 'Chronic Kidney Disease Stage 2',
      allergies: 'Ciprofloxacin',
      current_hospital_id: 1,
      created_at: new Date('2026-02-15')
    },
    {
      id: 4,
      user_id: null,
      unique_health_id: 'ABHA-7744-1199-3322',
      name: 'Meera Deshmukh',
      dob: '1995-08-12',
      gender: 'Female',
      blood_group: 'AB+',
      phone: '+91-9833445566',
      email: 'meera.deshmukh@demo.local',
      address: 'Plot 88, Vasant Kunj, New Delhi',
      emergency_contact_name: 'Suresh Deshmukh (Father)',
      emergency_contact_phone: '+91-9833445567',
      medical_history: 'No prior major chronic disease. Emergency polytrauma following road traffic accident.',
      allergies: 'Latex, Penicillin (Moderate)',
      current_hospital_id: 1,
      created_at: new Date('2026-03-01')
    }
  ],

  visits: [
    {
      id: 1,
      patient_id: 1,
      hospital_id: 1,
      attending_doctor_id: 1,
      attending_doctor_name: 'Dr. Ramesh Sharma',
      admission_date: new Date('2026-09-20T08:30:00Z'),
      discharge_date: null,
      status: 'critical',
      chief_complaint: 'Acute substernal chest pain radiating to left arm and jaw with diaphoresis, nausea, and severe dyspnea for 2 hours',
      diagnosis: 'Acute ST-Elevation Myocardial Infarction (STEMI) - Anterolateral Wall, Killip Class II',
      notes: 'Patient presented in severe acute distress. Emergency ECG confirmed anterolateral STEMI. Placed on high-flow oxygen, dual antiplatelet loading doses, and heparin infusion. Hemodynamically monitored.',
      vitals: {
        heart_rate: 104,
        blood_pressure: '148/92',
        respiratory_rate: 22,
        temperature: '98.6',
        spo2: 94
      },
      created_at: new Date('2026-09-20T08:30:00Z')
    },
    {
      id: 2,
      patient_id: 2,
      hospital_id: 1,
      attending_doctor_id: 2,
      attending_doctor_name: 'Dr. Ananya Iyer',
      admission_date: new Date('2026-09-21T10:00:00Z'),
      discharge_date: null,
      status: 'observation',
      chief_complaint: 'Acute asthma exacerbation with wheezing and mild tachypnea',
      diagnosis: 'Severe Acute Bronchial Asthma Exacerbation',
      notes: 'Nebulized bronchodilators administered. Monitored for respiratory stabilization.',
      vitals: {
        heart_rate: 88,
        blood_pressure: '120/80',
        respiratory_rate: 18,
        temperature: '98.4',
        spo2: 97
      },
      created_at: new Date('2026-09-21T10:00:00Z')
    }
  ],

  tests: [
    {
      id: 1,
      patient_id: 1,
      visit_id: 1,
      test_name: 'Troponin I (High-Sensitivity)',
      test_category: 'Cardiac Biomarkers',
      test_type: 'Lab',
      result: '14.8 ng/mL',
      units: 'ng/mL',
      reference_range: '< 0.04 ng/mL',
      abnormal: true,
      status: 'COMPLETED',
      performed_by: 'Central Pathology Laboratory',
      timestamp: new Date('2026-09-20T09:00:00Z'),
      notes: 'Significantly elevated cardiac troponin indicating acute myocardial necrosis.'
    },
    {
      id: 2,
      patient_id: 1,
      visit_id: 1,
      test_name: 'Creatine Kinase-MB (CK-MB)',
      test_category: 'Cardiac Biomarkers',
      test_type: 'Lab',
      result: '88 U/L',
      units: 'U/L',
      reference_range: '< 25 U/L',
      abnormal: true,
      status: 'COMPLETED',
      performed_by: 'Central Pathology Laboratory',
      timestamp: new Date('2026-09-20T09:15:00Z'),
      notes: 'Elevated CK-MB corroborates acute myocardial injury.'
    },
    {
      id: 3,
      patient_id: 1,
      visit_id: 1,
      test_name: '12-Lead Electrocardiogram (ECG)',
      test_category: 'Diagnostic Cardiology',
      test_type: 'Diagnostic',
      result: 'Marked ST-elevation (4mm) in leads V1-V4 with reciprocal ST-depression in leads III and aVF',
      units: '',
      reference_range: 'Normal sinus rhythm',
      abnormal: true,
      status: 'COMPLETED',
      performed_by: 'Emergency Cardiology Unit',
      timestamp: new Date('2026-09-20T08:45:00Z'),
      notes: 'Diagnostic for acute anterolateral transmural infarction.'
    },
    {
      id: 4,
      patient_id: 1,
      visit_id: 1,
      test_name: 'Serum Creatinine',
      test_category: 'Renal Function',
      test_type: 'Lab',
      result: '1.1 mg/dL',
      units: 'mg/dL',
      reference_range: '0.7 - 1.3 mg/dL',
      abnormal: false,
      status: 'COMPLETED',
      performed_by: 'Biochemistry Department',
      timestamp: new Date('2026-09-20T09:30:00Z'),
      notes: 'Baseline renal function is preserved for contrast-based coronary angiography.'
    },
    {
      id: 5,
      patient_id: 2,
      visit_id: 2,
      test_name: 'Chest X-Ray (PA View)',
      test_category: 'Diagnostic Radiology / Imaging',
      category: 'Diagnostic Radiology / Imaging',
      test_type: 'Diagnostic',
      result: 'Hyperinflation with bilateral peribronchial cuffing, clear lung fields, no pneumothorax',
      units: '',
      reference_range: 'Clear lung fields without focal consolidation',
      abnormal: false,
      status: 'COMPLETED',
      performed_by: 'Radiology Department',
      timestamp: new Date('2026-09-21T10:30:00Z'),
      notes: 'Findings consistent with acute asthma exacerbation.'
    },
    {
      id: 6,
      patient_id: 1,
      visit_id: 1,
      test_name: 'Transthoracic Echocardiogram (2D Echo)',
      test_category: 'Diagnostic Cardiology',
      category: 'Diagnostic Cardiology',
      test_type: 'Diagnostic',
      result: 'Anteroseptal and apical wall akinesis, estimated Left Ventricular Ejection Fraction (LVEF) 38%',
      units: '',
      reference_range: 'LVEF 55-70%',
      abnormal: true,
      status: 'COMPLETED',
      performed_by: 'Echocardiography Lab',
      timestamp: new Date('2026-09-20T10:15:00Z'),
      notes: 'Moderate LV systolic dysfunction secondary to acute ischemic insult.'
    },
    {
      id: 7,
      patient_id: 1,
      visit_id: 1,
      test_name: 'Blood Potassium',
      test_category: 'Electrolytes',
      category: 'Electrolytes',
      test_type: 'Lab',
      result: '4.2 mEq/L',
      units: 'mEq/L',
      reference_range: '3.5 - 5.0 mEq/L',
      abnormal: false,
      status: 'COMPLETED',
      performed_by: 'Biochemistry Department',
      timestamp: new Date('2026-09-20T09:30:00Z'),
      notes: 'Normal electrolyte balance.'
    }
  ],

  medications: [
    {
      id: 1,
      patient_id: 1,
      visit_id: 1,
      medication_name: 'Aspirin (Dispersible)',
      dosage: '325 mg',
      frequency: 'Stat loading dose, then 81 mg once daily',
      route: 'Oral',
      is_current: true,
      prescribed_by: 'Dr. Ramesh Sharma',
      prescribed_at: new Date('2026-09-20T08:35:00Z'),
      notes: 'Antiplatelet therapy'
    },
    {
      id: 2,
      patient_id: 1,
      visit_id: 1,
      medication_name: 'Clopidogrel (Plavix)',
      dosage: '600 mg',
      frequency: 'Stat loading dose, then 75 mg once daily',
      route: 'Oral',
      is_current: true,
      prescribed_by: 'Dr. Ramesh Sharma',
      prescribed_at: new Date('2026-09-20T08:35:00Z'),
      notes: 'P2Y12 inhibitor dual antiplatelet'
    },
    {
      id: 3,
      patient_id: 1,
      visit_id: 1,
      medication_name: 'Atorvastatin',
      dosage: '80 mg',
      frequency: 'Once daily at bedtime',
      route: 'Oral',
      is_current: true,
      prescribed_by: 'Dr. Ramesh Sharma',
      prescribed_at: new Date('2026-09-20T09:00:00Z'),
      notes: 'High-intensity statin therapy'
    },
    {
      id: 4,
      patient_id: 1,
      visit_id: 1,
      medication_name: 'Metoprolol Succinate',
      dosage: '25 mg',
      frequency: 'Once daily',
      route: 'Oral',
      is_current: true,
      prescribed_by: 'Dr. Ramesh Sharma',
      prescribed_at: new Date('2026-09-20T09:30:00Z'),
      notes: 'Beta-blocker for heart rate control'
    },
    {
      id: 5,
      patient_id: 1,
      visit_id: 1,
      medication_name: 'Unfractionated Heparin',
      dosage: '1000 units/hour',
      frequency: 'Continuous IV Infusion',
      route: 'Intravenous',
      is_current: true,
      prescribed_by: 'Dr. Ramesh Sharma',
      prescribed_at: new Date('2026-09-20T08:45:00Z'),
      notes: 'Anticoagulation for acute coronary syndrome'
    }
  ],

  patient_allergies: [
    {
      id: 1,
      patient_id: 1,
      substance: 'Penicillin',
      reaction_type: 'Anaphylaxis & Angioedema',
      severity: 'HIGH',
      diagnosed_at: '2020-04-12'
    },
    {
      id: 2,
      patient_id: 1,
      substance: 'Sulfa Drugs / Sulfonamides',
      reaction_type: 'Maculopapular Rash & Pruritus',
      severity: 'MODERATE',
      diagnosed_at: '2022-08-19'
    }
  ],

  doctor_patients: [
    {
      id: 1,
      doctor_id: 1,
      patient_id: 1,
      hospital_id: 1,
      status: 'ACCEPTED',
      department: 'Emergency & Cardiology',
      treatment_reason: 'Acute ST-Elevation Myocardial Infarction care',
      created_at: new Date('2026-09-20T08:30:00Z'),
      responded_at: new Date('2026-09-20T08:30:00Z')
    },
    {
      id: 2,
      doctor_id: 2,
      patient_id: 2,
      hospital_id: 1,
      status: 'ACCEPTED',
      department: 'Pulmonology & Critical Care',
      treatment_reason: 'Asthma flare-up and bronchial management',
      created_at: new Date('2026-09-21T10:00:00Z'),
      responded_at: new Date('2026-09-21T10:00:00Z')
    }
  ],

  documents: [],

  transfers: [],
  transfer_requests: [
    {
      id: 3,
      transfer_code: 'TR-2026-0003',
      patient_id: 1,
      source_hospital_id: 1,
      destination_hospital_id: 3,
      requesting_doctor_id: 1,
      receiving_doctor_id: 6,
      visit_id: 1,
      transfer_reason: 'Elective Neurosurgical Consultation',
      clinical_priority: 'ROUTINE',
      requested_data: ['Patient Demographics', 'Medical History'],
      consent_status: 'REJECTED',
      transfer_status: 'REJECTED',
      doctor_transfer_summary: 'Elective consult declined by patient',
      encrypted_package: null,
      package_signature: null,
      created_at: new Date('2026-09-21T00:00:00Z'),
      updated_at: new Date('2026-09-21T00:00:00Z'),
      expires_at: new Date('2026-09-28T00:00:00Z')
    },
    {
      id: 4,
      transfer_code: 'TR-2026-0004',
      patient_id: 2,
      source_hospital_id: 1,
      destination_hospital_id: 2,
      requesting_doctor_id: 2,
      receiving_doctor_id: 4,
      visit_id: 2,
      transfer_reason: 'Specialist Pulmonary Rehabilitation',
      clinical_priority: 'ROUTINE',
      requested_data: ['Patient Demographics', 'Allergies'],
      consent_status: 'REVOKED',
      transfer_status: 'CANCELLED',
      doctor_transfer_summary: 'Prior transfer cancelled upon consent revocation',
      encrypted_package: null,
      package_signature: null,
      created_at: new Date('2026-09-22T00:00:00Z'),
      updated_at: new Date('2026-09-22T00:00:00Z'),
      expires_at: new Date('2026-09-29T00:00:00Z')
    },
    {
      id: 5,
      transfer_code: 'TR-2026-0005',
      patient_id: 1,
      source_hospital_id: 1,
      destination_hospital_id: 2,
      requesting_doctor_id: 1,
      receiving_doctor_id: 4,
      visit_id: 1,
      transfer_reason: 'Prior Archival Transfer',
      clinical_priority: 'ROUTINE',
      requested_data: ['Patient Demographics', 'Current Diagnosis'],
      consent_status: 'EXPIRED',
      transfer_status: 'CANCELLED',
      doctor_transfer_summary: 'Expired consent archive',
      encrypted_package: null,
      package_signature: null,
      created_at: new Date('2020-01-01T00:00:00Z'),
      updated_at: new Date('2020-01-01T00:00:00Z'),
      expires_at: new Date('2020-01-08T00:00:00Z')
    }
  ],

  consents: [
    {
      id: 3,
      patient_id: 1,
      transfer_id: 3,
      requesting_hospital_id: 1,
      receiving_hospital_id: 3,
      requesting_doctor_id: 1,
      receiving_doctor_id: 6,
      purpose: 'Inter-Hospital Transfer: Elective Neurosurgical Consultation',
      data_categories: ['Patient Demographics', 'Medical History'],
      status: 'REJECTED',
      granted_at: null,
      expires_at: new Date('2026-09-28T00:00:00Z'),
      revoked_at: null,
      consent_version: '1.0',
      patient_signature_note: 'Patient declined sharing with Fortis Hospital',
      created_at: new Date('2026-09-21T00:00:00Z')
    },
    {
      id: 4,
      patient_id: 2,
      transfer_id: 4,
      requesting_hospital_id: 1,
      receiving_hospital_id: 2,
      requesting_doctor_id: 2,
      receiving_doctor_id: 4,
      purpose: 'Inter-Hospital Transfer: Specialist Pulmonary Rehabilitation',
      data_categories: ['Patient Demographics', 'Allergies'],
      status: 'REVOKED',
      granted_at: new Date('2026-09-22T08:00:00Z'),
      expires_at: new Date('2026-09-29T00:00:00Z'),
      revoked_at: new Date('2026-09-22T12:00:00Z'),
      consent_version: '1.0',
      patient_signature_note: 'Consent revoked by patient prior to transfer execution',
      created_at: new Date('2026-09-22T00:00:00Z')
    },
    {
      id: 5,
      patient_id: 1,
      transfer_id: 5,
      requesting_hospital_id: 1,
      receiving_hospital_id: 2,
      requesting_doctor_id: 1,
      receiving_doctor_id: 4,
      purpose: 'Inter-Hospital Transfer: Prior Archival Transfer',
      data_categories: ['Patient Demographics', 'Current Diagnosis'],
      status: 'GRANTED',
      granted_at: new Date('2020-01-01T08:00:00Z'),
      expires_at: new Date('2020-01-08T00:00:00Z'),
      revoked_at: null,
      consent_version: '1.0',
      patient_signature_note: 'Historical granted consent now expired',
      created_at: new Date('2020-01-01T00:00:00Z')
    }
  ],
  emergency_access: [],
  audit_logs: [
    // Doctor 1 (Dr. Ramesh Sharma) - Normal daytime clinical activities
    { id: 1, user_id: 1, role: 'DOCTOR', action: 'LOGIN', patient_id: null, transfer_id: null, timestamp: new Date('2026-09-20T08:30:00Z'), ip_address: '10.0.1.15', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Clinical Duty Shift Login', result: 'SUCCESS', metadata: { hospital_node: 'AIIMS-DEL' } },
    { id: 2, user_id: 1, role: 'DOCTOR', action: 'PATIENT_VIEW', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-20T08:35:00Z'), ip_address: '10.0.1.15', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Routine Inpatient Rounding', result: 'SUCCESS', metadata: { section: 'Dossier' } },
    { id: 3, user_id: 1, role: 'DOCTOR', action: 'DATA_ACCESSED', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-20T08:40:00Z'), ip_address: '10.0.1.15', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Review Diagnostic ECG', result: 'SUCCESS', metadata: { category: 'Diagnostic Reports' } },
    { id: 4, user_id: 1, role: 'DOCTOR', action: 'TRANSFER_CREATED', patient_id: 1, transfer_id: 1, timestamp: new Date('2026-09-20T09:00:00Z'), ip_address: '10.0.1.15', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Transfer Referral', result: 'SUCCESS', metadata: { priority: 'URGENT' } },
    { id: 5, user_id: 1, role: 'DOCTOR', action: 'CONSENT_REQUESTED', patient_id: 1, transfer_id: 1, timestamp: new Date('2026-09-20T09:01:00Z'), ip_address: '10.0.1.15', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Patient Transfer Consent', result: 'SUCCESS', metadata: { transfer_code: 'TR-2026-0001' } },

    // Doctor 2 (Dr. Ananya Iyer) - Normal daytime clinical activities
    { id: 6, user_id: 2, role: 'DOCTOR', action: 'LOGIN', patient_id: null, transfer_id: null, timestamp: new Date('2026-09-21T09:30:00Z'), ip_address: '10.0.1.22', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Outpatient Clinic Shift', result: 'SUCCESS', metadata: { hospital_node: 'AIIMS-DEL' } },
    { id: 7, user_id: 2, role: 'DOCTOR', action: 'PATIENT_VIEW', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-21T10:00:00Z'), ip_address: '10.0.1.22', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Asthma Evaluation', result: 'SUCCESS', metadata: { section: 'Dossier' } },
    { id: 8, user_id: 2, role: 'DOCTOR', action: 'DATA_ACCESSED', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-21T10:15:00Z'), ip_address: '10.0.1.22', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Pulmonary Record Review', result: 'SUCCESS', metadata: { category: 'Medical History' } },

    // Doctor 4 (Dr. Priya Patel) - Normal daytime receiving activities
    { id: 9, user_id: 4, role: 'DOCTOR', action: 'LOGIN', patient_id: null, transfer_id: null, timestamp: new Date('2026-09-20T10:30:00Z'), ip_address: '10.0.2.50', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Cath Lab Readiness', result: 'SUCCESS', metadata: { hospital_node: 'APOLLO-DEL' } },
    { id: 10, user_id: 4, role: 'DOCTOR', action: 'TRANSFER_RECEIVED', patient_id: 1, transfer_id: 1, timestamp: new Date('2026-09-20T11:00:00Z'), ip_address: '10.0.2.50', user_agent: 'MedTransfer Doctor Portal/1.0', purpose: 'Emergency Intake', result: 'SUCCESS', metadata: { transfer_code: 'TR-2026-0001' } },

    // Actor 10 (Synthetic Suspicious Scraping / Rogue Account) - Off-Hours, Rapid Frequency, Bulk Downloads & Denials
    { id: 11, user_id: 10, role: 'DOCTOR', action: 'LOGIN', patient_id: null, transfer_id: null, timestamp: new Date('2026-09-22T02:15:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Automated Script Session', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 12, user_id: 10, role: 'DOCTOR', action: 'PATIENT_VIEW', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-22T02:16:10Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 13, user_id: 10, role: 'DOCTOR', action: 'DATA_ACCESSED', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-22T02:16:30Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 14, user_id: 10, role: 'DOCTOR', action: 'DATA_DOWNLOADED', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-22T02:17:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Export', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 15, user_id: 10, role: 'DOCTOR', action: 'PATIENT_VIEW', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-22T02:18:15Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 16, user_id: 10, role: 'DOCTOR', action: 'DATA_ACCESSED', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-22T02:18:30Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 17, user_id: 10, role: 'DOCTOR', action: 'DATA_DOWNLOADED', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-22T02:19:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Export', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 18, user_id: 10, role: 'DOCTOR', action: 'PATIENT_VIEW', patient_id: 3, transfer_id: null, timestamp: new Date('2026-09-22T02:20:10Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 19, user_id: 10, role: 'DOCTOR', action: 'DATA_ACCESSED', patient_id: 3, transfer_id: null, timestamp: new Date('2026-09-22T02:20:25Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Scan', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 20, user_id: 10, role: 'DOCTOR', action: 'DATA_DOWNLOADED', patient_id: 3, transfer_id: null, timestamp: new Date('2026-09-22T02:21:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Export', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 21, user_id: 10, role: 'DOCTOR', action: 'DATA_DOWNLOADED', patient_id: 4, transfer_id: null, timestamp: new Date('2026-09-22T02:22:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Bulk Export', result: 'SUCCESS', metadata: { anomaly_marker: true } },
    { id: 22, user_id: 10, role: 'DOCTOR', action: 'UNAUTHORIZED_ACCESS_ATTEMPT', patient_id: 4, transfer_id: null, timestamp: new Date('2026-09-22T02:23:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Unauthorized Probing', result: 'DENIED', metadata: { reason: 'No association or consent' } },
    { id: 23, user_id: 10, role: 'DOCTOR', action: 'UNAUTHORIZED_ACCESS_ATTEMPT', patient_id: 1, transfer_id: null, timestamp: new Date('2026-09-22T02:24:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Unauthorized Probing', result: 'DENIED', metadata: { reason: 'No association or consent' } },
    { id: 24, user_id: 10, role: 'DOCTOR', action: 'UNAUTHORIZED_ACCESS_ATTEMPT', patient_id: 2, transfer_id: null, timestamp: new Date('2026-09-22T02:25:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Unauthorized Probing', result: 'DENIED', metadata: { reason: 'No association or consent' } },
    { id: 25, user_id: 10, role: 'DOCTOR', action: 'UNAUTHORIZED_ACCESS_ATTEMPT', patient_id: 3, transfer_id: null, timestamp: new Date('2026-09-22T02:26:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Unauthorized Probing', result: 'DENIED', metadata: { reason: 'No association or consent' } },
    { id: 26, user_id: 10, role: 'DOCTOR', action: 'UNAUTHORIZED_ACCESS_ATTEMPT', patient_id: 4, transfer_id: null, timestamp: new Date('2026-09-22T02:27:00Z'), ip_address: '198.51.100.44', user_agent: 'Python-requests/2.31.0', purpose: 'Unauthorized Probing', result: 'DENIED', metadata: { reason: 'No association or consent' } }
  ],
  notifications: [],

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
 * Clear all synthetic/dummy patient and transfer records
 * Retains hospital nodes and clinician/admin user accounts for login.
 */
const clearDummyData = () => {
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
  // Retain only staff users (remove dummy patient user accounts)
  memoryStore.users = memoryStore.users.filter(u => u.role !== 'PATIENT');
  console.log('\x1b[35m%s\x1b[0m', '🧹 Clean Data Mode Active: All dummy/synthetic patient & transfer records purged.');
};

if (process.env.CLEAR_DUMMY_DATA === 'true' || process.env.DATA_MODE === 'clean') {
  clearDummyData();
}

// Initialize DB and verify connection
const initDB = async () => {
  try {
    const client = await pool.connect();
    isConnected = true;
    console.log('\x1b[32m%s\x1b[0m', '✓ Connected successfully to PostgreSQL database.');

    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('\x1b[32m%s\x1b[0m', '✓ Relational schema verified in PostgreSQL.');
    }
    client.release();
    return true;
  } catch (err) {
    isConnected = false;
    console.warn('\x1b[33m%s\x1b[0m', `ℹ️ Local PostgreSQL status: ${err.message || 'Offline/Unreachable'}`);
    if (process.env.CLEAR_DUMMY_DATA === 'true' || process.env.DATA_MODE === 'clean') {
      console.warn('\x1b[36m%s\x1b[0m', '✓ MedTransfer Hybrid Engine: Clean InMemory clinical store active (0 dummy records).');
    } else {
      console.warn('\x1b[36m%s\x1b[0m', '✓ MedTransfer Hybrid Engine initialized: InMemory clinical dataset active.');
    }
    return false;
  }
};

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
  if (normalizedText.includes('from users u') && (normalizedText.includes('where lower(u.email)') || normalizedText.includes('lower(u.username)') || normalizedText.includes('u.email =') || normalizedText.includes('u.username ='))) {
    const identParam = String(params[0] || '').toLowerCase().trim();
    const user = memoryStore.users.find(u => 
      (u.email && u.email.toLowerCase() === identParam) || 
      (u.username && u.username.toLowerCase() === identParam)
    );
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

  if (normalizedText.includes('from patients') && (normalizedText.includes('where id = $1') || normalizedText.includes('where unique_health_id = $1') || normalizedText.includes('where p.id = $1'))) {
    const param = params[0];
    const patient = memoryStore.patients.find(p => p.id === parseInt(param, 10) || p.unique_health_id === String(param).trim());
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
    // doctor_id, patient_id, hospital_id, status, department, treatment_reason, purpose, treatment_start_date, requested_at
    const [doctor_id, patient_id, hospital_id, status, department, treatment_reason, purpose, treatment_start_date, requested_at] = params;
    const newAssoc = {
      id: nextId(memoryStore.doctor_patients),
      doctor_id: parseInt(doctor_id, 10),
      patient_id: parseInt(patient_id, 10),
      hospital_id: hospital_id ? parseInt(hospital_id, 10) : 1,
      status: (status || 'PENDING').toUpperCase(),
      department: department || 'General Medicine',
      treatment_reason: treatment_reason || purpose || 'Clinical Evaluation & Treatment',
      purpose: purpose || treatment_reason || 'Clinical Care',
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
