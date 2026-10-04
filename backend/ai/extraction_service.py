from typing import Dict, Any, List
from .schemas import CriticalInformationItem, CriticalInformationResponse
from .prompts import SYSTEM_CRITICAL_EXTRACTION_PROMPT

SAFETY_NOTICE = "AI-Detected Important Information. Clinician confirmation required before clinical inclusion."


def extract_critical_entities(projected_data: Dict[str, Any], service_context: Any) -> Dict[str, Any]:
    """
    Extract structured critical clinical information items with source references.
    """
    if service_context.provider != "mock" and service_context.external_enabled:
        payload = {"authorized_patient_records": projected_data}
        return service_context.call_external_llm(SYSTEM_CRITICAL_EXTRACTION_PROMPT, payload)

    items: List[CriticalInformationItem] = []

    # 1. Allergies
    if projected_data.get("allergies"):
        items.append(CriticalInformationItem(
            type="allergy",
            value=str(projected_data.get("allergies")),
            source_record_id=f"Patient/{projected_data.get('id', 1)}",
            date=None,
            confidence_descriptor="DIRECT_RECORD_FIELD"
        ))
    for a in projected_data.get("allergy_records", []):
        sub = a.get("substance", "")
        sev = a.get("severity", "MODERATE")
        react = a.get("reaction_type", "")
        val = f"{sub} — {react} (Severity: {sev})".strip(" —")
        items.append(CriticalInformationItem(
            type="allergy",
            value=val,
            source_record_id=f"AllergyIntolerance/{a.get('id')}",
            date=a.get("diagnosed_at"),
            confidence_descriptor="DIRECT_STRUCTURED_RECORD"
        ))

    # 2. Current Medications
    for m in projected_data.get("medications", []):
        if m.get("is_current", True):
            name = m.get("medication_name", "")
            dose = m.get("dosage", "")
            freq = m.get("frequency", "")
            route = m.get("route", "Oral")
            items.append(CriticalInformationItem(
                type="medication",
                value=f"{name} {dose} {freq} ({route})".strip(),
                source_record_id=f"MedicationRequest/{m.get('id')}",
                date=m.get("prescribed_at"),
                confidence_descriptor="DIRECT_STRUCTURED_RECORD"
            ))

    # 3. Diagnoses & Encounters
    for v in projected_data.get("visits", []):
        if v.get("diagnosis"):
            items.append(CriticalInformationItem(
                type="diagnosis",
                value=f"Primary Diagnosis: {v.get('diagnosis')}",
                source_record_id=f"Encounter/{v.get('id')}",
                date=v.get("admission_date"),
                confidence_descriptor="DIRECT_STRUCTURED_RECORD"
            ))

    # 4. Abnormal Laboratory & Diagnostic Observations
    for v in projected_data.get("visits", []):
        for t in v.get("tests", []):
            if t.get("abnormal"):
                cat = str(t.get("category", "")).lower()
                res_type = "DiagnosticReport" if any(k in cat for k in ["imag", "radio", "scan", "x-ray", "ultra"]) else "Observation"
                name = t.get("test_name", "")
                val = t.get("result", "")
                unit = t.get("units", "")
                ref = t.get("reference_range", "")
                notes = f" (Ref: {ref})" if ref else ""
                items.append(CriticalInformationItem(
                    type="abnormal_lab" if res_type == "Observation" else "abnormal_diagnostic",
                    value=f"{name}: {val} {unit}{notes}".strip(),
                    source_record_id=f"{res_type}/{t.get('id')}",
                    date=t.get("timestamp"),
                    confidence_descriptor="SOURCE_FLAGGED_ABNORMAL"
                ))

    # 5. Major Procedures
    for v in projected_data.get("visits", []):
        notes = f"{v.get('diagnosis', '')} {v.get('clinical_notes', '')}"
        if any(kw in notes.lower() for kw in ["surgery", "procedure", "pci", "catheterization", "operation", "intubation", "scan"]):
            items.append(CriticalInformationItem(
                type="procedure",
                value=f"Interventional procedure: {v.get('diagnosis')}",
                source_record_id=f"Encounter/{v.get('id')}",
                date=v.get("admission_date"),
                confidence_descriptor="EXTRACTED_CLINICAL_EVENT"
            ))

    return {
        "label": "DEMO / SYNTHETIC DATA — Deterministic critical information extraction",
        "safety_notice": SAFETY_NOTICE,
        "items": [item.model_dump() for item in items],
        "unavailable_message": None if items else "No critical items detected in authorized records."
    }
