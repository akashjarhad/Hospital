"""
Main CLI entrypoint for ML evaluation package: python -m ml.evaluation
Evaluates both the IsolationForest security anomaly detector and the RandomForest transfer complexity model.
"""

import sys
import json
from .evaluate_anomaly_model import evaluate_anomaly_model
from .evaluate_complexity_model import evaluate_complexity_model


def main():
    print("=" * 70)
    print("MedTransfer Machine Learning Evaluation Suite")
    print("=" * 70)
    
    print("\n[1/2] Evaluating Security Anomaly Detection (Isolation Forest)...")
    anomaly_results = evaluate_anomaly_model()
    
    print("\n[2/2] Evaluating Transfer Complexity Classifier (Random Forest vs Baseline)...")
    complexity_results = evaluate_complexity_model()
    
    print("\n" + "=" * 70)
    print("[OK] All MedTransfer ML Models Evaluated Successfully")
    print("=" * 70)
    
    summary = {
        "status": "SUCCESS",
        "models_evaluated": 2,
        "anomaly_detection": {
            "roc_auc": anomaly_results.get("roc_auc"),
            "f1_score": anomaly_results.get("f1_score"),
            "detection_rate": anomaly_results.get("detection_rate")
        },
        "transfer_complexity": {
            "proposed_accuracy": complexity_results.get("proposed_random_forest", {}).get("accuracy"),
            "proposed_macro_f1": complexity_results.get("proposed_random_forest", {}).get("f1_macro"),
            "baseline_macro_f1": complexity_results.get("baseline_decision_tree", {}).get("f1_macro"),
            "relative_improvement_f1_pct": complexity_results.get("relative_improvement_f1_pct")
        }
    }
    
    print("\n[SUMMARY METRICS]")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
