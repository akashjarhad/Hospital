import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

CURR_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_ML_DIR = os.path.dirname(CURR_DIR)
DATASET_PATH = os.path.join(BASE_ML_DIR, "datasets", "transfer_complexity.csv")
MODELS_DIR = os.path.join(BASE_ML_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def train_transfer_complexity_models():
    print("[INFO] Loading dataset from:", DATASET_PATH)
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

    X = np.asarray(df[feature_cols].values, dtype=np.float32)
    y = np.asarray(df["complexity_level"].values, dtype=object)
    target_names = ["LOW", "MODERATE", "HIGH"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 1. Baseline Model: Single Decision Tree
    baseline_model = DecisionTreeClassifier(max_depth=4, random_state=42)
    baseline_model.fit(X_train, y_train)
    baseline_preds = baseline_model.predict(X_test)
    baseline_acc = float(accuracy_score(y_test, baseline_preds))
    baseline_report = classification_report(y_test, baseline_preds, target_names=target_names, output_dict=True)

    print(f"[BASELINE] DecisionTree Accuracy: {baseline_acc:.4f}, Macro-F1: {baseline_report['macro avg']['f1-score']:.4f}")

    # 2. Proposed Model: Random Forest Classifier
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=4,
        random_state=42
    )
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)
    rf_acc = float(accuracy_score(y_test, rf_preds))
    rf_report = classification_report(y_test, rf_preds, target_names=target_names, output_dict=True)
    rf_cm = confusion_matrix(y_test, rf_preds, labels=target_names).tolist()

    print(f"[PROPOSED] RandomForest Accuracy: {rf_acc:.4f}, Macro-F1: {rf_report['macro avg']['f1-score']:.4f}")

    # Feature importances
    feature_importances = {
        name: round(float(imp), 4)
        for name, imp in zip(feature_cols, rf_model.feature_importances_)
    }

    # Save models
    rf_path = os.path.join(MODELS_DIR, "transfer_complexity_rf.joblib")
    baseline_path = os.path.join(MODELS_DIR, "transfer_complexity_baseline.joblib")
    joblib.dump(rf_model, rf_path)
    joblib.dump(baseline_model, baseline_path)
    print("[OK] Saved RandomForest model to:", rf_path)
    print("[OK] Saved Baseline DecisionTree model to:", baseline_path)

    # Update metadata
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    metadata = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception:
            metadata = {}

    metadata["transfer_complexity_model"] = {
        "model_type": "RandomForestClassifier",
        "baseline_type": "DecisionTreeClassifier",
        "version": "1.0.0",
        "features": feature_cols,
        "classes": target_names,
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "proposed_metrics": {
            "accuracy": round(rf_acc, 4),
            "precision_macro": round(rf_report['macro avg']['precision'], 4),
            "recall_macro": round(rf_report['macro avg']['recall'], 4),
            "f1_macro": round(rf_report['macro avg']['f1-score'], 4),
            "confusion_matrix": rf_cm
        },
        "baseline_metrics": {
            "accuracy": round(baseline_acc, 4),
            "precision_macro": round(baseline_report['macro avg']['precision'], 4),
            "recall_macro": round(baseline_report['macro avg']['recall'], 4),
            "f1_macro": round(baseline_report['macro avg']['f1-score'], 4)
        },
        "feature_importances": feature_importances,
        "clinical_disclaimer": "Research prototype — workflow complexity assistance only. NOT a clinical diagnostic or mortality risk score."
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("[OK] Updated model metadata in:", meta_path)

    return metadata["transfer_complexity_model"]


if __name__ == "__main__":
    train_transfer_complexity_models()
