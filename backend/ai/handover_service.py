from typing import Dict, Any, Optional, List
from .schemas import HandoverSummary, HandoverSections
from .prompts import SYSTEM_HANDOVER_PROMPT

UNAVAILABLE = "Not available in authorized records."
SAFETY_NOTICE = "AI-generated draft — verify before clinical use. Clinician verification and approval required."


def _get_tests(projected: Dict[str, Any]) -> List[Dict[str, Any]]:
    res = []
    for visit in projected.get("visits", []):
        for test in visit.get("tests", []):
            t = dict(test)
            t["visit_id"] = visit.get("id")
            res.append(t)
    return res


def _get_source_ids(projected: Dict[str, Any]) -> List[str]:
    sources = []
    if projected.get("id"):
        sources.append(f"Patient/{projected.get('id')}")
    for visit in projected.get("visits", []):
        if visit.get("id"):
            sources.append(f"Encounter/{visit.get('id')}")
        for test in visit.get("tests", []):
            cat = str(test.get("category", "")).lower()
            res_type = "DiagnosticReport" if any(k in cat for k in ["imag", "radio", "scan", "x-ray", "ultra"]) else "Observation"
            sources.append(f"{res_type}/{test.get('id')}")
    for med in projected.get("medications", []):
        sources.append(f"MedicationRequest/{med.get('id')}")
    for allergy in projected.get("allergy_records", []):
        sources.append(f"AllergyIntolerance/{allergy.get('id')}")
    for doc in projected.get("documents", []):
        sources.append(f"DocumentReference/{doc.get('id')}")
    return sources


def generate_clinical_handover(
    projected_data: Dict[str, Any],
    transfer_meta: Optional[Dict[str, Any]],
    service_context: Any
) -> Dict[str, Any]:
    """
    Synthesize authorized clinical records into a structured, source-traced clinical handover summary.
    """
    if service_context.provider != "mock" and service_context.external_enabled:
        payload = {
            "authorized_patient_records": projected_data,
            "transfer_metadata": transfer_meta or {}
        }
        external_res = service_context.call_external_llm(SYSTEM_HANDOVER_PROMPT, payload)
        external_res["label"] = "External Provider Grounded Response"
        external_res["safety_notice"] = SAFETY_NOTICE
        return external_res

    # Deterministic Grounded Mock Generation
    patient_name = projected_data.get("name", "")
    uhi = projected_data.get("unique_health_id", "")
    age_dob = projected_data.get("dob", "")
    gender = projected_data.get("gender", "")
    blood_group = projected_data.get("blood_group", "")

    if patient_name:
        patient_overview = f"{patient_name} (ABHA ID: {uhi or 'N/A'}), DOB: {age_dob or 'N/A'}, Gender: {gender or 'N/A'}, Blood Group: {blood_group or 'N/A'} [Patient/{projected_data.get('id', 1)}]"
    else:
        patient_overview = UNAVAILABLE

    transfer_reason = (transfer_meta.get("transfer_reason") if transfer_meta else None) or projected_data.get("transfer_reason") or UNAVAILABLE
    if transfer_meta and transfer_meta.get("id"):
        transfer_reason = f"{transfer_reason} [Transfer/{transfer_meta.get('id')}]"

    visits = projected_data.get("visits", [])
    sorted_visits = sorted(visits, key=lambda v: str(v.get("admission_date", "")), reverse=True)
    latest_visit = sorted_visits[0] if sorted_visits else {}

    current_diag = latest_visit.get("diagnosis") or projected_data.get("current_diagnosis") or projected_data.get("diagnosis")
    if current_diag:
        current_diag_text = f"{current_diag} [Encounter/{latest_visit.get('id', 1)}]"
    else:
        current_diag_text = UNAVAILABLE

    presenting_complaint = latest_visit.get("chief_complaint")
    if presenting_complaint:
        presenting_text = f"{presenting_complaint} [Encounter/{latest_visit.get('id', 1)}]"
    else:
        presenting_text = UNAVAILABLE

    history = projected_data.get("medical_history")
    if history:
        history_text = f"{history} [Patient/{projected_data.get('id', 1)}]"
    else:
        history_text = UNAVAILABLE

    # Allergies
    allergies = []
    if projected_data.get("allergies"):
        allergies.append(f"{projected_data.get('allergies')} [Patient/{projected_data.get('id', 1)}]")
    for a in projected_data.get("allergy_records", []):
        sub = a.get("substance", "")
        sev = a.get("severity", "")
        react = a.get("reaction_type", "")
        allergies.append(f"{sub} (Severity: {sev}, Reaction: {react}) [AllergyIntolerance/{a.get('id')}]")
    allergies_text = "; ".join(allergies) if allergies else UNAVAILABLE

    # Current medications
    meds = []
    for m in projected_data.get("medications", []):
        if m.get("is_current", True):
            name = m.get("medication_name", "")
            dose = m.get("dosage", "")
            freq = m.get("frequency", "")
            route = m.get("route", "Oral")
            meds.append(f"{name} {dose} {freq} via {route} [MedicationRequest/{m.get('id')}]")

    # Recent labs & diagnostic reports
    all_tests = _get_tests(projected_data)
    labs = []
    diag_reports = []
    for t in all_tests:
        cat = str(t.get("category", "")).lower()
        t_name = t.get("test_name", "")
        res = t.get("result", "")
        unit = t.get("units", "")
        abn = " (ABNORMAL)" if t.get("abnormal") else ""
        res_str = f"{t_name}: {res} {unit}{abn}".strip()
        if any(k in cat for k in ["imag", "radio", "scan", "x-ray", "ultra"]):
            diag_reports.append(f"{res_str} [DiagnosticReport/{t.get('id')}]")
        else:
            labs.append(f"{res_str} [Observation/{t.get('id')}]")

    # Recent procedures
    procedures = []
    for v in visits:
        notes = f"{v.get('diagnosis', '')} {v.get('clinical_notes', '')}"
        if any(kw in notes.lower() for kw in ["surgery", "procedure", "pci", "catheterization", "operation", "intubation", "scan"]):
            procedures.append(f"Recorded clinical procedure / intervention in visit on {v.get('admission_date', 'recent')}: {v.get('diagnosis')} [Encounter/{v.get('id')}]")

    # Critical warnings
    critical = []
    if any(t.get("abnormal") for t in all_tests):
        abnormal_names = [t.get("test_name") for t in all_tests if t.get("abnormal")]
        critical.append(f"Abnormal laboratory/diagnostic results flagged: {', '.join(abnormal_names)}")
    if allergies_text != UNAVAILABLE:
        critical.append(f"Documented Allergies: {allergies_text}")
    if latest_visit.get("status") in ["critical", "observation"]:
        critical.append(f"Encounter status flagged as {latest_visit.get('status').upper()} [Encounter/{latest_visit.get('id')}]")

    source_refs = _get_source_ids(projected_data)

    sections = HandoverSections(
        patient_overview=patient_overview,
        transfer_reason=transfer_reason,
        current_diagnosis=current_diag_text,
        presenting_complaint=presenting_text,
        relevant_history=history_text,
        allergies=allergies_text,
        current_medications=meds if meds else [UNAVAILABLE],
        recent_procedures=procedures if procedures else [UNAVAILABLE],
        relevant_labs=labs[:8] if labs else [UNAVAILABLE],
        relevant_diagnostic_reports=diag_reports[:5] if diag_reports else [UNAVAILABLE],
        pending_investigations=["Pending clinical reassessment at destination facility."],
        critical_information=critical if critical else [UNAVAILABLE]
    )

    return {
        "label": "DEMO / SYNTHETIC DATA — Grounded deterministic clinical handover",
        "safety_notice": SAFETY_NOTICE,
        "sections": sections.model_dump(),
        "source_references": source_refs,
        "model_name": service_context.model_name,
        "model_version": service_context.model_version
    }
