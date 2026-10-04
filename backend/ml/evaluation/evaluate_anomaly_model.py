import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_ML_DIR = os.path.dirname(CURR_DIR)
DATASET_PATH = os.path.join(BASE_ML_DIR, "datasets", "security_logs.csv")
MODEL_PATH = os.path.join(BASE_ML_DIR, "models", "anomaly_isolation_forest.joblib")


def evaluate_anomaly_model():
    if not os.path.exists(MODEL_PATH):
        from ..training.train_anomaly_model import train_anomaly_detection_model
        train_anomaly_detection_model()

    model = joblib.load(MODEL_PATH)
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
    y_true = df["is_anomalous"].values

    raw_preds = model.predict(X)
    y_pred = np.where(raw_preds == -1, 1, 0)
    scores = -model.decision_function(X)

    cm = confusion_matrix(y_true, y_pred).tolist()
    report = classification_report(y_true, y_pred, output_dict=True)
    auc = float(roc_auc_score(y_true, scores))

    results = {
        "model": "IsolationForest Anomaly Detector",
        "dataset_size": len(df),
        "roc_auc": round(auc, 4),
        "precision": round(report['1']['precision'], 4),
        "recall": round(report['1']['recall'], 4),
        "f1_score": round(report['1']['f1-score'], 4),
        "false_positive_rate": round(cm[0][1] / (cm[0][0] + cm[0][1]), 4) if (cm[0][0] + cm[0][1]) > 0 else 0.0,
        "detection_rate": round(cm[1][1] / (cm[1][0] + cm[1][1]), 4) if (cm[1][0] + cm[1][1]) > 0 else 0.0,
        "confusion_matrix": cm
    }

    print("[EVALUATION RESULTS - SECURITY ANOMALY ML]")
    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    evaluate_anomaly_model()
