"""Egitim script'i.

Calistirma:
    uv run python train.py

Bolme stratejisi (veri sizintisina karsi):
  * Birincil: **musteri-grubu holdout** (%70/%15/%15) — ayni `customer_id` asla
    hem train hem test'e dusmez. Model kaydedilen artifact bu bolme ile egitilir.
  * Ikincil (denetim): **zaman bazli holdout** — ilk %70 zaman train, son %15
    test. Metrikler `metadata.json > riskModel.metrics.timeHoldout` altinda
    raporlanir; boylece zamansal sizinti olmadigi gosterilir.

Kalibrasyon yontemi (isotonic vs sigmoid) egitim setindeki FRAUD ornek sayisina
gore secilir: <1000 fraud ise isotonic asiri ogrenmeye egilimli oldugundan
sigmoid'e dusulur (sklearn dokumantasyonu). Secim metadata'ya yazilir.

Cikti: models/risk_model.joblib, models/fraud_type_model.joblib, models/metadata.json.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupShuffleSplit

sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings  # noqa: E402
from app.ml.schema import FEATURE_COLUMNS, RANDOM_SEED  # noqa: E402

ARTIFACT_DIR = Path(__file__).parent / settings.model.artifact_dir
DATA_DIR = Path(__file__).parent / "data"

FRAUD_ONLY_CLASSES = ["CALINTI_KART", "HESAP_ELE_GECIRME", "PARA_AKLAMA", "SUPHELI_DAVRANIS"]
ISOTONIC_MIN_FRAUD = 1000  # bu sayinin altinda isotonic yerine sigmoid


def sha256_of_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _group_holdout(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """customer_id bazli %70/%15/%15 train/val/test indeksleri (musteri kesisimi yok)."""
    groups = df["customer_id"].to_numpy()
    idx = np.arange(len(df))

    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=RANDOM_SEED)
    train_idx, temp_idx = next(gss1.split(idx, groups=groups))

    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=RANDOM_SEED)
    temp_local = np.arange(len(temp_idx))
    val_local, test_local = next(gss2.split(temp_local, groups=groups[temp_idx]))
    return train_idx, temp_idx[val_local], temp_idx[test_local]


# Metrikler operasyonel "incele" kapisinda raporlanir: risk >= 0.40 -> INCELEME/BLOK
# (decision_policy.py). Bu, standart 0.5 esiginden daha faithful bir operasyon noktasidir.
OPERATING_THRESHOLD = 0.40


def _binary_metrics(y_true: np.ndarray, proba: np.ndarray, threshold: float = OPERATING_THRESHOLD) -> dict:
    pred = (proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    fpr = float(fp / (fp + tn)) if (fp + tn) else 0.0
    return {
        "threshold": threshold,
        "prAuc": float(average_precision_score(y_true, proba)),  # esikten bagimsiz headline
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        "falsePositiveRate": fpr,
        "balancedAccuracy": float(balanced_accuracy_score(y_true, pred)),
        "brierScore": float(brier_score_loss(y_true, proba)),
        "confusionMatrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def _fit_risk_model(x_train: np.ndarray, y_train: np.ndarray, method: str) -> CalibratedClassifierCV:
    base = HistGradientBoostingClassifier(random_state=RANDOM_SEED, max_iter=200)
    model = CalibratedClassifierCV(base, method=method, cv=3)
    model.fit(x_train, y_train)
    return model


def _score_scenarios(risk_model: CalibratedClassifierCV, fraud_type_model: RandomForestClassifier) -> dict:
    """Scores the hand-written Turkish scenarios (app/ml/scenarios.py), which the model never saw."""
    scenarios = pd.read_csv(DATA_DIR / "scenarios_tr.csv")
    x = scenarios[FEATURE_COLUMNS].to_numpy(dtype=float)
    flagged = risk_model.predict_proba(x)[:, 1] >= OPERATING_THRESHOLD
    is_fraud = scenarios["is_fraud"].to_numpy(dtype=bool)

    fraud = scenarios[is_fraud]
    predicted_type = fraud_type_model.predict(fraud[FEATURE_COLUMNS].to_numpy(dtype=float))
    by_type = {
        str(t): round(float((predicted_type[(fraud["fraud_type"] == t).to_numpy()] == t).mean()), 4)
        for t in FRAUD_ONLY_CLASSES
    }
    return {
        "scenarioCount": int(len(scenarios)),
        "fraudFlaggedRate": round(float(flagged[is_fraud].mean()), 4),
        "legitimatePassedRate": round(float((~flagged[~is_fraud]).mean()), 4),
        "fraudTypeAccuracy": round(float((predicted_type == fraud["fraud_type"].to_numpy()).mean()), 4),
        "fraudTypeAccuracyByType": by_type,
    }


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # The data is committed (generate_data.py writes it), so training reads the file.
    dataset_path = DATA_DIR / "training_data.csv"
    print(f"[1/6] Egitim verisi okunuyor: {dataset_path}")
    df = pd.read_csv(dataset_path)
    data_checksum = sha256_of_file(dataset_path)

    fraud_rate = float(df["is_fraud"].mean())
    print(f"Fraud prevalansi: {fraud_rate:.3f}")
    print("Sinif dagilimi:")
    print(df["fraud_type"].value_counts(normalize=True).round(4))

    x_all = df[FEATURE_COLUMNS].to_numpy(dtype=float)
    yb_all = df["is_fraud"].to_numpy(dtype=int)
    yt_all = df["fraud_type"].to_numpy()

    # --- Birincil bolme: musteri-grubu holdout ---
    train_idx, val_idx, test_idx = _group_holdout(df)

    train_customers = set(df.iloc[train_idx]["customer_id"])
    test_customers = set(df.iloc[test_idx]["customer_id"])
    customer_overlap = train_customers & test_customers
    print(f"[leakage-check] train/test kesisen MUSTERI sayisi: {len(customer_overlap)} (beklenen: 0)")

    x_train, yb_train = x_all[train_idx], yb_all[train_idx]
    x_val, yb_val = x_all[val_idx], yb_all[val_idx]
    x_test, yb_test = x_all[test_idx], yb_all[test_idx]

    train_fraud_count = int(yb_train.sum())
    calibration_method = "isotonic" if train_fraud_count >= ISOTONIC_MIN_FRAUD else "sigmoid"
    print(
        f"[2/6] Risk modeli: HistGradientBoosting + Calibrated({calibration_method}) "
        f"(train fraud={train_fraud_count}, esik={ISOTONIC_MIN_FRAUD})..."
    )
    risk_model = _fit_risk_model(x_train, yb_train, calibration_method)

    risk_val_metrics = _binary_metrics(yb_val, risk_model.predict_proba(x_val)[:, 1])
    risk_test_metrics = _binary_metrics(yb_test, risk_model.predict_proba(x_test)[:, 1])
    print("Risk modeli TEST (group holdout):", {k: round(v, 4) for k, v in risk_test_metrics.items() if isinstance(v, float)})

    # --- Ikincil bolme: zaman bazli holdout (denetim raporu) ---
    print("[3/6] Zaman bazli holdout degerlendirmesi...")
    order = np.argsort(df["occurred_at"].to_numpy())
    n = len(order)
    t_train = order[: int(n * 0.70)]
    t_test = order[int(n * 0.85):]
    time_model = _fit_risk_model(x_all[t_train], yb_all[t_train], calibration_method)
    time_holdout_metrics = _binary_metrics(yb_all[t_test], time_model.predict_proba(x_all[t_test])[:, 1])
    print("Risk modeli TEST (time holdout):", {k: round(v, 4) for k, v in time_holdout_metrics.items() if isinstance(v, float)})

    # --- Fraud-tur modeli: YALNIZCA fraud satirlari (4 sinif); TEMIZ karari risk modeline birakilir ---
    print("[4/6] Fraud-tur modeli: RandomForest (yalnizca 4 fraud sinifi)...")
    fraud_train_mask = yb_train == 1
    fraud_test_mask = yb_test == 1
    xt_train, ytt_train = x_train[fraud_train_mask], yt_all[train_idx][fraud_train_mask]
    xt_test, ytt_test = x_test[fraud_test_mask], yt_all[test_idx][fraud_test_mask]

    fraud_type_model = RandomForestClassifier(
        n_estimators=300, max_depth=12, random_state=RANDOM_SEED, class_weight="balanced", n_jobs=-1
    )
    fraud_type_model.fit(xt_train, ytt_train)

    ytt_pred = fraud_type_model.predict(xt_test)
    fraud_type_report = classification_report(
        ytt_test, ytt_pred, labels=FRAUD_ONLY_CLASSES, output_dict=True, zero_division=0
    )
    macro_f1 = float(fraud_type_report["macro avg"]["f1-score"])
    print(f"Fraud-tur Macro F1 (test): {macro_f1:.4f}")
    print(classification_report(ytt_test, ytt_pred, labels=FRAUD_ONLY_CLASSES, zero_division=0))

    scenario_metrics = _score_scenarios(risk_model, fraud_type_model)
    print("Turkce senaryolar (egitimde kullanilmadi):", scenario_metrics)

    print("[5/6] Model artifact'lari kaydediliyor...")
    risk_model_path = ARTIFACT_DIR / "risk_model.joblib"
    fraud_type_model_path = ARTIFACT_DIR / "fraud_type_model.joblib"
    joblib.dump(risk_model, risk_model_path)
    joblib.dump(fraud_type_model, fraud_type_model_path)

    metadata = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "randomSeed": RANDOM_SEED,
        "datasetVersion": "synthetic-tr-v2-overlap",
        "datasetChecksum": data_checksum,
        "datasetRecordCount": int(len(df)),
        "fraudPrevalence": round(fraud_rate, 4),
        "classDistribution": {str(k): int(v) for k, v in df["fraud_type"].value_counts().items()},
        "splitStrategy": "customer-group-holdout(primary)+time-holdout(audit)",
        "split": {"train": int(len(train_idx)), "validation": int(len(val_idx)), "test": int(len(test_idx))},
        "customerOverlapCount": len(customer_overlap),
        "riskModel": {
            "version": "risk-2.0.0",
            "algorithm": f"HistGradientBoostingClassifier+CalibratedClassifierCV({calibration_method})",
            "calibrationMethod": calibration_method,
            "trainFraudCount": train_fraud_count,
            "artifactPath": str(risk_model_path.name),
            "artifactSha256": sha256_of_file(risk_model_path),
            "metrics": {
                "validation": risk_val_metrics,
                "test": risk_test_metrics,
                "timeHoldout": time_holdout_metrics,
            },
        },
        "fraudTypeModel": {
            "version": "fraud-type-2.0.0",
            "algorithm": "RandomForestClassifier",
            "trainedClasses": FRAUD_ONLY_CLASSES,
            "note": "TEMIZ karari risk modeline birakilir; bu model yalnizca fraud turunu ayirir.",
            "artifactPath": str(fraud_type_model_path.name),
            "artifactSha256": sha256_of_file(fraud_type_model_path),
            "metrics": {"test": fraud_type_report, "macroF1": macro_f1},
        },
        "scenarioAcceptance": scenario_metrics,
        "bundleVersion": settings.model.bundle_version,
        "featureColumns": FEATURE_COLUMNS,
    }

    metadata_path = ARTIFACT_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[6/6] Tamamlandi. Artifact'lar: {ARTIFACT_DIR}")
    print(f"Model metadata: {metadata_path}")


if __name__ == "__main__":
    main()
