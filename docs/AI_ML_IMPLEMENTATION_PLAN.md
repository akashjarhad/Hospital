# AI/ML & Secure Inter-Hospital Transfer Implementation Plan

## 1. Executive Summary & Existing Architecture Overview

This implementation plan details the architecture and step-by-step strategy for integrating advanced AI/ML research features into the existing **MedTransfer** (Secure Consent-Based Inter-Hospital Patient Data Exchange System) platform without rewriting or disrupting working core capabilities.

### Existing Architecture Summary

- **Frontend Framework**: React 18 SPA built with Vite, TailwindCSS, Lucide React icons, Axios for authenticated REST API communication, React Context API (`AuthContext`) for auth session state, and dedicated responsive clinical/administrative views.
- **Backend Framework**: Node.js & Express.js REST API with modular routing, JWT authentication (`jsonwebtoken`), password hashing (`bcryptjs`), and cryptographic signing & payload encryption (`AES-256-GCM` & `HMAC-SHA256`).
- **Database & Persistence**: Hybrid Relational Architecture supporting PostgreSQL (`pg` pool) with complete DDL schema (`backend/src/db/schema.sql`) and an in-memory transactional fallback store (`memoryStore` in `backend/src/config/db.js`) with pre-seeded multi-hospital nodes, doctors, patients, encounters, tests, medications, allergies, documents, and immutable audit logs.
- **Authentication**: JWT Bearer token authentication via `verifyToken` middleware, capturing authenticated `id`, `name`, `role`, `hospital_id`, and `patient_id`.
- **Authorization & RBAC**: Strict least-privilege 4-tier RBAC (`DOCTOR`, `PATIENT`, `HOSPITAL_ADMIN`, `SYSTEM_ADMIN`). Server-side clinical access policies enforce local attending care boundaries, destination hospital transfer scopes, and time-bound break-glass emergency access.
- **Consent Engine**: Server-side validation of patient consent status (`PENDING`, `GRANTED`, `REJECTED`, `REVOKED`, `EXPIRED`) with granular category-level data minimization filters.
- **API Structure**: Standard REST endpoints grouped by resource: `/api/auth`, `/api/hospitals`, `/api/patients`, `/api/transfers`, `/api/consents`, `/api/emergency-access`, `/api/documents`, `/api/audit-logs`, `/api/notifications`, `/api/visits`, `/api/tests`, `/api/security`, `/api/data-quality`, `/api/research`.

---

## 2. Existing Files and Their Purposes

### Backend
- `backend/src/server.js`: Express server bootstrap, middleware configuration, health checks, route registration, and database initialization.
- `backend/src/config/db.js`: Hybrid PostgreSQL connection pool and in-memory mock clinical store with SQL query simulator.
- `backend/src/db/schema.sql`: PostgreSQL DDL schema with 22 tables including clinical, transfer, consent, audit, and AI/ML evaluation entities.
- `backend/src/db/seed.js`: Standalone PostgreSQL database seed script.
- `backend/src/middleware/auth.js`: JWT token verification and role-based access control middleware (`verifyToken`, `requireRole`).
- `backend/src/repositories/aiRepository.js`: Unified data repository handling CRUD operations across PostgreSQL and memoryStore for all AI/ML entities.
- `backend/src/services/clinicalAccessPolicy.js`: Consent-aware and RBAC-aware authorization guard ensuring zero unauthorized PHI leakage.
- `backend/src/services/patientAggregateService.js`: Clinical record aggregation, category-level projection, data minimization, and FHIR-oriented resource formatting.
- `backend/src/services/aiService.js`: AI provider abstraction supporting deterministic grounded mock provider and external LLM provider interfaces.
- `backend/src/services/securityAnomalyService.js`: Robust statistical outlier and behavioral anomaly analysis engine for audit logs.
- `backend/src/services/aiAuditService.js`: Minimized cryptographic SHA-256 output-hashing and immutable audit event logger for AI operations.
- `backend/src/utils/crypto.js`: AES-256-GCM encryption/decryption and HMAC-SHA256 package signature generator.
- `backend/src/utils/auditLogger.js`: Relational append-only immutable audit trail recorder.
- `backend/src/utils/fhirMapper.js`: Conceptual FHIR R4 resource mapper (Patient, Encounter, Condition, Observation, MedicationRequest, Bundle).
- `backend/src/controllers/*.js`: Express route controllers for Auth, Transfers, Consents, Patients, AI, Documents, Emergency, Audits, Security, Research.
- `backend/src/routes/*.js`: Route definitions mapping HTTP methods to controller actions with auth/role guards.
- `backend/tests/*.js`: End-to-end integration and security test suites.

### Frontend
- `frontend/src/App.jsx`: Main root application component with global auth provider and layout structure.
- `frontend/src/context/AuthContext.jsx`: Authentication context managing login state, user tokens, and quick demo role switching.
- `frontend/src/api/axios.js`: Axios instance configured with JWT request interceptors and error handling.
- `frontend/src/components/Navbar.jsx`: Application navigation header with active role indicator and quick role switcher.
- `frontend/src/components/Login.jsx`: Login screen with quick credentials launcher for demo accounts.
- `frontend/src/components/DashboardOverview.jsx`: Master dashboard routing doctor, patient, hospital admin, and system admin views.
- `frontend/src/components/AITransferWorkspace.jsx`: Comprehensive AI decision support workspace for transfer creation and review.
- `frontend/src/components/TransferDossierModal.jsx`: Receiving clinician clinical transfer dossier and RAG patient assistant modal.
- `frontend/src/components/TransferModal.jsx`: Patient transfer request creation modal with data category minimization selection.
- `frontend/src/components/ConsentCenter.jsx`: Plain-language patient consent management dashboard.
- `frontend/src/components/SecurityDashboard.jsx` & `SecurityIntelligencePanel.jsx`: Security telemetry, anomalous actor detection, and audit trail analytics.
- `frontend/src/components/ResearchDashboard.jsx`: Research evaluation suite comparing baseline manual workflows vs proposed AI/ML pipeline.
- `frontend/src/components/PatientDossierModal.jsx`: Full patient longitudinal record viewer with integrated RAG record assistant.

---

## 3. New AI/ML Modules & Target Architecture

To provide an interoperable, dual-stack AI/ML research environment, we are adding a Python AI/ML layer in `backend/` alongside the existing Node.js backend. This allows local training, offline evaluation, scikit-learn model serialization, vector embeddings, and Python research execution while seamlessly powering the live REST APIs.

### Target Architecture

```
Frontend (React + Vite + TailwindCSS)
       │
       ▼
Backend API (Express REST Engine)
       │
       ▼
Authentication (JWT Bearer Token)
       │
       ▼
Authorization & Role Verification (RBAC)
       │
       ▼
Consent Verification & Data Scope Minimization (Consent Guard)
       │
       ▼
Transfer Engine / Clinical Context
       │
       ▼
AI/ML Service Layer (Dual Node.js & Python Architecture)
  ├── AI Clinical Handover Generator (Traceable source citations)
  ├── Grounded RAG Patient Record Assistant (Vector / Chunked Retrieval)
  ├── Critical Information Extractor (Allergies, Meds, Abnormal Labs)
  ├── Intelligent Record Relevance Engine (Semantic Scoring & Reason)
  ├── Data Quality & Anomaly Engine (Deterministic & Heuristic checks)
  ├── Transfer Complexity ML (RandomForestClassifier + DecisionTree baseline)
  └── Security Anomaly ML (IsolationForest + Robust Feature Distance)
       │
       ▼
Doctor Verification & Review Controls (Edit, Confirm, Approve)
       │
       ▼
AES-256-GCM Encrypted Transfer Dispatch
       │
       ▼
Hospital B Receiving Doctor Dossier & Interactive Querying
       │
       ▼
Immutable Append-Only Audit Logging & Research Telemetry
```

### New Python & Backend Files to Create

```
backend/
├── ai/
│   ├── __init__.py
│   ├── ai_service.py              # Unified AI provider interface (Mock + External)
│   ├── handover_service.py        # Clinical handover generation logic
│   ├── extraction_service.py      # Structured clinical entity extraction
│   ├── relevance_service.py       # Semantic relevance scoring engine
│   ├── rag_service.py             # Vector search & grounded RAG assistant
│   ├── prompts.py                 # Structured system and user clinical prompts
│   └── schemas.py                 # Pydantic schemas for structured inputs & outputs
│
├── ml/
│   ├── __init__.py
│   ├── model_loader.py            # Model serialization & inference loader
│   ├── anomaly_service.py         # IsolationForest security anomaly detector
│   ├── complexity_service.py      # RandomForest transfer complexity classifier
│   ├── preprocessing.py           # Feature engineering & scaling pipelines
│   ├── evaluation.py              # Accuracy, Precision, Recall, F1, Confusion Matrix
│   ├── datasets/
│   │   ├── security_logs.csv          # Synthetic security access telemetry
│   │   └── transfer_complexity.csv    # Synthetic clinical transfer complexity dataset
│   ├── training/
│   │   ├── train_anomaly_model.py     # IsolationForest training script
│   │   └── train_complexity_model.py  # RandomForest & Baseline training script
│   ├── evaluation/
│   │   ├── evaluate_anomaly_model.py  # Anomaly evaluation runner
│   │   └── evaluate_complexity_model.py # Complexity evaluation runner
│   └── models/
│       ├── anomaly_isolation_forest.joblib
│       ├── transfer_complexity_rf.joblib
│       ├── transfer_complexity_baseline.joblib
│       └── model_metadata.json
│
├── security/
│   ├── __init__.py
│   ├── authorization.py           # Python RBAC & identity verification
│   └── consent_guard.py           # Python consent verification & scope enforcement
│
├── research/
│   ├── __init__.py
│   └── evaluation_service.py      # Experimental evaluation & baseline comparison engine
│
├── interop/
│   ├── __init__.py
│   └── fhir_mapper.py             # Python HL7 FHIR R4 resource mapper
│
└── tests_py/
    ├── __init__.py
    ├── test_ai_services.py
    ├── test_ml_models.py
    ├── test_consent_guard.py
    └── test_end_to_end_py.py
```

---

## 4. Modified Files & Enhancements

1. `backend/package.json`: Add scripts for running Python ML training, ML evaluation, and Python tests alongside Node tests.
2. `backend/.env.example` & `backend/.env`: Ensure complete environment variable documentation for `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `ML_MODEL_PATH`, etc.
3. `backend/src/routes/transferRoutes.js` & `patientRoutes.js`: Ensure complete route coverage for `/ai/extract`, `/ai/handover`, `/ai/relevance`, `/ai/complexity`, `/ai/search`, and `/data-quality`.
4. `backend/src/controllers/aiController.js`: Extend controller endpoints to interface with AI and ML services while enforcing source tracking and consent.
5. `backend/src/services/aiService.js`: Ensure all section generators and RAG assistants strictly abide by authorized record boundaries.
6. `frontend/src/components/AITransferWorkspace.jsx`: Verify UI components (AI Handover Card, Critical Information, Record Relevance, Data Quality, Transfer Complexity) provide clear edit/approval/confirmation controls.
7. `frontend/src/components/TransferDossierModal.jsx`: Verify RAG Patient Record Assistant interactive search with clickable sources and evidence indicators.
8. `frontend/src/components/SecurityIntelligencePanel.jsx` & `SecurityDashboard.jsx`: Verify explainable anomaly cards and charts.
9. `frontend/src/components/ResearchDashboard.jsx`: Verify live calculated research benchmarks (Handover, RAG, Relevance, Quality, Anomaly, Complexity) and Baseline vs Proposed comparison metrics.

---

## 5. Database Schema Changes & Entities

All required relational entities are defined and indexed in `backend/src/db/schema.sql` and supported in `aiRepository.js` and `db.js`:
- `ai_handover_summaries`: Draft/edited/approved clinical handover summaries with model version, source IDs, and clinician approval timestamps.
- `ai_record_relevance`: Semantic relevance scores, justifications, suggestions, and doctor selections.
- `ai_critical_information`: Extracted critical clinical entities with clinician confirmation status.
- `data_quality_issues`: Detected quality flags (missing fields, duplicate tests, conflicting values, recency).
- `ai_search_logs`: Grounded RAG query logs with question hashes, retrieved source citations, and evidence count.
- `security_anomalies`: IsolationForest and feature-distance security anomaly detections with review statuses.
- `transfer_complexity_results`: Transfer workflow complexity classification (LOW, MODERATE, HIGH) and contributing factors.
- `ai_audit_events`: Tamper-evident AI operation audit records with output SHA-256 hashes.
- `research_evaluation_runs` & `research_evaluation_entries`: Dynamic empirical research evaluation tracking.

---

## 6. API Endpoints

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/transfers/:id/ai/handover` | Generate AI Clinical Handover Draft | `DOCTOR` |
| `GET` | `/api/transfers/:id/ai/handover` | Get Handover Summary | `DOCTOR`, `PATIENT` |
| `PUT` | `/api/transfers/:id/ai/handover` | Edit Handover Summary Draft | `DOCTOR` |
| `POST` | `/api/transfers/:id/ai/handover/approve` | Clinician Handover Approval | `DOCTOR` |
| `POST` | `/api/transfers/:id/ai/critical-information` | Extract Critical Clinical Items | `DOCTOR` |
| `GET` | `/api/transfers/:id/ai/critical-information` | Get Extracted Critical Items | `DOCTOR` |
| `PUT` | `/api/transfers/:id/ai/critical-information` | Confirm/Edit/Dismiss Critical Items | `DOCTOR` |
| `POST` | `/api/transfers/:id/ai/relevance` | Calculate Record Relevance Scores | `DOCTOR` |
| `GET` | `/api/transfers/:id/ai/relevance` | Get Record Relevance Suggestions | `DOCTOR` |
| `PUT` | `/api/transfers/:id/ai/relevance` | Doctor Record Selection Review | `DOCTOR` |
| `POST` | `/api/transfers/:id/ai/complexity` | Predict Transfer Complexity | `DOCTOR` |
| `GET` | `/api/transfers/:id/ai/complexity` | Get Transfer Complexity | `DOCTOR` |
| `POST` | `/api/patients/:id/ai/search` | Grounded RAG Record Assistant Query | `DOCTOR`, `PATIENT` |
| `GET` | `/api/patients/:id/ai/search/history` | Get RAG Search Query History | `DOCTOR`, `PATIENT` |
| `POST` | `/api/patients/:id/data-quality/check` | Execute Data Quality Rules Engine | `DOCTOR`, `PATIENT` |
| `GET` | `/api/patients/:id/data-quality` | Retrieve Data Quality Issues | `DOCTOR`, `PATIENT` |
| `PUT` | `/api/data-quality/:id` | Review/Verify Data Quality Issue | `DOCTOR` |
| `POST` | `/api/security/anomalies/analyze` | Run ML Security Anomaly Detection | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |
| `GET` | `/api/security/anomalies` | List Detected Security Anomalies | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |
| `GET` | `/api/security/analytics` | Security Telemetry Analytics | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |
| `GET` | `/api/research/runs` | List Research Evaluation Runs | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |
| `POST` | `/api/research/runs` | Create Research Evaluation Run | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |
| `GET` | `/api/research/runs/:id/summary` | Get Research Metrics Summary | `HOSPITAL_ADMIN`, `SYSTEM_ADMIN` |

---

## 7. Frontend Components

- `AIHandoverCard`: Displays clinical handover summary sections, source references badge, model info, edit modal, and doctor approval button.
- `CriticalInformationCard`: Displays extracted allergies, medications, abnormal lab results, and procedures with confirm/edit/dismiss controls.
- `RecordRelevancePanel`: Displays suggested relevant records with relevance scores, rationales, and clinician checkboxes.
- `DataQualityPanel`: Displays composite data quality score (completeness, consistency, recency, duplication) and actionable issue list.
- `PatientRecordAssistant`: Natural language clinical question interface with grounded responses, clickable source chips, and verification badges.
- `TransferComplexityCard`: Displays predicted workflow complexity (LOW, MODERATE, HIGH) and weighted contributing factors.
- `SecurityAnomalyPanel`: Security intelligence dashboard displaying detected outlier actors, score details, and review actions.
- `AISourceReferences` & `AIStatusBadge`: Reusable badge components for source record traceability and draft/approved statuses.
- `ResearchMetricsPanel`: Real-time benchmark visualizations for AI handover accuracy, RAG precision, model confusion matrices, and Baseline vs Proposed time-savings.

---

## 8. Dependencies

### Python Dependencies (already verified installed)
- `scikit-learn` (v1.9.0)
- `pandas` (v3.0.5)
- `numpy` (v2.5.2)
- `joblib` (v1.5.3)
- `pydantic` (v2.13.4)
- `fastapi` (v0.141.1)
- `pytest` / Python standard `unittest`

### Node.js Dependencies (backend package.json)
- `express`, `cors`, `morgan`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `pg`

---

## 9. Dependency-Safe Implementation Sequence

1. **Step 1 — Create Implementation Plan (`/docs/AI_ML_IMPLEMENTATION_PLAN.md`)**: Complete architecture and inspection document.
2. **Step 2 — Implement Python AI Service & Schemas (`backend/ai/`)**: Implement `schemas.py`, `prompts.py`, `ai_service.py`, `handover_service.py`, `extraction_service.py`, `relevance_service.py`, and `rag_service.py`.
3. **Step 3 — Implement Security & Consent Guard Modules (`backend/security/`)**: Implement `authorization.py` and `consent_guard.py`.
4. **Step 4 — Implement FHIR Mapping Layer (`backend/interop/`)**: Implement `fhir_mapper.py`.
5. **Step 5 — Implement ML Datasets & Training Pipelines (`backend/ml/`)**: Generate synthetic `security_logs.csv` and `transfer_complexity.csv`, build training scripts for IsolationForest and RandomForest, train models, and serialize artifacts to `ml/models/`.
6. **Step 6 — Implement ML Inference & Evaluation Services (`backend/ml/`)**: Implement `model_loader.py`, `anomaly_service.py`, `complexity_service.py`, `preprocessing.py`, and `evaluation.py`.
7. **Step 7 — Implement Research Evaluation Engine (`backend/research/`)**: Implement `evaluation_service.py` with real metric calculations for all AI/ML subsystems and baseline comparison.
8. **Step 8 — Bridge & Validate Backend APIs**: Ensure all endpoints in `transferRoutes`, `patientRoutes`, `securityRoutes`, and `researchRoutes` are fully operational.
9. **Step 9 — Verify & Polish Frontend UI Components**: Ensure all clinical, security, and research dashboards render cleanly, handle interactive doctor reviews, and show explainable evidence.
10. **Step 10 — Run Comprehensive Test Suites**: Execute Node and Python test suites covering authorization, consent filtering, RAG grounding, handover source tracing, ML anomaly detection, and transfer workflows.
11. **Step 11 — Create Final Verification Report (`/docs/IMPLEMENTED_FEATURES.md`)**: Document all created files, API endpoints, ML models, evaluation metrics, and running instructions.
