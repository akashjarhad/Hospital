import numpy as np
from typing import Dict, Any, List
from .model_loader import model_manager
from .preprocessing import preprocess_security_record, SECURITY_FEATURE_NAMES


def detect_security_anomalies(actor_logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    ML-driven security anomaly detection using IsolationForest and explainable behavioral feature distance.
    """
    model = model_manager.get_anomaly_model()
    anomalies = []

    for actor in actor_logs:
        features = actor.get("features", {})
        X = preprocess_security_record(features)

        # 1. Model inference
        if model is not None:
            raw_pred = model.predict(X)[0]  # -1 = anomaly, 1 = normal
            # decision_function gives signed distance to separating hyperplane (negative = anomaly)
            decision_score = float(model.decision_function(X)[0])
            is_anomaly = (raw_pred == -1) or (decision_score < -0.05)
            # Normalize score to a 0.0 - 10.0 scale
            anomaly_score = round(max(0.0, min(10.0, (-decision_score + 0.15) * 12.0)), 2)
        else:
            # Fallback heuristic
            failed = float(features.get("failed_authorizations", 0))
            downloads = float(features.get("downloads_per_day", 0))
            off_hours = float(features.get("after_hours_access", 0))
            anomaly_score = round(failed * 1.5 + downloads * 0.4 + off_hours * 0.3, 2)
            is_anomaly = anomaly_score >= 3.5

        if is_anomaly or anomaly_score >= 3.0:
            severity = "HIGH" if anomaly_score >= 6.5 else ("MODERATE" if anomaly_score >= 4.0 else "LOW")
            
            # Identify top contributing features
            top_factors = []
            if features.get("failed_authorizations", 0) > 2:
                top_factors.append(f"Elevated failed authorizations ({features.get('failed_authorizations')})")
            if features.get("downloads_per_day", 0) > 5:
                top_factors.append(f"High clinical record download volume ({features.get('downloads_per_day')}/day)")
            if features.get("after_hours_access", 0) > 3:
                top_factors.append(f"Unusual after-hours access frequency ({features.get('after_hours_access')} events)")
            if features.get("patients_accessed_per_day", 0) > 20:
                top_factors.append(f"Atypical patient roster volume ({features.get('patients_accessed_per_day')} patients)")

            explanation = (
                f"Potentially anomalous activity detected (Anomaly Score: {anomaly_score:.2f}, Severity: {severity}). "
                f"Contributing behavioral features: {', '.join(top_factors) if top_factors else 'Multi-feature deviation from peer baseline'}. "
                f"Review suggested as part of prototype security monitoring; this model does not establish user culpability."
            )

            anomalies.append({
                "actor_id": actor.get("actor_id"),
                "hospital_id": actor.get("hospital_id"),
                "score": anomaly_score,
                "severity": severity,
                "explanation": explanation,
                "features": features,
                "review_status": "OPEN",
                "model_version": "IsolationForest-1.0.0"
            })

    return anomalies
