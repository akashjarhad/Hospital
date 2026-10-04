import unittest
from ai.ai_service import AIService
from ai.handover_service import generate_clinical_handover
from ai.extraction_service import extract_critical_entities
from ai.relevance_service import compute_record_relevance
from ai.rag_service import answer_record_question, UNAVAILABLE_TEXT

class TestAIServices(unittest.TestCase):
    def setUp(self):
        self.ai_service = AIService()
        self.sample_patient = {
            "id": 1,
            "name": "Rajesh Kumar",
            "unique_health_id": "P-10001",
            "dob": "1972-04-15",
            "gender": "Male",
            "blood_group": "B+",
            "medical_history": "Known Type-2 Diabetes Mellitus, Hypertension",
            "allergies": "Penicillin (Moderate rash)",
            "allergy_records": [
                {"id": 1, "substance": "Penicillin", "severity": "MODERATE", "reaction_type": "Skin Rash"}
            ],
            "medications": [
                {"id": 1, "medication_name": "Heparin Sodium IV", "dosage": "1000 IU/hr", "frequency": "Continuous", "is_current": True}
            ],
            "visits": [
                {
                    "id": 1,
                    "admission_date": "2026-09-20",
                    "status": "critical",
                    "diagnosis": "Acute Coronary Syndrome / Non-STEMI",
                    "chief_complaint": "Retrosternal chest pain",
                    "tests": [
                        {"id": 1, "test_name": "Cardiac Troponin I", "category": "Laboratory", "result": "14.8", "units": "ng/mL", "abnormal": True}
                    ]
                }
            ]
        }
        self.sample_transfer = {
            "id": 1,
            "transfer_reason": "Urgent Percutaneous Coronary Intervention (PCI)",
            "clinical_priority": "URGENT"
        }

    def test_handover_generation(self):
        res = generate_clinical_handover(self.sample_patient, self.sample_transfer, self.ai_service)
        self.assertIn("sections", res)
        sections = res["sections"]
        self.assertIn("Rajesh Kumar", sections["patient_overview"])
        self.assertIn("Acute Coronary Syndrome", sections["current_diagnosis"])
        self.assertIn("Penicillin", sections["allergies"])
        self.assertTrue(len(res["source_references"]) > 0)
        self.assertIn("Patient/1", res["source_references"])

    def test_critical_information_extraction(self):
        res = extract_critical_entities(self.sample_patient, self.ai_service)
        self.assertIn("items", res)
        types = [item["type"] for item in res["items"]]
        self.assertIn("allergy", types)
        self.assertIn("medication", types)
        self.assertIn("abnormal_lab", types)

    def test_relevance_ranking(self):
        res = compute_record_relevance(self.sample_patient, "Urgent cardiac cath and PCI", self.ai_service)
        self.assertIn("suggestions", res)
        self.assertTrue(len(res["suggestions"]) > 0)
        top_suggestion = res["suggestions"][0]
        self.assertIn("relevance_score", top_suggestion)
        self.assertIn("relevance_tier", top_suggestion)
        self.assertIn(top_suggestion["relevance_tier"], ["HIGH", "MEDIUM", "LOW"])

    def test_rag_question_answering_with_evidence(self):
        res = answer_record_question(self.sample_patient, "What medication is prescribed?", self.ai_service)
        self.assertIn("answer", res)
        self.assertIn("Heparin", res["answer"])
        self.assertGreater(res["evidence_count"], 0)
        self.assertTrue(len(res["sources"]) > 0)

    def test_rag_no_evidence_refusal(self):
        res = answer_record_question(self.sample_patient, "What is the patient's dental wisdom tooth status?", self.ai_service)
        self.assertIn("could not find", res["answer"].lower())
        self.assertEqual(res["evidence_count"], 0)

if __name__ == "__main__":
    unittest.main()
