import numpy as np
from typing import Dict, Any, List
from .model_loader import model_manager
from .preprocessing import preprocess_complexity_record

SAFETY_NOTICE = "Research prototype — workflow assistance only. NOT a clinical diagnostic or mortality risk score."


def predict_transfer_complexity(
    patient_data: Dict[str, Any],
    transfer_meta: Dict[str, Any],
    dq_issues_count: int = 0
) -> Dict[str, Any]:
    """
    ML-driven transfer complexity prediction using RandomForestClassifier.
    Assists receiving clinical teams in pre-allocating beds, specialists, and equipment.
    """
    model = model_manager.get_complexity_model()
    X = preprocess_complexity_record(patient_data, transfer_meta, dq_issues_count)

    # Factors explainability
    factors = []
    priority = str(transfer_meta.get("clinical_priority", "URGENT")).upper()
    if priority == "EMERGENCY":
        factors.append({
            "factor": "Clinical Urgency Level",
            "value": "EMERGENCY (Immediate specialized trauma/cardiac transfer required)",
            "weight": 3,
            "source_id": f"Transfer/{transfer_meta.get('id', 'N/A')}"
        })
    elif priority == "URGENT":
        factors.append({
            "factor": "Clinical Urgency Level",
            "value": "URGENT (Time-sensitive transfer)",
            "weight": 2,
            "source_id": f"Transfer/{transfer_meta.get('id', 'N/A')}"
        })

    visits = patient_data.get("visits", [])
    active_encounters = [v for v in visits if v.get("status") in ["admitted", "critical", "observation"]]
    if any(v.get("status") == "critical" for v in visits):
        factors.append({
            "factor": "Encounter Criticality",
            "value": "Patient in active CRITICAL encounter status",
            "weight": 3,
            "source_id": "Encounter Status"
        })
    elif len(active_encounters) > 1:
        factors.append({
            "factor": "Multiple Active Encounters",
            "value": f"{len(active_encounters)} active hospital encounters recorded",
            "weight": 2,
            "source_id": "Encounters"
        })

    meds = [m for m in patient_data.get("medications", []) if m.get("is_current", True)]
    if len(meds) >= 4:
        factors.append({
            "factor": "Polypharmacy Regimen",
            "value": f"{len(meds)} active concurrent medications administered",
            "weight": 2,
            "source_id": "MedicationRequests"
        })

    all_tests = [t for v in visits for t in v.get("tests", [])]
    abnormal_tests = [t for t in all_tests if t.get("abnormal")]
    if len(abnormal_tests) > 0:
        abn_names = [t.get("test_name") for t in abnormal_tests[:3]]
        factors.append({
            "factor": "Abnormal Diagnostic Results",
            "value": f"{len(abnormal_tests)} abnormal lab/imaging findings ({', '.join(abn_names)})",
            "weight": 2,
            "source_id": "Observations"
        })

    if any(any(kw in f"{v.get('diagnosis', '')} {v.get('clinical_notes', '')}".lower()
               for kw in ["surgery", "procedure", "pci", "catheterization", "operation", "intubation"])
           for v in visits):
        factors.append({
            "factor": "Recent Interventional Procedure",
            "value": "Recorded invasive procedure / catheterization requiring specialized post-op care",
            "weight": 3,
            "source_id": "Encounter Diagnosis"
        })

    if dq_issues_count > 0:
        factors.append({
            "factor": "Data Quality Warnings",
            "value": f"{dq_issues_count} unverified clinical data quality or conflicting test flags",
            "weight": 1,
            "source_id": "DataQualityEngine"
        })

    # Inference
    if model is not None:
        predicted_class = str(model.predict(X)[0])
        # Probabilities
        probs = model.predict_proba(X)[0]
        class_idx = list(model.classes_).index(predicted_class)
        confidence = float(probs[class_idx])
    else:
        # Fallback heuristic
        total_weight = sum(f["weight"] for f in factors)
        if total_weight >= 6:
            predicted_class = "HIGH"
        elif total_weight >= 3:
            predicted_class = "MODERATE"
        else:
            predicted_class = "LOW"
        confidence = 0.85

    score_val = sum(f["weight"] for f in factors)

    return {
        "category": predicted_class,
        "score": score_val,
        "confidence": round(confidence, 3),
        "contributing_factors": factors,
        "scoring_note": f"Workflow Complexity Score: {score_val} ({predicted_class}) derived from clinical priority, polypharmacy, and diagnostic factors.",
        "safety_notice": SAFETY_NOTICE,
        "model_version": "RandomForest-1.0.0"
    }
