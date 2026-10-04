from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from .authorization import SecurityAuthorizationError, verify_role_permission

ALL_CLINICAL_CATEGORIES = [
    "Patient Demographics",
    "Emergency Contact",
    "Medical History",
    "Current Diagnosis",
    "Allergies",
    "Current Medications",
    "Previous Medications",
    "Laboratory Reports",
    "Diagnostic Reports",
    "Imaging Reports",
    "Clinical Notes",
    "Treatment History",
    "Discharge Summary",
    "Surgical History",
    "Doctor Transfer Summary"
]


def is_consent_valid(consent: Optional[Dict[str, Any]]) -> bool:
    """
    Check if consent record is in GRANTED status, not revoked, and unexpired.
    """
    if not consent:
        return False
    if str(consent.get("status", "")).upper() != "GRANTED":
        return False
    if consent.get("revoked_at"):
        return False

    expires_at = consent.get("expires_at")
    if expires_at:
        try:
            if isinstance(expires_at, str):
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            else:
                exp_dt = expires_at
            if exp_dt < datetime.now(exp_dt.tzinfo or timezone.utc):
                return False
        except Exception:
            pass

    return True


def filter_by_data_minimization(
    raw_patient_data: Dict[str, Any],
    permitted_categories: List[str]
) -> Dict[str, Any]:
    """
    Server-side Data Minimization Engine:
    Strips non-consented clinical attributes before passing payload to AI or client.
    """
    permitted_set = {str(c).strip().lower() for c in (permitted_categories or [])}

    # Always preserve internal ID and permitted category list
    projected = {
        "id": raw_patient_data.get("id"),
        "permitted_categories": list(permitted_categories or []),
        "representation": "FHIR-oriented prototype"
    }

    # Demographics
    if any(k in permitted_set for k in ["patient demographics", "demographics"]):
        projected["name"] = raw_patient_data.get("name")
        projected["unique_health_id"] = raw_patient_data.get("unique_health_id")
        projected["dob"] = raw_patient_data.get("dob")
        projected["gender"] = raw_patient_data.get("gender")
        projected["blood_group"] = raw_patient_data.get("blood_group")
        projected["phone"] = raw_patient_data.get("phone")

    # Emergency contact
    if any(k in permitted_set for k in ["emergency contact", "emergency_contact"]):
        projected["emergency_contact_name"] = raw_patient_data.get("emergency_contact_name")
        projected["emergency_contact_phone"] = raw_patient_data.get("emergency_contact_phone")

    # Medical history
    if any(k in permitted_set for k in ["medical history", "medical_history", "critical medical history"]):
        projected["medical_history"] = raw_patient_data.get("medical_history")

    # Allergies
    if any(k in permitted_set for k in ["allergies", "patient allergies", "allergy"]):
        projected["allergies"] = raw_patient_data.get("allergies")
        projected["allergy_records"] = raw_patient_data.get("allergy_records", [])

    # Medications
    allow_curr_meds = any(k in permitted_set for k in ["current medications", "medications", "current_medications"])
    allow_prev_meds = any(k in permitted_set for k in ["previous medications", "previous_medications"])
    if allow_curr_meds or allow_prev_meds:
        meds = raw_patient_data.get("medications", [])
        projected["medications"] = [
            m for m in meds
            if (allow_curr_meds and m.get("is_current", True)) or
               (allow_prev_meds and not m.get("is_current", True))
        ]

    # Visits & Encounters
    include_visits = any(k in permitted_set for k in [
        "current diagnosis", "laboratory reports", "diagnostic reports",
        "imaging reports", "clinical notes", "treatment history",
        "discharge summary", "surgical history", "recent laboratory reports"
    ])
    if include_visits:
        visits_out = []
        for v in raw_patient_data.get("visits", []):
            v_dict = {"id": v.get("id"), "admission_date": v.get("admission_date"), "status": v.get("status")}
            if any(k in permitted_set for k in ["current diagnosis", "diagnosis"]):
                v_dict["diagnosis"] = v.get("diagnosis")
                v_dict["chief_complaint"] = v.get("chief_complaint")
            if any(k in permitted_set for k in ["clinical notes", "treatment history"]):
                v_dict["clinical_notes"] = v.get("clinical_notes")
                v_dict["vitals"] = v.get("vitals", {})

            # Tests filter
            tests_out = []
            for t in v.get("tests", []):
                cat = str(t.get("category", "")).lower()
                is_lab = "lab" in cat
                is_img = any(x in cat for x in ["imag", "radio", "scan", "x-ray", "ultra"])
                is_diag = not is_lab

                if (is_lab and any(k in permitted_set for k in ["laboratory reports", "recent laboratory reports", "lab reports"])) or \
                   (is_img and any(k in permitted_set for k in ["imaging reports", "diagnostic reports"])) or \
                   (is_diag and any(k in permitted_set for k in ["diagnostic reports"])):
                    tests_out.append(t)
            if tests_out:
                v_dict["tests"] = tests_out

            visits_out.append(v_dict)
        projected["visits"] = visits_out

    # Documents filter
    if any(k in permitted_set for k in ["laboratory reports", "diagnostic reports", "imaging reports", "doctor transfer summary"]):
        docs_out = []
        for d in raw_patient_data.get("documents", []):
            dtype = str(d.get("document_type", "")).lower()
            if ("lab" in dtype and any(k in permitted_set for k in ["laboratory reports"])) or \
               ("diag" in dtype and any(k in permitted_set for k in ["diagnostic reports"])) or \
               ("summary" in dtype and any(k in permitted_set for k in ["doctor transfer summary", "transfer summary"])):
                docs_out.append(d)
        projected["documents"] = docs_out

    return projected


def authorize_ai_context(
    user: Dict[str, Any],
    raw_patient_data: Dict[str, Any],
    transfer: Optional[Dict[str, Any]] = None,
    consent: Optional[Dict[str, Any]] = None,
    emergency_session: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Enforce complete authorization, hospital relationship, and consent guard before AI processing.
    Never passes unauthorized or non-consented clinical attributes to AI models.
    """
    user_role = str(user.get("role", "")).upper()
    user_id = user.get("id")
    user_hosp = user.get("hospital_id")

    # Patient Self-Access
    if user_role == "PATIENT":
        if user.get("patient_id") and int(user.get("patient_id")) != int(raw_patient_data.get("id", -1)):
            raise SecurityAuthorizationError("Patients may only access their own clinical records.", 403)
        return filter_by_data_minimization(raw_patient_data, ALL_CLINICAL_CATEGORIES)

    # Doctor Verification
    verify_role_permission(user, ["DOCTOR"])

    # 1. Source Hospital Doctor (Referring)
    if transfer and user_hosp and int(user_hosp) == int(transfer.get("source_hospital_id", -1)):
        # Referring doctor has access to requested transfer data scope for transfer preparation
        permitted = transfer.get("requested_data") or ALL_CLINICAL_CATEGORIES
        return filter_by_data_minimization(raw_patient_data, permitted)

    # 2. Destination Hospital Doctor (Receiving)
    if transfer and user_hosp and int(user_hosp) == int(transfer.get("destination_hospital_id", -1)):
        # MUST have active GRANTED consent
        if not is_consent_valid(consent):
            raise SecurityAuthorizationError(
                "Access Denied: Receiving hospital cannot access clinical records without active GRANTED patient consent.",
                403
            )
        permitted = consent.get("data_categories") or transfer.get("requested_data") or []
        return filter_by_data_minimization(raw_patient_data, permitted)

    # 3. Break-Glass Emergency Session
    if emergency_session and str(emergency_session.get("status", "")).upper() == "ACTIVE":
        permitted = emergency_session.get("access_scope") or [
            "Allergies", "Current Medications", "Medical History", "Current Diagnosis", "Laboratory Reports"
        ]
        return filter_by_data_minimization(raw_patient_data, permitted)

    # 4. Local Care relationship without active transfer
    local_visits = [v for v in raw_patient_data.get("visits", []) if user_hosp and int(v.get("hospital_id", -1)) == int(user_hosp)]
    if local_visits and any(int(v.get("attending_doctor_id", -1)) == int(user_id) for v in local_visits):
        return filter_by_data_minimization(raw_patient_data, ALL_CLINICAL_CATEGORIES)

    # Default: Block unauthorized third parties
    raise SecurityAuthorizationError(
        "Access Denied: Doctor is not associated with patient's active care, active transfer, or emergency override.",
        403
    )
