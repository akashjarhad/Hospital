import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple

SECURITY_FEATURE_NAMES = [
    "patients_accessed_per_day",
    "records_accessed_per_day",
    "downloads_per_day",
    "unique_patients",
    "failed_authorizations",
    "emergency_access_count",
    "after_hours_access",
    "access_frequency_per_hour"
]

COMPLEXITY_FEATURE_NAMES = [
    "age",
    "active_condition_count",
    "medication_count",
    "recent_abnormal_result_count",
    "pending_investigation_count",
    "recent_procedure",
    "data_quality_issue_count",
    "transfer_priority"
]

PRIORITY_MAP = {
    "ROUTINE": 0,
    "URGENT": 1,
    "EMERGENCY": 2
}


def preprocess_security_record(record: Dict[str, Any]) -> np.ndarray:
    """
    Extract deterministic feature vector from a security log dictionary.
    """
    features = [
        float(record.get("patients_accessed_per_day", record.get("patient_record_accesses", 0))),
        float(record.get("records_accessed_per_day", record.get("records_accessed", 0))),
        float(record.get("downloads_per_day", record.get("downloads", 0))),
        float(record.get("unique_patients", record.get("patients_accessed_per_day", 0))),
        float(record.get("failed_authorizations", record.get("denied_attempts", 0))),
        float(record.get("emergency_access_count", record.get("emergency_events", 0))),
        float(record.get("after_hours_access", record.get("off_hours_events", 0))),
        float(record.get("access_frequency_per_hour", record.get("access_frequency", 1.0)))
    ]
    return np.array(features, dtype=np.float32).reshape(1, -1)


def preprocess_complexity_record(
    patient_data: Dict[str, Any],
    transfer_meta: Dict[str, Any],
    dq_issues_count: int = 0
) -> np.ndarray:
    """
    Extract deterministic feature vector for transfer complexity classification.
    """
    # 1. Age
    dob = patient_data.get("dob", "")
    age = 50  # default
    if dob:
        try:
            year = int(str(dob)[:4])
            age = max(0, 2026 - year)
        except Exception:
            age = 50

    # 2. Active conditions
    visits = patient_data.get("visits", [])
    active_conditions = len([v for v in visits if v.get("status") in ["admitted", "critical", "observation"]])
    if not active_conditions and visits:
        active_conditions = 1

    # 3. Medications
    meds = patient_data.get("medications", [])
    current_meds = len([m for m in meds if m.get("is_current", True)])

    # 4. Recent abnormal results
    tests = [t for v in visits for t in v.get("tests", [])]
    abnormal_results = len([t for t in tests if t.get("abnormal")])

    # 5. Pending investigations
    pending_inv = 1 if any("pending" in str(v.get("clinical_notes", "")).lower() for v in visits) else 0

    # 6. Recent procedure
    recent_proc = 1 if any(
        any(kw in f"{v.get('diagnosis', '')} {v.get('clinical_notes', '')}".lower()
            for kw in ["surgery", "procedure", "pci", "catheterization", "operation", "intubation"])
        for v in visits
    ) else 0

    # 7. Priority
    priority_str = str(transfer_meta.get("clinical_priority", "URGENT")).upper()
    priority = PRIORITY_MAP.get(priority_str, 1)

    features = [
        float(age),
        float(active_conditions),
        float(current_meds),
        float(abnormal_results),
        float(pending_inv),
        float(recent_proc),
        float(dq_issues_count),
        float(priority)
    ]
    return np.array(features, dtype=np.float32).reshape(1, -1)
