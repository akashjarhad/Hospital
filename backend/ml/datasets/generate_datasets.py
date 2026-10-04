import os
import csv
import random

random.seed(42)

DATASETS_DIR = os.path.dirname(os.path.abspath(__file__))


def generate_security_logs_dataset(filename="security_logs.csv", num_samples=600):
    filepath = os.path.join(DATASETS_DIR, filename)
    headers = [
        "actor_id",
        "patients_accessed_per_day",
        "records_accessed_per_day",
        "downloads_per_day",
        "unique_patients",
        "failed_authorizations",
        "emergency_access_count",
        "after_hours_access",
        "access_frequency_per_hour",
        "is_anomalous"
    ]

    rows = []
    # 85% normal samples, 15% anomalous samples
    for i in range(num_samples):
        actor_id = (i % 25) + 1
        is_anomaly = 1 if i % 7 == 0 else 0

        if not is_anomaly:
            # Normal clinical staff behavior
            patients_accessed = random.randint(3, 18)
            records_accessed = patients_accessed * random.randint(2, 6)
            downloads = random.randint(0, 3)
            unique_patients = min(patients_accessed, random.randint(3, 15))
            failed_auths = 0 if random.random() > 0.12 else random.randint(1, 2)
            emergency_access = 0 if random.random() > 0.15 else random.randint(1, 2)
            after_hours = 0 if random.random() > 0.20 else random.randint(1, 3)
            access_freq = round(random.uniform(0.5, 4.0), 2)
        else:
            # Anomalous patterns (bulk downloading, off-hours credential misuse, high failed auths)
            anomaly_type = random.choice(["bulk_download", "failed_burst", "mass_scrape", "off_hours_spike"])
            if anomaly_type == "bulk_download":
                patients_accessed = random.randint(25, 80)
                records_accessed = random.randint(120, 450)
                downloads = random.randint(15, 60)
                unique_patients = random.randint(20, 75)
                failed_auths = random.randint(0, 3)
                emergency_access = random.randint(0, 1)
                after_hours = random.randint(2, 10)
                access_freq = round(random.uniform(12.0, 35.0), 2)
            elif anomaly_type == "failed_burst":
                patients_accessed = random.randint(1, 5)
                records_accessed = random.randint(2, 10)
                downloads = 0
                unique_patients = random.randint(1, 4)
                failed_auths = random.randint(8, 25)
                emergency_access = random.randint(0, 1)
                after_hours = random.randint(4, 15)
                access_freq = round(random.uniform(8.0, 20.0), 2)
            elif anomaly_type == "mass_scrape":
                patients_accessed = random.randint(50, 150)
                records_accessed = random.randint(200, 600)
                downloads = random.randint(8, 30)
                unique_patients = random.randint(45, 140)
                failed_auths = random.randint(1, 5)
                emergency_access = random.randint(3, 8)
                after_hours = random.randint(10, 28)
                access_freq = round(random.uniform(20.0, 50.0), 2)
            else: # off_hours_spike
                patients_accessed = random.randint(15, 40)
                records_accessed = random.randint(50, 180)
                downloads = random.randint(5, 20)
                unique_patients = random.randint(12, 35)
                failed_auths = random.randint(2, 6)
                emergency_access = random.randint(2, 5)
                after_hours = random.randint(18, 45)
                access_freq = round(random.uniform(10.0, 25.0), 2)

        rows.append([
            actor_id,
            patients_accessed,
            records_accessed,
            downloads,
            unique_patients,
            failed_auths,
            emergency_access,
            after_hours,
            access_freq,
            is_anomaly
        ])

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"[OK] Generated {len(rows)} synthetic security logs in {filepath}")


def generate_transfer_complexity_dataset(filename="transfer_complexity.csv", num_samples=800):
    filepath = os.path.join(DATASETS_DIR, filename)
    headers = [
        "age",
        "active_condition_count",
        "medication_count",
        "recent_abnormal_result_count",
        "pending_investigation_count",
        "recent_procedure",
        "data_quality_issue_count",
        "transfer_priority",  # ROUTINE=0, URGENT=1, EMERGENCY=2
        "complexity_level"    # LOW, MODERATE, HIGH
    ]

    rows = []
    for _ in range(num_samples):
        age = random.randint(18, 88)
        priority = random.choice([0, 1, 2])  # 0: ROUTINE, 1: URGENT, 2: EMERGENCY

        # Correlated feature distribution
        if priority == 2:  # EMERGENCY
            active_conditions = random.randint(2, 6)
            medications = random.randint(3, 12)
            abnormal_results = random.randint(2, 8)
            pending_inv = random.randint(1, 4)
            recent_proc = 1 if random.random() > 0.3 else 0
            dq_issues = random.randint(0, 3)
        elif priority == 1:  # URGENT
            active_conditions = random.randint(1, 4)
            medications = random.randint(2, 8)
            abnormal_results = random.randint(1, 5)
            pending_inv = random.randint(0, 3)
            recent_proc = 1 if random.random() > 0.6 else 0
            dq_issues = random.randint(0, 2)
        else:  # ROUTINE
            active_conditions = random.randint(0, 2)
            medications = random.randint(0, 4)
            abnormal_results = random.randint(0, 2)
            pending_inv = random.randint(0, 1)
            recent_proc = 1 if random.random() > 0.85 else 0
            dq_issues = random.randint(0, 1)

        # Calculate clinical workflow complexity score
        score = (
            (active_conditions * 1.5) +
            (medications * 0.8) +
            (abnormal_results * 1.8) +
            (pending_inv * 1.2) +
            (recent_proc * 2.5) +
            (priority * 2.0) +
            (dq_issues * 0.5) +
            (1.0 if age > 65 else 0.0)
        )

        if score >= 11.0:
            complexity = "HIGH"
        elif score >= 5.5:
            complexity = "MODERATE"
        else:
            complexity = "LOW"

        rows.append([
            age,
            active_conditions,
            medications,
            abnormal_results,
            pending_inv,
            recent_proc,
            dq_issues,
            priority,
            complexity
        ])

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"[OK] Generated {len(rows)} synthetic transfer complexity records in {filepath}")


if __name__ == "__main__":
    generate_security_logs_dataset()
    generate_transfer_complexity_dataset()
