import re
from typing import Dict, Any, List
from .schemas import RelevanceSuggestion, RelevanceAnalysisResponse
from .prompts import SYSTEM_RELEVANCE_PROMPT
from ml.model_loader import model_manager

SAFETY_NOTICE = "AI Suggested Relevant Records. Attending physician makes final record selection for transfer."

# Keyword semantic relevance associations
CLINICAL_DOMAINS = {
    "cardiac": ["cardio", "pci", "ecg", "troponin", "nstemi", "stemi", "heart", "coronary", "heparin", "clopidogrel", "atorvastatin", "cath", "infarction"],
    "trauma": ["trauma", "fracture", "bleed", "shock", "hypovolemic", "fast", "ultrasound", "laceration", "pelvis", "emergency", "intubation"],
    "respiratory": ["pulmon", "respiratory", "ards", "abg", "chest", "copd", "asthma", "oxygen", "ventilat", "pneumonia", "bronch"],
    "neuro": ["stroke", "seizure", "mri", "brain", "neuro", "gcs", "paralysis", "hemorrhage"],
    "nephro": ["renal", "dialysis", "creatinine", "urea", "kidney", "nephro"]
}


def _calculate_keyword_similarity(text1: str, text2: str) -> float:
    words1 = set(re.findall(r'\w+', text1.lower()))
    words2 = set(re.findall(r'\w+', text2.lower()))
    if not words1 or not words2:
        return 0.1
    overlap = len(words1.intersection(words2))
    jaccard = overlap / len(words1.union(words2))

    # Domain bonus
    for domain, kws in CLINICAL_DOMAINS.items():
        if any(k in text1.lower() for k in kws) and any(k in text2.lower() for k in kws):
            return min(1.0, jaccard + 0.65)

    return min(1.0, jaccard * 2.5 + 0.15)


def _calculate_semantic_similarity(text1: str, text2: str) -> float:
    """
    Computes hybrid semantic relevance using Hugging Face SentenceTransformer
    dense embeddings with clinical domain keyword reinforcement.
    """
    kw_sim = _calculate_keyword_similarity(text1, text2)
    try:
        dense_sim = model_manager.compute_similarity(text1, text2)
        if dense_sim > 0.0:
            calibrated = min(1.0, max(0.1, dense_sim * 1.35))
            return max(calibrated, kw_sim)
    except Exception:
        pass
    return kw_sim


def compute_record_relevance(
    projected_data: Dict[str, Any],
    transfer_reason: str,
    service_context: Any
) -> Dict[str, Any]:
    """
    Intelligent Record Relevance scoring for inter-hospital transfer dossiers.
    Calculates relevance score, assigns HIGH/MEDIUM/LOW tier, and provides clinical justification.
    """
    if service_context.provider != "mock" and service_context.external_enabled:
        payload = {
            "transfer_reason": transfer_reason,
            "authorized_patient_records": projected_data
        }
        return service_context.call_external_llm(SYSTEM_RELEVANCE_PROMPT, payload)

    reason_lower = (transfer_reason or "").lower()
    suggestions: List[RelevanceSuggestion] = []

    # 1. Patient Demographics & History
    hist = projected_data.get("medical_history", "")
    hist_score = _calculate_semantic_similarity(reason_lower, hist)
    suggestions.append(RelevanceSuggestion(
        source_id=f"Patient/{projected_data.get('id', 1)}",
        resource_type="Patient",
        fields=["name", "dob", "gender", "blood_group", "medical_history"],
        relevance_score=round(max(0.75, hist_score), 2),
        relevance_tier="HIGH" if hist_score >= 0.7 or True else "MEDIUM",
        suggested_relevant=True,
        reason=f"Foundational patient demographics and longitudinal medical history ({hist or 'documented record'})."
    ))

    # 2. Encounters / Visits
    for v in projected_data.get("visits", []):
        v_diag = v.get("diagnosis", "")
        v_score = _calculate_semantic_similarity(reason_lower, f"{v_diag} {v.get('chief_complaint', '')} {v.get('clinical_notes', '')}")
        is_high = v_score >= 0.7 or (v.get("status") in ["critical", "admitted"])
        tier = "HIGH" if is_high else ("MEDIUM" if v_score >= 0.4 else "LOW")
        score = max(0.85 if is_high else 0.50, v_score)
        suggestions.append(RelevanceSuggestion(
            source_id=f"Encounter/{v.get('id')}",
            resource_type="Encounter",
            fields=["diagnosis", "chief_complaint", "clinical_notes", "status"],
            relevance_score=round(score, 2),
            relevance_tier=tier,
            suggested_relevant=score >= 0.5,
            reason=f"Clinical encounter: '{v_diag}' with urgency status '{v.get('status')}'. Matched transfer context."
        ))

        # Tests inside encounter
        for t in v.get("tests", []):
            cat = str(t.get("category", "")).lower()
            res_type = "DiagnosticReport" if any(k in cat for k in ["imag", "radio", "scan", "x-ray", "ultra"]) else "Observation"
            t_name = t.get("test_name", "")
            t_score = _calculate_semantic_similarity(reason_lower, f"{t_name} {t.get('result', '')} {cat}")
            if t.get("abnormal"):
                t_score = min(1.0, t_score + 0.35)
            tier = "HIGH" if t_score >= 0.7 else ("MEDIUM" if t_score >= 0.4 else "LOW")
            suggestions.append(RelevanceSuggestion(
                source_id=f"{res_type}/{t.get('id')}",
                resource_type=res_type,
                fields=["test_name", "result", "units", "abnormal"],
                relevance_score=round(t_score, 2),
                relevance_tier=tier,
                suggested_relevant=t_score >= 0.45 or bool(t.get("abnormal")),
                reason=f"{res_type} '{t_name}' (Result: {t.get('result')}){', flagged ABNORMAL' if t.get('abnormal') else ''}. Relevance to '{transfer_reason}'."
            ))

    # 3. Medications
    for m in projected_data.get("medications", []):
        m_name = m.get("medication_name", "")
        m_score = _calculate_semantic_similarity(reason_lower, f"{m_name} {m.get('dosage', '')}")
        if m.get("is_current", True):
            m_score = max(0.60, m_score + 0.2)
        tier = "HIGH" if m_score >= 0.7 else ("MEDIUM" if m_score >= 0.4 else "LOW")
        suggestions.append(RelevanceSuggestion(
            source_id=f"MedicationRequest/{m.get('id')}",
            resource_type="MedicationRequest",
            fields=["medication_name", "dosage", "frequency", "route"],
            relevance_score=round(m_score, 2),
            relevance_tier=tier,
            suggested_relevant=m.get("is_current", True),
            reason=f"Active medication regimen: {m_name} {m.get('dosage')}. Essential for continuity of pharmacotherapy."
        ))

    # 4. Allergies
    for a in projected_data.get("allergy_records", []):
        sub = a.get("substance", "")
        suggestions.append(RelevanceSuggestion(
            source_id=f"AllergyIntolerance/{a.get('id')}",
            resource_type="AllergyIntolerance",
            fields=["substance", "reaction_type", "severity"],
            relevance_score=0.92,
            relevance_tier="HIGH",
            suggested_relevant=True,
            reason=f"Critical patient safety record: Allergy to {sub} ({a.get('severity')}). Always highly relevant for transfer."
        ))

    # 5. Documents
    for d in projected_data.get("documents", []):
        d_title = d.get("title", "")
        d_type = d.get("document_type", "")
        d_score = _calculate_keyword_similarity(reason_lower, f"{d_title} {d_type}")
        tier = "HIGH" if d_score >= 0.7 else ("MEDIUM" if d_score >= 0.4 else "LOW")
        suggestions.append(RelevanceSuggestion(
            source_id=f"DocumentReference/{d.get('id')}",
            resource_type="DocumentReference",
            fields=["document_type", "title", "file_name"],
            relevance_score=round(d_score, 2),
            relevance_tier=tier,
            suggested_relevant=d_score >= 0.45,
            reason=f"Clinical document attachment: '{d_title}' ({d_type}). Relevance score {d_score:.2f} based on transfer keywords."
        ))

    # Sort suggestions by relevance score descending
    suggestions.sort(key=lambda s: s.relevance_score, reverse=True)

    return {
        "label": "DEMO / SYNTHETIC DATA — Explainable record relevance ranking",
        "safety_notice": SAFETY_NOTICE,
        "suggestions": [s.model_dump() for s in suggestions]
    }
