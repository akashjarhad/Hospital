import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_ML_DIR = os.path.dirname(CURR_DIR)
DATASET_PATH = os.path.join(BASE_ML_DIR, "datasets", "transfer_complexity.csv")
MODEL_PATH = os.path.join(BASE_ML_DIR, "models", "transfer_complexity_rf.joblib")
BASELINE_PATH = os.path.join(BASE_ML_DIR, "models", "transfer_complexity_baseline.joblib")


def evaluate_complexity_model():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(BASELINE_PATH):
        from ..training.train_complexity_model import train_transfer_complexity_models
        train_transfer_complexity_models()

    rf_model = joblib.load(MODEL_PATH)
    baseline_model = joblib.load(BASELINE_PATH)
    df = pd.read_csv(DATASET_PATH)

    feature_cols = [
        "age",
        "active_condition_count",
        "medication_count",
        "recent_abnormal_result_count",
        "pending_investigation_count",
        "recent_procedure",
        "data_quality_issue_count",
        "transfer_priority"
    ]
    target_names = ["LOW", "MODERATE", "HIGH"]

    X = np.asarray(df[feature_cols].values, dtype=np.float32)
    y = np.asarray(df["complexity_level"].values, dtype=object)

    # Proposed model evaluation
    rf_preds = rf_model.predict(X)
    rf_acc = float(accuracy_score(y, rf_preds))
    rf_report = classification_report(y, rf_preds, target_names=target_names, output_dict=True)
    rf_cm = confusion_matrix(y, rf_preds, labels=target_names).tolist()

    # Baseline model evaluation
    baseline_preds = baseline_model.predict(X)
    baseline_acc = float(accuracy_score(y, baseline_preds))
    baseline_report = classification_report(y, baseline_preds, target_names=target_names, output_dict=True)
    baseline_cm = confusion_matrix(y, baseline_preds, labels=target_names).tolist()

    results = {
        "dataset_size": len(df),
        "proposed_random_forest": {
            "accuracy": round(rf_acc, 4),
            "precision_macro": round(rf_report['macro avg']['precision'], 4),
            "recall_macro": round(rf_report['macro avg']['recall'], 4),
            "f1_macro": round(rf_report['macro avg']['f1-score'], 4),
            "per_class": {
                c: {
                    "precision": round(rf_report[c]['precision'], 4),
                    "recall": round(rf_report[c]['recall'], 4),
                    "f1_score": round(rf_report[c]['f1-score'], 4)
                } for c in target_names
            },
            "confusion_matrix": rf_cm
        },
        "baseline_decision_tree": {
            "accuracy": round(baseline_acc, 4),
            "precision_macro": round(baseline_report['macro avg']['precision'], 4),
            "recall_macro": round(baseline_report['macro avg']['recall'], 4),
            "f1_macro": round(baseline_report['macro avg']['f1-score'], 4),
            "confusion_matrix": baseline_cm
        },
        "relative_improvement_f1_pct": round(((rf_report['macro avg']['f1-score'] - baseline_report['macro avg']['f1-score']) / max(0.01, baseline_report['macro avg']['f1-score'])) * 100, 2)
    }

    print("[EVALUATION RESULTS - TRANSFER COMPLEXITY ML]")
    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    evaluate_complexity_model()
