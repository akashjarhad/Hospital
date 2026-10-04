import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_ML_DIR = os.path.dirname(CURR_DIR)
DATASET_PATH = os.path.join(BASE_ML_DIR, "datasets", "security_logs.csv")
MODELS_DIR = os.path.join(BASE_ML_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def train_anomaly_detection_model():
    print("[INFO] Loading dataset from:", DATASET_PATH)
    df = pd.read_csv(DATASET_PATH)

    feature_cols = [
        "patients_accessed_per_day",
        "records_accessed_per_day",
        "downloads_per_day",
        "unique_patients",
        "failed_authorizations",
        "emergency_access_count",
        "after_hours_access",
        "access_frequency_per_hour"
    ]

    X = df[feature_cols].values
    y_true = df["is_anomalous"].values  # 0 = normal, 1 = anomaly

    # Fit IsolationForest (unsupervised anomaly detection)
    contamination = 0.15
    model = IsolationForest(
        n_estimators=150,
        contamination=contamination,
        random_state=42,
        max_samples="auto"
    )
    model.fit(X)

    # In IsolationForest: -1 is anomaly, 1 is normal
    raw_preds = model.predict(X)
    y_pred = np.where(raw_preds == -1, 1, 0)

    # Anomaly decision function scores (lower = more anomalous)
    scores = -model.decision_function(X)

    # Calculate metrics
    cm = confusion_matrix(y_true, y_pred).tolist()
    report = classification_report(y_true, y_pred, output_dict=True)
    auc = float(roc_auc_score(y_true, scores))

    print(f"[METRIC] IsolationForest ROC-AUC: {auc:.4f}")
    print(f"[METRIC] Anomaly Detection Precision: {report['1']['precision']:.4f}")
    print(f"[METRIC] Anomaly Detection Recall: {report['1']['recall']:.4f}")
    print(f"[METRIC] Anomaly Detection F1-Score: {report['1']['f1-score']:.4f}")

    # Save model artifact
    model_path = os.path.join(MODELS_DIR, "anomaly_isolation_forest.joblib")
    joblib.dump(model, model_path)
    print("[OK] Saved IsolationForest model to:", model_path)

    # Update metadata
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    metadata = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception:
            metadata = {}

    metadata["anomaly_model"] = {
        "model_type": "IsolationForest",
        "version": "1.0.0",
        "features": feature_cols,
        "contamination": contamination,
        "n_samples": len(df),
        "roc_auc": round(auc, 4),
        "precision": round(report['1']['precision'], 4),
        "recall": round(report['1']['recall'], 4),
        "f1_score": round(report['1']['f1-score'], 4),
        "confusion_matrix": cm,
        "safety_wording": "Potentially anomalous activity detected. Review suggested; does not accuse or auto-block users."
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("[OK] Updated model metadata in:", meta_path)

    return metadata["anomaly_model"]


if __name__ == "__main__":
    train_anomaly_detection_model()
