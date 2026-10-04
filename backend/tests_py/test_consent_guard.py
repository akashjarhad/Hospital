import unittest
from security.consent_guard import (
    is_consent_valid,
    filter_by_data_minimization,
    authorize_ai_context
)
from security.authorization import SecurityAuthorizationError

class TestConsentGuard(unittest.TestCase):
    def setUp(self):
        self.patient = {
            "id": 1,
            "name": "Rajesh Kumar",
            "unique_health_id": "P-10001",
            "dob": "1972-04-15",
            "blood_group": "B+",
            "medical_history": "Diabetes",
            "allergies": "Penicillin",
            "medications": [
                {"id": 1, "medication_name": "Heparin", "is_current": True},
                {"id": 2, "medication_name": "Metformin", "is_current": False}
            ],
            "visits": [
                {
                    "id": 1,
                    "hospital_id": 1,
                    "attending_doctor_id": 1,
                    "admission_date": "2026-09-20",
                    "diagnosis": "Acute MI",
                    "tests": [
                        {"id": 1, "test_name": "Troponin", "category": "Laboratory", "result": "14.8"}
                    ]
                }
            ],
            "documents": [
                {"id": 1, "document_type": "Diagnostic Report", "title": "ECG"}
            ]
        }
        self.transfer = {
            "id": 1,
            "source_hospital_id": 1,
            "destination_hospital_id": 2,
            "requesting_doctor_id": 1,
            "receiving_doctor_id": 4,
            "requested_data": ["Patient Demographics", "Current Diagnosis", "Allergies", "Current Medications", "Laboratory Reports"]
        }
        self.active_consent = {
            "id": 1,
            "status": "GRANTED",
            "data_categories": ["Patient Demographics", "Current Diagnosis", "Allergies", "Current Medications", "Laboratory Reports"],
            "expires_at": "2030-01-01T00:00:00Z"
        }
        self.pending_consent = {
            "id": 1,
            "status": "PENDING",
            "data_categories": ["Patient Demographics"],
            "expires_at": "2030-01-01T00:00:00Z"
        }

    def test_source_doctor_access(self):
        doc_a = {"id": 1, "role": "DOCTOR", "hospital_id": 1}
        ctx = authorize_ai_context(doc_a, self.patient, self.transfer, self.pending_consent)
        self.assertEqual(ctx["name"], "Rajesh Kumar")
        self.assertEqual(ctx["allergies"], "Penicillin")

    def test_destination_doctor_blocked_without_consent(self):
        doc_b = {"id": 4, "role": "DOCTOR", "hospital_id": 2}
        with self.assertRaises(SecurityAuthorizationError):
            authorize_ai_context(doc_b, self.patient, self.transfer, self.pending_consent)

    def test_destination_doctor_allowed_with_granted_consent(self):
        doc_b = {"id": 4, "role": "DOCTOR", "hospital_id": 2}
        ctx = authorize_ai_context(doc_b, self.patient, self.transfer, self.active_consent)
        self.assertEqual(ctx["name"], "Rajesh Kumar")
        self.assertIn("medications", ctx)

    def test_unauthorized_third_party_doctor_blocked(self):
        doc_c = {"id": 99, "role": "DOCTOR", "hospital_id": 3}
        with self.assertRaises(SecurityAuthorizationError):
            authorize_ai_context(doc_c, self.patient, self.transfer, self.active_consent)

    def test_data_minimization_strips_unconsented_categories(self):
        minimized = filter_by_data_minimization(self.patient, ["Patient Demographics", "Allergies"])
        self.assertIn("name", minimized)
        self.assertIn("allergies", minimized)
        self.assertNotIn("medications", minimized)
        self.assertNotIn("medical_history", minimized)

if __name__ == "__main__":
    unittest.main()
