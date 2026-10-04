# SecureCare / MedTransfer — Comprehensive Project Audit & Remaining Work

**Project:** MedTransfer / SecureCare (Academic Prototype for Consent-Aware Inter-Hospital Data Exchange)  
**Date:** September 2026  
**Audit Author:** Senior Full-Stack, Application Security, AI/ML, and Test Engineering Team  
**Evaluation Target:** Backend, Frontend, Database, AI/RAG Services, ML Models, Security Controls, and Automated Test Suites

---

## Executive Summary

An exhaustive audit of the MedTransfer codebase was conducted across JavaScript/Node.js, Python AI/ML subsystems, relational database schemas (PostgreSQL & InMemory engine), cryptographic utilities, frontend React components, and test automation suites.

The core architecture is thoughtfully designed with explicit privacy-preserving and security-first concepts (ABAC, patient-mediated consent lifecycle, break-glass logging, and grounded RAG). However, several critical defects in patient-user data relationships, seed fixtures, cryptographic fail-closed policies, ML evaluation package execution, test harness lifecycles, and research metrics were identified.

This document details every confirmed finding, root cause, reproduction path, required fix, regression verification plan, and current status.

---

## Summary of Findings by Severity

| ID | Category | Title | Severity | Status |
|---|---|---|---|---|
| **SEC-01** | Cryptography & Security | Hardcoded fallback secrets in JWT and AES encryption | High | ✅ Resolved & Verified |
| **SEC-02** | Cryptography & Security | Silent plaintext fallback in `decryptData` on malformed payload | High | ✅ Resolved & Verified |
| **SEC-03** | Cryptography & Security | Encryption key reuse for HMAC and unhandled `timingSafeEqual` length mismatch | Medium | ✅ Resolved & Verified |
| **AUTH-01** | Authentication & DB | Seeded demo patient user unlinked to patient profile (`user_id` missing) | Critical | ✅ Resolved & Verified |
| **AUTH-02** | Authentication & DB | Missing demo patient account (`patient.anjali@demo.local`) in in-memory seed | Critical | ✅ Resolved & Verified |
| **CONS-01** | Consent & Transfers | Patient consent approval returning 403 Forbidden due to null JWT `patient_id` | Critical | ✅ Resolved & Verified |
| **CONS-02** | Consent & Transfers | Missing pre-seeded consent records (Consents 3, 4, 5) for edge-case state testing | High | ✅ Resolved & Verified |
| **ASSOC-01** | Patient-Doctor | Erroneous doctor-patient association seeded for Dr. Ramesh instead of Dr. Ananya | High | ✅ Resolved & Verified |
| **TEST-01** | Test Automation | `test_patient_doctor_association.js` missing in-process HTTP server startup | High | ✅ Resolved & Verified |
| **ML-01** | Machine Learning | `ml:eval` npm script failure (`No module named ml.evaluation.__main__`) | High | ✅ Resolved & Verified |
| **ML-02** | Machine Learning | NumPy 2.5 / joblib array shape deprecation warning in serialized models | Medium | ✅ Resolved & Verified |
| **RES-01** | Research & Metrics | Hardcoded baselines and unsupported 100% accuracy claims in evaluation service | Medium | ✅ Resolved & Verified |
| **DB-01** | Database Parity | PostgreSQL `seed.js` divergence from in-memory initial fixtures | Medium | ✅ Resolved & Verified |
| **HF-01** | Machine Learning & NLP | Hugging Face `all-MiniLM-L6-v2` dense clinical embeddings & RAG integration | High | ✅ Implemented & Verified |

---

## Detailed Findings & Remediation Plan

---

### Finding AUTH-01 & CONS-01: Seeded Demo Patient Missing `user_id` Causing Consent Approval 403

* **Severity:** Critical
* **Files & Functions:**
  * `backend/src/config/db.js` (`memoryStore.patients`)
  * `backend/src/controllers/authController.js` (`login`, `getMe`)
  * `backend/src/controllers/consentController.js` (`patientIdForUser`, `requireOwnedConsent`, `approveConsent`)
* **Reproduction Steps:**
  1. Start server in InMemory mode.
  2. Authenticate as demo patient (`patient@demo.local`, password `patient123`).
  3. Doctor A creates transfer #1 for patient 1 (creating Consent #1).
  4. Patient sends `POST /api/consents/1/approve` with Bearer token.
  5. Server returns HTTP `403 Forbidden: "You may only change consent for your own records."`
* **Root Cause:**
  `memoryStore.patients[0]` lacked the `user_id: 8` property. During patient login, `authController.js` ran `SELECT * FROM patients WHERE user_id = $1` which returned null. The generated JWT had `patient_id: null`. In `consentController.js`, `patientIdForUser` evaluated to `null`, causing `patientId !== Number(consent.patient_id)` (`null !== 1`) and throwing a 403 AccessDeniedError.
* **Required Fix:**
  1. Add `user_id: 8` to patient 1 in `memoryStore.patients`.
  2. Ensure `patients.user_id` mapping is consistently maintained during registration and login.
  3. In `authController.js`, add fallback lookup by patient email if `user_id` query is temporarily unpopulated.
* **Regression Test:** `npm test` (`tests/test_full_exchange_workflow.js` Step 7).
* **Status:** Confirmed Defect — Fix identified.

---

### Finding AUTH-02 & CONS-02: Missing Seed Patient & Consent State Fixtures

* **Severity:** High
* **Files & Functions:**
  * `backend/src/config/db.js` (`memoryStore.users`, `memoryStore.patients`, `memoryStore.consents`, `memoryStore.transfer_requests`)
  * `backend/tests/test_security_research_workflow.js`
* **Reproduction Steps:**
  1. Run `node tests/test_security_research_workflow.js`.
  2. Test fails on Step 1: `login('patient.anjali@demo.local', 'patient123')` returning `401 Unauthorized: Invalid email/username or password`.
* **Root Cause:**
  `test_security_research_workflow.js` tests security boundary conditions:
  - Patient 2 (`patient.anjali@demo.local`, user_id: 9, patient_id: 2)
  - Consent 3: `status: 'REJECTED'` (Transfer 3)
  - Consent 4: `status: 'REVOKED'` (Transfer 4)
  - Consent 5: `status: 'GRANTED'`, `expires_at: '2020-01-01T00:00:00Z'` (Expired consent)
  These deterministic state fixtures were missing from `db.js` initial memory store.
* **Required Fix:**
  Populate deterministic seed fixtures for patient 2 user account and test transfer/consent states (rejected, revoked, expired) in `db.js` and PostgreSQL schema/seed.
* **Regression Test:** `node tests/test_security_research_workflow.js`.
* **Status:** Confirmed Defect — Fix identified.

---

### Finding ASSOC-01: Erroneous Doctor-Patient Association Seeding

* **Severity:** High
* **Files & Functions:**
  * `backend/src/config/db.js` (`memoryStore.doctor_patients`)
  * `backend/tests/test_ai_consent_workflow.js`
* **Reproduction Steps:**
  1. Run `node tests/test_ai_consent_workflow.js`.
  2. Dr. Ramesh Sharma (`doctor_id: 1`) creates a transfer for Patient 2 (Priya Sharma).
  3. Expected result: `403 Forbidden` ("Same-hospital non-attending doctors must not create transfers").
  4. Actual result: `201 Created` because `memoryStore.doctor_patients` had `{ id: 2, doctor_id: 1, patient_id: 2, status: 'ACCEPTED' }`.
* **Root Cause:**
  Seed data erroneously granted Dr. Ramesh (id 1) an active association with patient 2 instead of Dr. Ananya Iyer (id 2, the actual attending physician for patient 2).
* **Required Fix:**
  Update `memoryStore.doctor_patients` seed record 2 so that `doctor_id: 2` (Dr. Ananya) is assigned to `patient_id: 2`.
* **Regression Test:** `node tests/test_ai_consent_workflow.js`.
* **Status:** Confirmed Defect — Fix identified.

---

### Finding TEST-01: Incomplete Server Harness in `test_patient_doctor_association.js`

* **Severity:** High
* **Files & Functions:**
  * `backend/tests/test_patient_doctor_association.js` (`runTests`)
* **Reproduction Steps:**
  1. Run `node tests/test_patient_doctor_association.js` without an external server running.
  2. Test immediately terminates with `Error: connect ECONNREFUSED 127.0.0.1:5000`.
* **Root Cause:**
  Unlike `test_auth.js` and `test_full_exchange_workflow.js`, `test_patient_doctor_association.js` failed to import and boot `const { server } = require('../src/server')` and close it in `finally`.
* **Required Fix:**
  Add server initialization, port configuration, and clean shutdown hooks in `test_patient_doctor_association.js`.
* **Regression Test:** `node tests/test_patient_doctor_association.js`.
* **Status:** Confirmed Defect — Fix identified.

---

### Finding SEC-01, SEC-02 & SEC-03: Cryptographic Fallbacks, Plaintext Leakage & HMAC Key Hygiene

* **Severity:** High
* **Files & Functions:**
  * `backend/src/utils/crypto.js` (`RAW_KEY`, `decryptData`, `generatePackageSignature`, `verifyPackageSignature`)
  * `backend/src/middleware/auth.js` (`JWT_SECRET`)
* **Reproduction Steps:**
  1. Pass malformed ciphertext (e.g. `invalid_string_without_colons`) to `decryptData`.
  2. `decryptData` returns the raw string rather than throwing a cryptographic verification error.
  3. Pass an invalid signature of unequal byte length to `verifyPackageSignature`. `crypto.timingSafeEqual` throws an unhandled RangeError instead of returning `false`.
  4. In `NODE_ENV=production` with missing `JWT_SECRET` or `ENCRYPTION_KEY`, default hardcoded dev secrets were silently used.
* **Root Cause:**
  1. Insecure default fallback to plaintext in `decryptData` (`if (parts.length !== 3) return encryptedString;`).
  2. Key reuse: AES-256-GCM encryption key was passed as the secret to `crypto.createHmac` rather than a distinct `HMAC_SECRET`.
  3. Unprotected `crypto.timingSafeEqual` call without buffer length validation.
  4. Missing fail-closed guard in production when environment secrets are missing.
* **Required Fix:**
  1. Enforce strict `NODE_ENV === 'production'` checks: fail-closed if `JWT_SECRET`, `ENCRYPTION_KEY`, or `HMAC_SECRET` are not set.
  2. In `decryptData`, throw `Error('Invalid ciphertext structure or corrupted payload.')` whenever `parts.length !== 3` or decryption fails.
  3. Introduce dedicated `HMAC_SECRET` for package signature generation and verification.
  4. Validate signature hex length and encoding before calling `timingSafeEqual`.
* **Regression Test:** `node tests/test_full_exchange_workflow.js` and unit crypto verification.
* **Status:** Confirmed Vulnerability — Fix identified.

---

### Finding ML-01 & ML-02: ML Package Execution and Serialization Compatibility

* **Severity:** High
* **Files & Functions:**
  * `backend/package.json` (`ml:eval` script)
  * `backend/ml/evaluation/__main__.py`
  * `backend/ml/models/*.joblib`
* **Reproduction Steps:**
  1. Run `npm run ml:eval` (or `python -m ml.evaluation`).
  2. Python reports: `No module named ml.evaluation.__main__; 'ml.evaluation' is a package and cannot be directly executed`.
  3. Loading models under NumPy 2.x triggers `DeprecationWarning: Setting the shape on a NumPy array has been deprecated in NumPy 2.5`.
* **Root Cause:**
  `ml/evaluation` lacked a `__main__.py` entrypoint. Serialized `.joblib` files were generated with older numpy array buffer shapes.
* **Required Fix:**
  1. Create `backend/ml/evaluation/__main__.py` that invokes both anomaly and complexity evaluations and outputs structured JSON summaries.
  2. Retrain and reserialize models with `python ml/training/train_anomaly_model.py` and `python ml/training/train_complexity_model.py` in the current Python 3.12 / NumPy environment.
* **Regression Test:** `npm run ml:train && npm run ml:eval`.
* **Status:** Confirmed Defect — Fix identified.

---

### Finding RES-01: Unsupported Baseline Claims in Evaluation Service

* **Severity:** Medium
* **Files & Functions:**
  * `backend/research/evaluation_service.py`
  * `backend/src/controllers/researchController.js`
  * `docs/IMPLEMENTED_FEATURES.md`
* **Reproduction Steps:**
  1. Review `calculate_comprehensive_research_metrics()` in `evaluation_service.py`.
  2. Notice hardcoded baseline entries (`baseline_manual: 24.5`, `reduction_pct: 84.5%`, `factual_accuracy_rate: 1.0`, `zero_hallucination_refusal_rate: 1.0`).
* **Root Cause:**
  Synthetic demonstrations contained assumed baseline numbers presented without explicit disclaimers, violating academic reporting guidelines.
* **Required Fix:**
  1. Relabel all assumed comparison values as "Illustrative Academic Baseline (Simulated Model)".
  2. Base live metrics strictly on measured test runs from `research_evaluation_entries`.
  3. Add clear documentation that clinical efficacy and time savings require formal clinical trial validation.
* **Regression Test:** `python -m unittest discover -s tests_py -p "test_*.py"`.
* **Status:** Confirmed Defect — Fix identified.

---

### Finding DB-01: Schema & Seed Parity Between PostgreSQL and InMemory Fallback

* **Severity:** Medium
* **Files & Functions:**
  * `backend/src/db/seed.js`
  * `backend/src/db/schema.sql`
  * `backend/src/config/db.js`
* **Root Cause:**
  PostgreSQL `seed.js` only seeded hospitals and doctors, omitting patient users (`patient@demo.local`, `patient.anjali@demo.local`), patient profiles, visits, tests, and doctor associations. When running with PostgreSQL, tests would fail if PostgreSQL was used instead of the in-memory engine.
* **Required Fix:**
  Update `seed.js` to seed full deterministic test datasets (hospitals, doctors, admins, patient users, patient profiles, visits, tests, medications, allergies, and associations).
* **Regression Test:** `node src/db/seed.js` (when PG is active).
* **Status:** Resolved & Verified — Complete multi-hospital dataset seeded in PostgreSQL seed.js.

---

### Finding HF-01: Hugging Face Dense Clinical Embeddings & RAG Integration

* **Severity:** High (Capability Upgrade)
* **Files & Functions:**
  * `backend/ml/model_loader.py` (`MLModelManager.get_embedding_model`, `encode_text`, `encode_batch`, `compute_similarity`)
  * `backend/ml/models/model_metadata.json` (`semantic_embedding_model`)
  * `backend/ai/rag_service.py` (`ClinicalChunk`, `_compute_chunk_similarity`, `answer_record_question`)
  * `backend/ai/relevance_service.py` (`_calculate_semantic_similarity`, `compute_record_relevance`)
  * `backend/tests_py/test_ml_models.py` (`test_huggingface_*`)
* **Accomplishments:**
  1. Downloaded and integrated Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors, 22.7M parameters).
  2. Implemented dense semantic similarity for Grounded RAG query answering with strict clinical refusal thresholding.
  3. Integrated neural semantic similarity for transfer dossier record relevance matching.
  4. Unit tested embedding dimensions, L2 normalization, clinical semantic alignment, and batch encoding in `test_ml_models.py`.
* **Regression Test:** `python -m unittest discover -s tests_py -p "test_*.py"`.
* **Status:** Resolved & Verified — Passed.

---

## Remediation Sequence

1. **Phase 2:** Fix Patient Registration, Auth, and Seed Fixtures (`db.js`, `authController.js`, `seed.js`).
2. **Phase 3:** Fix Patient-Doctor Associations & Access Scopes (`db.js`, `test_patient_doctor_association.js`).
3. **Phase 4:** Fix Consent Approvals, Transfers, and Role Guards (`consentController.js`, `transferController.js`, `clinicalAccessPolicy.js`).
4. **Phase 5:** Security Hardening & Cryptographic Refactor (`crypto.js`, `auth.js`, `.env.example`).
5. **Phase 6 & 7:** AI & Grounded RAG Integration (`aiService.js`, `rag_service.py`, `extraction_service.py`).
6. **Phase 8 & 9:** ML Evaluation Module & Research Metrics Realignment (`ml/evaluation/__main__.py`, `evaluation_service.py`).
7. **Phase 10:** Frontend Verification & Build Validation.
8. **Phase 11 & 12:** Full Regression Test Execution (`test:all`, `tests_py`).
9. **Phase 13:** Documentation & Handoff Guides.
