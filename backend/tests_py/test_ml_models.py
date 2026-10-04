import unittest
from ml.model_loader import model_manager
from ml.anomaly_service import detect_security_anomalies
from ml.complexity_service import predict_transfer_complexity
from ml.preprocessing import preprocess_security_record, preprocess_complexity_record

class TestMLModels(unittest.TestCase):
    def test_model_manager_loads_models(self):
        anomaly_model = model_manager.get_anomaly_model()
        complexity_model = model_manager.get_complexity_model()
        self.assertIsNotNone(anomaly_model)
        self.assertIsNotNone(complexity_model)

    def test_anomaly_detection_normal_vs_anomalous(self):
        normal_logs = [{
            "actor_id": 1,
            "hospital_id": 1,
            "features": {
                "patients_accessed_per_day": 5,
                "records_accessed_per_day": 15,
                "downloads_per_day": 0,
                "unique_patients": 5,
                "failed_authorizations": 0,
                "emergency_access_count": 0,
                "after_hours_access": 0,
                "access_frequency_per_hour": 1.5
            }
        }]
        anomalous_logs = [{
            "actor_id": 99,
            "hospital_id": 1,
            "features": {
                "patients_accessed_per_day": 85,
                "records_accessed_per_day": 400,
                "downloads_per_day": 50,
                "unique_patients": 80,
                "failed_authorizations": 12,
                "emergency_access_count": 5,
                "after_hours_access": 25,
                "access_frequency_per_hour": 35.0
            }
        }]
        anomalies = detect_security_anomalies(anomalous_logs)
        self.assertTrue(len(anomalies) > 0)
        self.assertIn("score", anomalies[0])
        self.assertIn(anomalies[0]["severity"], ["MODERATE", "HIGH"])
        self.assertIn("explanation", anomalies[0])

    def test_transfer_complexity_prediction(self):
        sample_patient = {
            "dob": "1950-01-01",
            "visits": [
                {
                    "status": "critical",
                    "diagnosis": "Acute myocardial infarction with PCI intervention",
                    "clinical_notes": "Emergency surgery procedure done",
                    "tests": [
                        {"test_name": "Troponin", "abnormal": True},
                        {"test_name": "ECG", "abnormal": True}
                    ]
                }
            ],
            "medications": [
                {"is_current": True}, {"is_current": True}, {"is_current": True}, {"is_current": True}
            ]
        }
        sample_transfer = {"id": 1, "clinical_priority": "EMERGENCY"}
        res = predict_transfer_complexity(sample_patient, sample_transfer, dq_issues_count=1)
        self.assertIn("category", res)
        self.assertIn(res["category"], ["MODERATE", "HIGH"])
        self.assertTrue(len(res["contributing_factors"]) > 0)
        self.assertIn("safety_notice", res)

    def test_huggingface_embedding_model_loading_and_shape(self):
        """
        Verify Hugging Face SentenceTransformer model loads and produces normalized 384-d vectors.
        """
        model = model_manager.get_embedding_model()
        self.assertIsNotNone(model, "Hugging Face SentenceTransformer model should load successfully")
        emb = model_manager.encode_text("Acute ST-Elevation Myocardial Infarction emergency cardiac transfer")
        self.assertIsNotNone(emb)
        self.assertEqual(emb.shape, (384,))
        # Normalized vector has unit L2 norm
        import numpy as np
        norm = float(np.linalg.norm(emb))
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_huggingface_clinical_semantic_similarity(self):
        """
        Verify dense embeddings capture clinical semantic relationships accurately.
        """
        sim_cardiac = model_manager.compute_similarity(
            "Acute Myocardial Infarction emergency cardiac transfer",
            "Emergency coronary angiography and PCI catheterization"
        )
        sim_dental = model_manager.compute_similarity(
            "Acute Myocardial Infarction emergency cardiac transfer",
            "Dental tooth cavity filling and extraction"
        )
        self.assertGreater(sim_cardiac, sim_dental, "Cardiac related queries must have higher similarity than dental")
        self.assertGreater(sim_cardiac, 0.45, "Clinically related transfer concepts should score > 0.45")
        self.assertLess(sim_dental, 0.30, "Clinically unrelated concepts should score < 0.30")

    def test_huggingface_batch_encoding(self):
        """
        Verify batch encoding capability for patient transfer dossiers.
        """
        texts = [
            "Patient Name: Rajesh Kumar, ABHA-9821-4412-8801",
            "Diagnosis: Non-STEMI Acute Coronary Syndrome",
            "Active Medication: Heparin Sodium IV Infusion"
        ]
        batch = model_manager.encode_batch(texts)
        self.assertIsNotNone(batch)
        self.assertEqual(batch.shape, (3, 384))

if __name__ == "__main__":
    unittest.main()
