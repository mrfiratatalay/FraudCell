# FraudCell AI model card

Two scikit-learn models score every new transaction (case §5.1, §5.2). They are retrained from the committed data each time the Docker image is built.

## Data

- **Training data:** [`data/training_data.csv`](data/training_data.csv). 10,000 synthetic Turkish card and wallet transactions from [`app/ml/synthetic_data.py`](app/ml/synthetic_data.py), using seed `20260722` and about 1,250 simulated customers.
- **How labels are made:** Each transaction comes from an archetype: legitimate, stolen card, account takeover, money laundering or suspicious behaviour. The fraud label is then sampled from a logistic function of its features, so the classes overlap and the metrics are not inflated.
- **Class mix:** fraud prevalence 11.0%. TEMIZ 8,897, CALINTI_KART 441, SUPHELI_DAVRANIS 404, HESAP_ELE_GECIRME 184, PARA_AKLAMA 74.
- **Turkish scenarios:** [`data/scenarios_tr.csv`](data/scenarios_tr.csv). 120 hand-written examples (24 templates × 5 variations), such as *"Gece yarisi yurt disindan, yeni cihazla art arda yuksek tutarli kart odemeleri"* and *"Her ay tekrarlayan duzenli elektrik faturasi odemesi"*. They are **not** used for training; they are an independent acceptance set.
- **Regenerating:** `uv run --group training python generate_data.py` rebuilds both files. A test checks that the committed files match the generator byte for byte.

## Features

These are the 15 columns in [`app/ml/schema.py`](app/ml/schema.py), built at scoring time by [`app/ml/features.py`](app/ml/features.py):

- **Amount:** the amount, and how far it deviates from the customer's average.
- **Time:** hour, and night (23:00–06:00, **Istanbul time**).
- **Location and novelty:** foreign country, new device, new recipient, and the age of the device and of the recipient.
- **Velocity:** transactions in the last 10 minutes and the last 24 hours.
- **Transaction type:** ODEME, TRANSFER, FATURA or CEKIM (one-hot).

## Models and thresholds

| Model | Algorithm | Output |
|---|---|---|
| Risk | HistGradientBoosting + sigmoid calibration | Score 0.0–1.0 |
| Fraud type | RandomForest (300 trees), 4 fraud classes | CALINTI_KART, HESAP_ELE_GECIRME, PARA_AKLAMA, SUPHELI_DAVRANIS; TEMIZ when the score is below 0.40 |

The decision bands follow the case and are defined in [`app/ml/decision_policy.py`](app/ml/decision_policy.py):

| Score | Decision | Risk level |
|---|---|---|
| < 0.40 | ONAY | DUSUK |
| 0.40 – 0.70 | INCELEME | ORTA |
| 0.70 – 0.90 | INCELEME | YUKSEK |
| > 0.90 | BLOK (temporary) | KRITIK |

## Offline metrics

The data is split by customer group 70/15/15, so no customer appears in both train and test. A time holdout is used as a second check. Risk metrics are measured at the review threshold of 0.40.

| Split | PR-AUC | Precision | Recall | F1 | False positive rate |
|---|---|---|---|---|---|
| Validation | 0.560 | 0.716 | 0.382 | 0.498 | 0.019 |
| Test | 0.609 | 0.715 | 0.521 | 0.603 | 0.026 |
| Time holdout | 0.675 | 0.734 | 0.614 | 0.669 | 0.025 |

The fraud-type model reaches a macro F1 of 0.953 on the test set.

Results on the 120 Turkish scenarios, which were not used for training:

| Measure | Result |
|---|---|
| Legitimate scenarios passed (score below 0.40) | 100% |
| Fraud scenarios flagged (score 0.40 or above) | 47% |
| Fraud type correct overall | 87% |
| Fraud type correct: CALINTI_KART, HESAP_ELE_GECIRME, PARA_AKLAMA | 100% each |
| Fraud type correct: SUPHELI_DAVRANIS | 33% |

The full numbers are written to [`models/metadata.json`](models/metadata.json) on every training run.

## Live accuracy

Analysts give the model feedback in two ways:

- **Fraud type change:** Analysts change the fraud type with `case.fraud_type.overridden`. The AI records this as a misclassification (case §5.4).
- **Case decision:** The decision arrives with `case.decision.made`.

Each case writes one row to `ai.prediction_feedback`. The ground truth, defined in [`app/ml/feedback.py`](app/ml/feedback.py), is:

1. **The customer's verification answer:** "not mine" means fraud and "mine" means legitimate.
2. **Otherwise, the analyst's decision.**

Fraud-type accuracy, precision and recall per type, decision agreement and the false positive rate are served at `/api/v1/ai/metrics/*` and appear on the supervisor dashboard. INCELEME predictions are not graded as right or wrong.

## Limits

- **Synthetic data:** No real transactions were used. The scores show how well the model learned the generator, not real-world performance.
- **Missed fraud:** The risk model is conservative at 0.40. It misses about half of the fraud in the test set and about half of the Turkish fraud scenarios. Most of those are account takeover and money laundering with a known device and moderate amounts. Lowering the threshold, or training on scenario-like data, would trade this for more false positives.
- **SUPHELI_DAVRANIS:** This class is weak by design. It is the archetype that overlaps most with legitimate traffic.
- **Cold start:** History features come from the AI's own past predictions. A new customer starts with a 5,000 TRY average and no known devices.
- **Stale model:** Live feedback is measured but not yet used to retrain.
