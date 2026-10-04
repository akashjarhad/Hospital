# Patient-Doctor Dynamic Association & Self-Registration Architecture

## 1. Executive Summary & Existing Architecture Inspection

This architectural specification documents the transformation of the **MedTransfer** system from using static demo users to a dynamic, self-registration and relationship-driven healthcare platform where:
1. **Patients** and **Doctors** self-register their own secure accounts.
2. **Doctors** belong to specific hospital facility nodes and actively manage their own treatment rosters.
3. **Doctors** search and send treatment association requests to registered patients.
4. **Patients** review, accept, reject, or revoke doctor associations.
5. **Doctor Dashboards** strictly isolate and display only the patients actively associated with that doctor.
6. **Existing Features** (AES-256-GCM encrypted transfers, consent-governed data minimization, AI clinical handovers, RAG assistants, ML security anomalies, transfer complexity models, and immutable audit logs) remain fully functional and strictly enforced under the new doctor-patient relationship guard.

---

## 2. Existing Architecture & Components

* **Frontend Framework**: React 18 SPA with Vite, TailwindCSS, Lucide React icons, and Axios with JWT interceptors.
* **Backend Framework**: Node.js / Express.js REST API with hybrid PostgreSQL relational engine and fallback `memoryStore`.
* **Python AI/ML Layer**: Pluggable AI Service (`mock` + `external`), `IsolationForest` ML anomaly detector, `RandomForestClassifier` transfer complexity predictor, vector chunking RAG assistant, and HL7 FHIR R4 mapper.
* **Security & RBAC**: Least-privilege 4-tier RBAC (`PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`, `SYSTEM_ADMIN`).
* **Existing Files**:
  * `backend/src/server.js`: API bootstrap and routing
  * `backend/src/controllers/authController.js`: Authentication and registration
  * `backend/src/controllers/patientController.js`: Patient records and roster
  * `backend/src/controllers/transferController.js`: Inter-hospital transfer creation and dispatch
  * `backend/src/controllers/consentController.js`: Granular consent management
  * `backend/src/controllers/aiController.js`: AI handover, relevance, RAG search, data quality
  * `backend/src/services/clinicalAccessPolicy.js`: Authorization and consent guard
  * `backend/src/db/schema.sql` & `backend/src/config/db.js`: Database DDL & in-memory store
  * `frontend/src/components/Login.jsx`: Login UI with role switcher
  * `frontend/src/components/DashboardOverview.jsx`: Master dashboard routing
  * `frontend/src/components/ConsentCenter.jsx`: Patient consent interface
  * `frontend/src/components/AITransferWorkspace.jsx`: AI clinical decision support workspace

---

## 3. Database Schema Extensions

### 1. `doctor_patients` (Dynamic Treatment Relationships)
```sql
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

CREATE INDEX IF NOT EXISTS idx_doctor_patients_doc ON doctor_patients(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_doctor_patients_pat ON doctor_patients(patient_id, status);
```

### 2. User & Patient Enhancements
* `users`: support `username`, `status` (`APPROVED`, `PENDING`, `REJECTED`, `SUSPENDED`), `years_experience`, `qualification`.
* `patients`: auto-generate unique ABHA ID format `ABHA-XXXX-XXXX-XXXX` and associate `user_id`.

---

## 4. API Endpoints

### Authentication & Registration (`/api/auth`)
* `POST /api/auth/register/patient`: Patient self-registration with health ID generation.
* `POST /api/auth/register/doctor`: Doctor self-registration affiliated with a chosen hospital.
* `POST /api/auth/login`: Authenticate via email OR username, returns JWT with role and affiliations.

### Doctor-Patient Associations & Search (`/api/patients`)
* `GET /api/patients/doctor/my-patients`: Retrieve only patients associated with authenticated doctor.
* `GET /api/patients/doctor/search?q=...`: Privacy-preserving patient lookup by ABHA, name, phone, email.
* `POST /api/patients/doctor/associations`: Send doctor-to-patient treatment request.
* `GET /api/patients/my-doctors`: Patient views their treating doctors and hospitals.
* `GET /api/patients/my-association-requests`: Patient views incoming doctor association requests.
* `POST /api/patients/associations/:id/respond`: Patient accepts (`ACTIVE`) or rejects (`REJECTED`) request.
* `POST /api/patients/associations/:id/revoke`: Patient revokes doctor's treatment association.
* `POST /api/patients/:id/medical-records`: Authorized doctor adds clinical encounter/tests/medications.

---

## 5. Security & Access Control Pipeline

```
HTTP Request
     │
     ▼
JWT Authentication (Token valid & unexpired)
     │
     ▼
Role Verification (DOCTOR / PATIENT)
     │
     ▼
Doctor-Patient Relationship Check (Active row in doctor_patients OR Active Transfer OR Break-Glass)
     │
     ▼
Consent Scope & Data Minimization (Consented clinical fields only)
     │
     ▼
Authorized Clinical Execution / AI Inference
     │
     ▼
Append-Only Tamper-Evident Audit Event
```

---

## 6. Implementation Plan & Modified Files

1. **Database & In-Memory Store**: Update `backend/src/db/schema.sql` and `backend/src/config/db.js` with `doctor_patients` table, SQL query simulator handlers, and pre-seeded active associations for demo accounts.
2. **Backend Controllers & Routes**:
   * Update `backend/src/controllers/authController.js` & `backend/src/routes/authRoutes.js` (Patient/Doctor registration & username login).
   * Update `backend/src/controllers/patientController.js` & `backend/src/routes/patientRoutes.js` (My patients roster, privacy-preserving search, association request/respond/revoke, add medical record).
   * Update `backend/src/controllers/transferController.js` (Verify doctor-patient active relationship before transfer creation).
   * Update `backend/src/services/clinicalAccessPolicy.js` (Enforce doctor-patient relationship in `authorizePatientAccess`).
3. **Frontend UI Components**:
   * Add Patient Registration Modal/View (`/register/patient`).
   * Add Doctor Registration Modal/View (`/register/doctor`).
   * Redesign Doctor Dashboard: Stats, My Patients table, Search & `+ Add Patient` modal, Pending requests tab.
   * Redesign Patient Dashboard: My Doctors card, Pending association requests with `Accept`/`Reject`, Revoke action, Data access history.
4. **Testing & Validation**:
   * Create `backend/tests/test_patient_doctor_association.js` testing self-registration, search, request, accept, reject, revoke, roster isolation, and transfer creation protection.
   * Verify all existing Node and Python test suites pass without regression.
