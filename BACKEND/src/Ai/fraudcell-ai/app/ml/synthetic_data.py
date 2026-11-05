"""Sentetik egitim verisi ureticisi.

Tasarim ilkeleri (kritik):
  1. **Ortusen dagilimlar** — temiz ve fraud islemlerinin ozellik dagilimlari
     TAMAMEN ayrisMAZ. Temiz islemlerde de risk sinyali (yeni cihaz, gece, yeni
     alici) gorulur; fraud islemlerin de her sinyali tasimaz. Boylece model
     "if new_device -> fraud" gibi tek kurali ezberleyemez.
  2. **Latent (stokastik) etiketleme** — `is_fraud` deterministik bir esik/if ile
     DEGIL, ozelliklerden turetilen LOJISTIK bir latent olasilik + gurultuden
     ornekleme ile uretilir. Lojistik link, pozitifleri risk-ozelliklerinin
     bulundugu bolgede yogunlastirir (ogrenilebilir) ama gurultu ortusme birakir
     (Bayes hatasi > 0). Boylece suni %100 metrikler olusmaz.
  3. **Tutarli `is_night`** — gercek `features.py` `is_night`'i SAATTEN turetir
     (hour < 6 veya hour >= 23). Burada da ayni sekilde turetilir; iki alan asla
     celismez (egitim/inference uyumu).
  4. **Musteri + zaman ekseni** — her islem bir `customer_id` ve `occurred_at`
     tasir; boylece egitim tarafinda musteri-grubu (group holdout) ve zaman bazli
     bolme yapilabilir (train.py). Bu kolonlar OZELLIK DEGILDIR; yalnizca
     bolme/denetim icindir.

Sabit random seed kullanilir; class distribution ve leakage kontrolu train.py'de
raporlanir.
"""

from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from app.ml.schema import FEATURE_COLUMNS, FRAUD_TYPE_CLASSES, RANDOM_SEED

# Veri setinin kapsadigi zaman penceresi (zaman bazli holdout icin).
_WINDOW_DAYS = 120
_WINDOW_END = dt.datetime(2026, 7, 20, tzinfo=dt.timezone.utc)

_NIGHT_HOURS = [23, 0, 1, 2, 3, 4, 5]

_FRAUD_ARCHETYPES = ["CALINTI_KART", "HESAP_ELE_GECIRME", "PARA_AKLAMA", "SUPHELI_DAVRANIS"]
# Fraud senaryosu secildiginde turler arasi dagilim (case zorunlu 4 tur).
_FRAUD_ARCHETYPE_WEIGHTS = [0.38, 0.27, 0.10, 0.25]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def latent_fraud_probability(features: dict[str, float], rng: np.random.Generator) -> float:
    """Ozelliklerden turetilen LOJISTIK latent fraud olasiligi (deterministik if DEGIL).

    Etiket bu olasiliktan orneklenir; ayni ozellik vektoru bazen fraud bazen temiz
    cikabilir. Lojistik link + orta duzey gurultu, sinyalsiz bolgede fraud'u nadir
    tutar (ogrenilebilir), sinirda ise ortusme birakir (durust metrikler).
    """
    logit = -4.3  # taban: sinyalsiz islemde ~%1.3 (gorunmez-fraud kuyrugu kucuk kalsin)
    logit += 1.6 if features["is_new_device"] >= 1.0 else 0.0
    logit += 0.7 if features["is_night"] >= 1.0 else 0.0
    logit += 1.2 if features["is_foreign_country"] >= 1.0 else 0.0
    logit += 0.55 if features["is_new_recipient"] >= 1.0 else 0.0

    ratio = features["amount_deviation_ratio"]
    if ratio >= 6.0:
        logit += 1.8
    elif ratio >= 3.0:
        logit += 1.0
    elif ratio >= 1.8:
        logit += 0.35

    if features["transactions_last_10_minutes"] >= 4:
        logit += 1.5
    elif features["transactions_last_24_hours"] >= 8:
        logit += 0.7

    if features["device_age_days"] < 3:
        logit += 0.6

    logit += float(rng.normal(0.0, 0.35))  # irreducible gurultu -> Bayes hatasi > 0 (ama ranking'i bozacak kadar degil)
    return float(_sigmoid(logit))


def _sample_customers(rng: np.random.Generator, n_customers: int) -> list[dict]:
    """Her musteri icin latent fraud egilimi ve davranis parametreleri uretir."""
    customers = []
    for i in range(n_customers):
        propensity = float(rng.beta(1.6, 5.0))  # cogunlukla dusuk, az sayida yuksek riskli
        customers.append(
            {
                "customer_id": f"cust-{i:05d}",
                "propensity": propensity,
                "base_amount_mu": float(rng.uniform(5.4, 7.2)),  # lognormal mean
                "device_pref": float(rng.uniform(0.03, 0.22)),  # temel yeni-cihaz egilimi
                "type_pref": rng.choice(["odeme", "transfer", "fatura", "cekim"], p=[0.35, 0.40, 0.15, 0.10]),
            }
        )
    return customers


def _bernoulli(rng: np.random.Generator, p: float) -> bool:
    return bool(rng.random() < p)


def _archetype_params(customer: dict, archetype: str) -> dict:
    """Arketipe gore ORTUSEN dagilim parametreleri (hicbir band sinifi tek basina belirlemez)."""
    if archetype == "LEGIT":
        return {
            "p_new_device": customer["device_pref"], "p_night": 0.12, "p_foreign": 0.10, "p_new_recipient": 0.28,
            "dev_center": 1.0, "dev_sigma": 0.5, "spike_chance": 0.08, "spike_range": (3.0, 8.0),
            "last10_lam": 0.2, "last24_lam": 2.0, "device_age_range": (20, 900), "recipient_age_range": (0, 600),
        }
    if archetype == "CALINTI_KART":
        return {
            "p_new_device": 0.82, "p_night": 0.55, "p_foreign": 0.62, "p_new_recipient": 0.72,
            "dev_center": 5.5, "dev_sigma": 3.0, "spike_chance": 0.0, "spike_range": (0.0, 0.0),
            "last10_lam": 2.6, "last24_lam": 6.5, "device_age_range": (0, 4), "recipient_age_range": (0, 5),
        }
    if archetype == "HESAP_ELE_GECIRME":
        return {
            "p_new_device": 0.78, "p_night": 0.48, "p_foreign": 0.45, "p_new_recipient": 0.68,
            "dev_center": 3.8, "dev_sigma": 2.0, "spike_chance": 0.0, "spike_range": (0.0, 0.0),
            "last10_lam": 1.8, "last24_lam": 5.5, "device_age_range": (0, 15), "recipient_age_range": (0, 12),
        }
    if archetype == "PARA_AKLAMA":
        return {
            "p_new_device": 0.40, "p_night": 0.28, "p_foreign": 0.68, "p_new_recipient": 0.80,
            "dev_center": 7.0, "dev_sigma": 3.5, "spike_chance": 0.0, "spike_range": (0.0, 0.0),
            "last10_lam": 0.6, "last24_lam": 5.5, "device_age_range": (20, 400), "recipient_age_range": (0, 6),
        }
    # SUPHELI_DAVRANIS — temiz ile en cok ortusen, en belirsiz arketip (bilincli olarak zayif sinyalli)
    return {
        "p_new_device": 0.45, "p_night": 0.34, "p_foreign": 0.26, "p_new_recipient": 0.52,
        "dev_center": 2.4, "dev_sigma": 1.5, "spike_chance": 0.05, "spike_range": (2.5, 6.0),
        "last10_lam": 1.1, "last24_lam": 4.2, "device_age_range": (0, 90), "recipient_age_range": (0, 90),
    }


def _sample_features(rng: np.random.Generator, customer: dict, archetype: str, date_base: dt.datetime) -> dict[str, float]:
    """Arketipe gore ortusen dagilimlardan bir ozellik vektoru + tutarli saat/gece orneler."""
    p = _archetype_params(customer, archetype)

    # Saat -> is_night (features.py ile birebir tutarli: hour < 6 veya hour >= 23).
    if _bernoulli(rng, p["p_night"]):
        hour = int(rng.choice(_NIGHT_HOURS))
    else:
        hour = int(rng.integers(6, 23))  # 6..22
    is_night = hour < 6 or hour >= 23

    is_new_device = _bernoulli(rng, p["p_new_device"])
    is_foreign = _bernoulli(rng, p["p_foreign"])
    is_new_recipient = _bernoulli(rng, p["p_new_recipient"])

    amount_dev = float(np.clip(rng.normal(p["dev_center"], p["dev_sigma"]), 0.1, 30.0))
    if p["spike_chance"] and rng.random() < p["spike_chance"]:
        amount_dev = float(rng.uniform(*p["spike_range"]))

    amount = float(rng.lognormal(mean=customer["base_amount_mu"], sigma=0.7) * max(amount_dev, 0.3) ** 0.4)

    txn_type = customer["type_pref"] if rng.random() < 0.7 else str(rng.choice(["odeme", "transfer", "fatura", "cekim"]))

    return {
        "amount": round(amount, 2),
        "hour_of_day": float(hour),
        "is_night": 1.0 if is_night else 0.0,
        "is_foreign_country": 1.0 if is_foreign else 0.0,
        "is_new_device": 1.0 if is_new_device else 0.0,
        "is_new_recipient": 1.0 if is_new_recipient else 0.0,
        "amount_deviation_ratio": round(amount_dev, 3),
        "transactions_last_10_minutes": float(rng.poisson(p["last10_lam"])),
        "transactions_last_24_hours": float(rng.poisson(p["last24_lam"])),
        "device_age_days": float(rng.integers(*p["device_age_range"])),
        "recipient_age_days": float(rng.integers(*p["recipient_age_range"])),
        "transaction_type_odeme": 1.0 if txn_type == "odeme" else 0.0,
        "transaction_type_transfer": 1.0 if txn_type == "transfer" else 0.0,
        "transaction_type_fatura": 1.0 if txn_type == "fatura" else 0.0,
        "transaction_type_cekim": 1.0 if txn_type == "cekim" else 0.0,
    }


def generate_dataset(n_samples: int = 10_000, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """n_samples sentetik islem uretir; ortusen dagilimlar + lojistik latent etiketleme.

    Doner: FEATURE_COLUMNS + [fraud_type, is_fraud, customer_id, occurred_at].
    """
    rng = np.random.default_rng(seed)

    n_customers = max(50, n_samples // 8)  # ort. ~8 islem/musteri -> group holdout uygulanabilir
    customers = _sample_customers(rng, n_customers)

    window_start = _WINDOW_END - dt.timedelta(days=_WINDOW_DAYS)
    window_seconds = _WINDOW_DAYS * 24 * 3600

    rows: list[dict] = []
    for _ in range(n_samples):
        customer = customers[int(rng.integers(0, n_customers))]

        offset = int(rng.integers(0, window_seconds))
        date_base = window_start + dt.timedelta(seconds=offset)

        # Arketip secimi: musteri egilimi fraud-senaryo olasiligini yukseltir.
        p_fraud_scenario = float(np.clip(0.02 + 0.65 * customer["propensity"], 0.02, 0.72))
        if rng.random() < p_fraud_scenario:
            archetype = str(rng.choice(_FRAUD_ARCHETYPES, p=_FRAUD_ARCHETYPE_WEIGHTS))
        else:
            archetype = "LEGIT"

        features = _sample_features(rng, customer, archetype, date_base)
        occurred_at = date_base.replace(hour=int(features["hour_of_day"]), minute=int(rng.integers(0, 60)))

        # Lojistik latent olasiliktan STOKASTIK etiketleme.
        is_fraud = _bernoulli(rng, latent_fraud_probability(features, rng))

        if not is_fraud:
            fraud_type = "TEMIZ"
        elif archetype == "LEGIT":
            # Temiz gorunumlu ama fraud cikan islem -> belirsiz/supheli kategori.
            fraud_type = "SUPHELI_DAVRANIS"
        else:
            fraud_type = archetype

        rows.append(
            {
                **features,
                "fraud_type": fraud_type,
                "is_fraud": int(is_fraud),
                "customer_id": customer["customer_id"],
                "occurred_at": occurred_at.isoformat(),
            }
        )

    columns = [*FEATURE_COLUMNS, "fraud_type", "is_fraud", "customer_id", "occurred_at"]
    return pd.DataFrame(rows, columns=columns)


__all__ = ["generate_dataset", "latent_fraud_probability", "FRAUD_TYPE_CLASSES"]
