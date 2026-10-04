from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


def map_patient_to_fhir(patient: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "resourceType": "Patient",
        "id": f"P-{patient.get('id', 1)}",
        "identifier": [
            {
                "system": "https://healthid.ndhm.gov.in",
                "value": patient.get("unique_health_id", "P-10001")
            }
        ],
        "name": [{"use": "official", "text": patient.get("name", "Unknown Patient")}],
        "gender": str(patient.get("gender", "unknown")).lower(),
        "birthDate": patient.get("dob", "1970-01-01"),
        "telecom": [{"system": "phone", "value": patient.get("phone", "")}] if patient.get("phone") else [],
        "extension": [
            {
                "url": "http://hl7.org/fhir/StructureDefinition/patient-bloodGroup",
                "valueString": patient.get("blood_group", "O+")
            }
        ]
    }


def map_encounter_to_fhir(visit: Dict[str, Any], patient_id: int) -> Dict[str, Any]:
    return {
        "resourceType": "Encounter",
        "id": f"ENC-{visit.get('id', 1)}",
        "status": "in-progress" if visit.get("status") != "discharged" else "finished",
        "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "IMP", "display": "inpatient encounter"},
        "subject": {"reference": f"Patient/P-{patient_id}"},
        "period": {"start": str(visit.get("admission_date", datetime.now(timezone.utc).isoformat()))},
        "reasonCode": [{"text": visit.get("chief_complaint", "Clinical care")}],
        "diagnosis": [{"condition": {"display": visit.get("diagnosis", "Clinical Diagnosis")}}]
    }


def map_observation_to_fhir(test: Dict[str, Any], patient_id: int, encounter_id: Optional[int] = None) -> Dict[str, Any]:
    return {
        "resourceType": "Observation",
        "id": f"OBS-{test.get('id', 1)}",
        "status": "final",
        "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}],
        "code": {"text": test.get("test_name", "Lab Test")},
        "subject": {"reference": f"Patient/P-{patient_id}"},
        "encounter": {"reference": f"Encounter/ENC-{encounter_id}"} if encounter_id else None,
        "effectiveDateTime": str(test.get("timestamp", datetime.now(timezone.utc).isoformat())),
        "valueString": f"{test.get('result', '')} {test.get('units', '')}".strip(),
        "interpretation": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", "code": "A" if test.get("abnormal") else "N"}]}]
    }


def map_medication_to_fhir(med: Dict[str, Any], patient_id: int) -> Dict[str, Any]:
    return {
        "resourceType": "MedicationRequest",
        "id": f"MED-{med.get('id', 1)}",
        "status": "active" if med.get("is_current", True) else "stopped",
        "intent": "order",
        "medicationCodeableConcept": {"text": med.get("medication_name", "Medication")},
        "subject": {"reference": f"Patient/P-{patient_id}"},
        "authoredOn": str(med.get("prescribed_at", datetime.now(timezone.utc).isoformat())),
        "dosageInstruction": [{"text": f"{med.get('dosage', '')} {med.get('frequency', '')} ({med.get('route', 'Oral')})"}]
    }


def map_allergy_to_fhir(allergy: Dict[str, Any], patient_id: int) -> Dict[str, Any]:
    return {
        "resourceType": "AllergyIntolerance",
        "id": f"ALG-{allergy.get('id', 1)}",
        "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
        "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed"}]},
        "code": {"text": allergy.get("substance", "Allergen")},
        "criticality": "high" if allergy.get("severity") in ["SEVERE", "LIFE_THREATENING"] else "low",
        "patient": {"reference": f"Patient/P-{patient_id}"},
        "reaction": [{"manifestation": [{"text": allergy.get("reaction_type", "Adverse reaction")}]}]
    }


def create_fhir_transfer_bundle(patient_data: Dict[str, Any], transfer_meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export complete authorized clinical transfer dossier as an HL7 FHIR R4 Document Bundle.
    """
    patient_id = patient_data.get("id", 1)
    entries = []

    # Patient
    entries.append({"resource": map_patient_to_fhir(patient_data)})

    # Encounters
    for v in patient_data.get("visits", []):
        entries.append({"resource": map_encounter_to_fhir(v, patient_id)})
        for t in v.get("tests", []):
            entries.append({"resource": map_observation_to_fhir(t, patient_id, v.get("id"))})

    # Medications
    for m in patient_data.get("medications", []):
        entries.append({"resource": map_medication_to_fhir(m, patient_id)})

    # Allergies
    for a in patient_data.get("allergy_records", []):
        entries.append({"resource": map_allergy_to_fhir(a, patient_id)})

    return {
        "resourceType": "Bundle",
        "id": f"BUNDLE-{transfer_meta.get('transfer_code', 'TR-2026-0001')}",
        "type": "document",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": len(entries),
        "entry": entries
    }
