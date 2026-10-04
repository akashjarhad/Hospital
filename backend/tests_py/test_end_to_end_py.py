import unittest
from security.consent_guard import authorize_ai_context
from ai.ai_service import ai_service_instance
from ai.relevance_service import compute_record_relevance
from ai.extraction_service import extract_critical_entities
from ai.handover_service import generate_clinical_handover
from ai.rag_service import answer_record_question
from ml.complexity_service import predict_transfer_complexity
from ml.anomaly_service import detect_security_anomalies
from interop.fhir_mapper import create_fhir_transfer_bundle

class TestEndToEndTransferWorkflow(unittest.TestCase):
    def test_full_scenario_p1001(self):
        # Scenario: Patient P1001, Hospital A (AIIMS) -> Doctor A initiates transfer to Hospital B (Apollo) -> Doctor B
        patient_data = {
            "id": 1,
            "name": "Rajesh Kumar",
            "unique_health_id": "P-10001",
            "dob": "1972-04-15",
            "gender": "Male",
            "blood_group": "B+",
            "medical_history": "Type-2 Diabetes, Hypertension",
            "allergies": "Penicillin (Moderate rash)",
            "allergy_records": [{"id": 1, "substance": "Penicillin", "severity": "MODERATE", "reaction_type": "Skin Rash"}],
            "medications": [
                {"id": 1, "medication_name": "Heparin Sodium IV", "dosage": "1000 IU/hr", "frequency": "Continuous", "is_current": True, "prescribed_at": "2026-09-20"},
                {"id": 2, "medication_name": "Clopidogrel", "dosage": "300 mg", "frequency": "Stat", "is_current": True, "prescribed_at": "2026-09-20"}
            ],
            "visits": [
                {
                    "id": 1,
                    "hospital_id": 1,
                    "attending_doctor_id": 1,
                    "admission_date": "2026-09-20",
                    "status": "critical",
                    "diagnosis": "Acute Coronary Syndrome / Non-STEMI with Cardiogenic Shock",
                    "chief_complaint": "Severe retrosternal chest pain",
                    "clinical_notes": "Emergency PCI required. Inter-hospital transfer initiated.",
                    "tests": [
                        {"id": 1, "test_name": "Cardiac Troponin I", "category": "Laboratory", "result": "14.8", "units": "ng/mL", "abnormal": True, "timestamp": "2026-09-20"},
                        {"id": 2, "test_name": "12-Lead ECG", "category": "Diagnostic", "result": "ST depression", "abnormal": True, "timestamp": "2026-09-20"}
                    ]
                }
            ],
            "documents": [
                {"id": 1, "document_type": "Diagnostic Report", "title": "ECG Trace", "file_name": "ecg.pdf"}
            ]
        }

        transfer_meta = {
            "id": 1,
            "transfer_code": "TR-2026-0001",
            "source_hospital_id": 1,
            "destination_hospital_id": 2,
            "requesting_doctor_id": 1,
            "receiving_doctor_id": 4,
            "transfer_reason": "Specialist Treatment — Cath lab PCI for NSTEMI",
            "clinical_priority": "URGENT",
            "requested_data": ["Patient Demographics", "Current Diagnosis", "Allergies", "Current Medications", "Laboratory Reports", "Diagnostic Reports"]
        }

        # Step 1: Doctor A checks authorization & prepares transfer dossier
        doc_a = {"id": 1, "role": "DOCTOR", "hospital_id": 1}
        doc_a_context = authorize_ai_context(doc_a, patient_data, transfer_meta)
        self.assertIsNotNone(doc_a_context)

        # Step 2: AI analyzes relevant records
        relevance = compute_record_relevance(doc_a_context, transfer_meta["transfer_reason"], ai_service_instance)
        self.assertTrue(len(relevance["suggestions"]) > 0)

        # Step 3: AI extracts critical information
        critical = extract_critical_entities(doc_a_context, ai_service_instance)
        self.assertTrue(len(critical["items"]) >= 3)

        # Step 4: AI generates clinical handover draft
        handover = generate_clinical_handover(doc_a_context, transfer_meta, ai_service_instance)
        self.assertIn("Acute Coronary Syndrome", handover["sections"]["current_diagnosis"])
        self.assertTrue(len(handover["source_references"]) > 0)

        # Step 5: Transfer complexity prediction
        complexity = predict_transfer_complexity(doc_a_context, transfer_meta)
        self.assertIn(complexity["category"], ["MODERATE", "HIGH"])

        # Step 6: Patient approves consent
        consent = {
            "id": 1,
            "status": "GRANTED",
            "data_categories": transfer_meta["requested_data"],
            "expires_at": "2030-01-01T00:00:00Z"
        }

        # Step 7: Doctor B (Apollo Hospital) accesses authorized data under active consent
        doc_b = {"id": 4, "role": "DOCTOR", "hospital_id": 2}
        doc_b_context = authorize_ai_context(doc_b, patient_data, transfer_meta, consent)
        self.assertEqual(doc_b_context["name"], "Rajesh Kumar")

        # Step 8: Doctor B queries RAG patient assistant
        rag_res = answer_record_question(doc_b_context, "What were the abnormal lab findings?", ai_service_instance)
        self.assertIn("Troponin", rag_res["answer"])
        self.assertGreater(rag_res["evidence_count"], 0)

        # Step 9: FHIR R4 transfer package generated
        fhir_bundle = create_fhir_transfer_bundle(doc_b_context, transfer_meta)
        self.assertEqual(fhir_bundle["resourceType"], "Bundle")
        self.assertTrue(fhir_bundle["total"] >= 4)

        # Step 10: Access telemetry evaluated for security anomalies
        logs = [{
            "actor_id": 4,
            "hospital_id": 2,
            "features": {"patients_accessed_per_day": 4, "records_accessed_per_day": 12, "downloads_per_day": 1, "failed_authorizations": 0}
        }]
        anomalies = detect_security_anomalies(logs)
        self.assertEqual(len(anomalies), 0)  # Normal access generates zero alerts

if __name__ == "__main__":
    unittest.main()
