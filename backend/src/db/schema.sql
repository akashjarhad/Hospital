-- Secure Consent-Based Inter-Hospital Patient Data Exchange System
-- Relational Database Schema (PostgreSQL DDL)

-- 1. HOSPITALS (Registered Healthcare Facility Nodes)
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) DEFAULT 'New Delhi',
    phone VARCHAR(50) NOT NULL,
    emergency_contact VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
    public_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (Authentication & Role-Based Access Control)
-- Roles: DOCTOR, HOSPITAL_ADMIN, SYSTEM_ADMIN, PATIENT
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'PATIENT')),
    specialty VARCHAR(100),
    license_number VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;

-- 3. PATIENTS (Master Patient Index / ABHA Health ID)
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    unique_health_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    phone VARCHAR(50),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    medical_history TEXT,
    allergies TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. VISITS / ENCOUNTERS (Hospital Admittance & Encounters)
CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    attending_doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    diagnosis TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'critical', 'observation', 'discharged', 'transferred')),
    admission_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    discharge_date TIMESTAMP WITH TIME ZONE,
    chief_complaint TEXT,
    clinical_notes TEXT,
    vitals JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TESTS & DIAGNOSTIC LAB REPORTS
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Laboratory',
    result TEXT NOT NULL,
    units VARCHAR(50),
    reference_range VARCHAR(100),
    abnormal BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 6. MEDICATIONS
CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    route VARCHAR(50) DEFAULT 'Oral',
    is_current BOOLEAN DEFAULT TRUE,
    prescribed_by INTEGER REFERENCES users(id),
    prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 7. ALLERGIES & ADVERSE REACTIONS
CREATE TABLE IF NOT EXISTS patient_allergies (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    substance VARCHAR(255) NOT NULL,
    reaction_type VARCHAR(100),
    severity VARCHAR(50) DEFAULT 'MODERATE' CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING')),
    diagnosed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. DOCUMENTS & MEDICAL ATTACHMENTS
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    storage_reference TEXT NOT NULL,
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TRANSFER REQUESTS
CREATE TABLE IF NOT EXISTS transfer_requests (
    id SERIAL PRIMARY KEY,
    transfer_code VARCHAR(50) UNIQUE NOT NULL,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    destination_hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    requesting_doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiving_doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    transfer_reason TEXT NOT NULL,
    clinical_priority VARCHAR(50) NOT NULL DEFAULT 'URGENT' CHECK (clinical_priority IN ('ROUTINE', 'URGENT', 'EMERGENCY')),
    requested_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    consent_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (consent_status IN ('PENDING', 'GRANTED', 'REJECTED', 'REVOKED', 'EXPIRED', 'BYPASSED_EMERGENCY')),
    transfer_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (transfer_status IN ('DRAFT', 'PENDING_CONSENT', 'AUTHORIZED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'REJECTED', 'CANCELLED')),
    doctor_transfer_summary TEXT,
    encrypted_package TEXT,
    package_signature VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 10. PATIENT CONSENTS
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transfer_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    requesting_hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    receiving_hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    requesting_doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiving_doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    purpose TEXT NOT NULL,
    data_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GRANTED', 'REJECTED', 'REVOKED', 'EXPIRED')),
    granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    consent_version VARCHAR(20) DEFAULT '1.0',
    patient_signature_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. EMERGENCY ACCESS / BREAK-GLASS LOGS
CREATE TABLE IF NOT EXISTS emergency_access (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    access_scope JSONB DEFAULT '["Allergies", "Current Medications", "Critical Medical History", "Current Diagnosis", "Recent Laboratory Reports"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. IMMUTABLE AUDIT LOGS (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(100) DEFAULT '127.0.0.1',
    user_agent TEXT,
    purpose TEXT DEFAULT 'Clinical Care',
    result VARCHAR(50) NOT NULL DEFAULT 'SUCCESS' CHECK (result IN ('SUCCESS', 'DENIED', 'FAILED')),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO' CHECK (type IN ('CONSENT_REQUEST', 'CONSENT_UPDATE', 'TRANSFER_UPDATE', 'EMERGENCY_ALERT', 'SECURITY_ALERT', 'DOCTOR_REQUEST', 'ASSOCIATION_UPDATE', 'INFO')),
    related_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Widen notifications.type to cover the doctor-patient association workflow.
-- CREATE TABLE IF NOT EXISTS leaves pre-existing tables untouched, so the
-- constraint is rebuilt explicitly for databases created before these types existed.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('CONSENT_REQUEST', 'CONSENT_UPDATE', 'TRANSFER_UPDATE', 'EMERGENCY_ALERT', 'SECURITY_ALERT', 'DOCTOR_REQUEST', 'ASSOCIATION_UPDATE', 'INFO'));

-- 14. AI HANDOVER SUMMARIES (human-reviewed decision support)
CREATE TABLE IF NOT EXISTS ai_handover_summaries (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    original_content JSONB NOT NULL,
    edited_content JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'EDITED', 'APPROVED')),
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    accuracy_confirmed BOOLEAN NOT NULL DEFAULT FALSE
);

-- 15. AI RECORD RELEVANCE SUGGESTIONS (doctor remains selector)
CREATE TABLE IF NOT EXISTS ai_record_relevance (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_id VARCHAR(160) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    reason TEXT NOT NULL,
    suggested_relevant BOOLEAN NOT NULL DEFAULT FALSE,
    selected BOOLEAN,
    review_status VARCHAR(30) NOT NULL DEFAULT 'SUGGESTED' CHECK (review_status IN ('SUGGESTED', 'REVIEWED', 'DISMISSED')),
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 16. DATA QUALITY ISSUES (never mutates source clinical data)
CREATE TABLE IF NOT EXISTS data_quality_issues (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    authorized_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    access_mode VARCHAR(50) NOT NULL,
    check_run_id VARCHAR(100) NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    severity VARCHAR(30) NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MODERATE', 'HIGH')),
    description TEXT NOT NULL,
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    conflict_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (review_status IN ('OPEN', 'REVIEWED', 'VERIFIED', 'IGNORED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. MINIMIZED AI SEARCH HISTORY
ALTER TABLE data_quality_issues ADD COLUMN IF NOT EXISTS transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL;
ALTER TABLE data_quality_issues ADD COLUMN IF NOT EXISTS generated_by INTEGER REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE data_quality_issues ADD COLUMN IF NOT EXISTS authorized_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE data_quality_issues ADD COLUMN IF NOT EXISTS access_mode VARCHAR(50) NOT NULL DEFAULT 'LEGACY_UNKNOWN';

CREATE TABLE IF NOT EXISTS ai_search_logs (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL,
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    query_text TEXT,
    query_hash VARCHAR(64) NOT NULL,
    answer JSONB NOT NULL,
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. SECURITY ANOMALIES (review-only; never auto-blocks users)
CREATE TABLE IF NOT EXISTS security_anomalies (
    id SERIAL PRIMARY KEY,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    analysis_run_id VARCHAR(100) NOT NULL,
    score NUMERIC(10,4) NOT NULL,
    severity VARCHAR(30) NOT NULL CHECK (severity IN ('LOW', 'MODERATE', 'HIGH')),
    explanation TEXT NOT NULL,
    feature_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (review_status IN ('OPEN', 'REVIEWED', 'DISMISSED', 'ESCALATED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. TRANSFER COMPLEXITY DECISION SUPPORT
CREATE TABLE IF NOT EXISTS transfer_complexity_results (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    level VARCHAR(30) NOT NULL CHECK (level IN ('LOW', 'MODERATE', 'HIGH')),
    factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. AI-EXTRACTED CRITICAL INFORMATION (requires clinician confirmation)
CREATE TABLE IF NOT EXISTS ai_critical_information (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_id VARCHAR(160) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    source_date TIMESTAMP WITH TIME ZONE,
    label VARCHAR(160) NOT NULL,
    value TEXT NOT NULL,
    confidence_descriptor VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UNCONFIRMED' CHECK (status IN ('UNCONFIRMED', 'CONFIRMED', 'EDITED', 'DISMISSED')),
    edited_value TEXT,
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    generated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 21. MINIMIZED AI AUDIT EVENTS
CREATE TABLE IF NOT EXISTS ai_audit_events (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    transfer_id INTEGER REFERENCES transfer_requests(id) ON DELETE SET NULL,
    model VARCHAR(100) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    output_hash VARCHAR(64) NOT NULL,
    result VARCHAR(30) NOT NULL CHECK (result IN ('SUCCESS', 'DENIED', 'FAILED')),
    approval_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. RESEARCH EVALUATION (only user-entered measurements)
CREATE TABLE IF NOT EXISTS research_evaluation_runs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_evaluation_entries (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES research_evaluation_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(160) NOT NULL,
    baseline_value NUMERIC,
    actual_value NUMERIC NOT NULL,
    unit VARCHAR(80),
    notes TEXT,
    entered_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. DOCTOR_PATIENTS (Dynamic Treatment Associations)
CREATE TABLE IF NOT EXISTS doctor_patients (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'ACCEPTED', 'INACTIVE', 'REJECTED', 'REVOKED', 'COMPLETED')),
    treatment_reason TEXT,
    department VARCHAR(100) DEFAULT 'General Medicine',
    treatment_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    treatment_end_date TIMESTAMP WITH TIME ZONE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- High Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_patients_health_id ON patients(unique_health_id);
CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_hospital ON visits(hospital_id);
CREATE INDEX IF NOT EXISTS idx_tests_visit ON tests(visit_id);
CREATE INDEX IF NOT EXISTS idx_transfers_patient ON transfer_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_transfers_hospitals ON transfer_requests(source_hospital_id, destination_hospital_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfer_requests(transfer_status);
CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consents_transfer ON consents(transfer_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON consents(status);
CREATE INDEX IF NOT EXISTS idx_emergency_doctor ON emergency_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_emergency_patient ON emergency_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_transfer ON audit_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_ai_handover_transfer ON ai_handover_summaries(transfer_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_relevance_transfer ON ai_record_relevance(transfer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_patient ON data_quality_issues(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_search_patient_actor ON ai_search_logs(patient_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_anomalies_hospital ON security_anomalies(hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_complexity_transfer ON transfer_complexity_results(transfer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_critical_transfer ON ai_critical_information(transfer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_actor_time ON ai_audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_patient_transfer ON ai_audit_events(patient_id, transfer_id);
CREATE INDEX IF NOT EXISTS idx_research_entries_run ON research_evaluation_entries(run_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patients_doc ON doctor_patients(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_doctor_patients_pat ON doctor_patients(patient_id, status);