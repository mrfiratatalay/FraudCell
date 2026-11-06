"""Ozellik semasi.

Kolon sirasi egitim ve inference arasinda BIREBIR ayni olmalidir; bu yuzden
tek bir kaynaktan (bu liste) uretilir.
"""

from __future__ import annotations

FEATURE_COLUMNS: list[str] = [
    "amount",
    "hour_of_day",
    "is_night",
    "is_foreign_country",
    "is_new_device",
    "is_new_recipient",
    "amount_deviation_ratio",
    "transactions_last_10_minutes",
    "transactions_last_24_hours",
    "device_age_days",
    "recipient_age_days",
    "transaction_type_odeme",
    "transaction_type_transfer",
    "transaction_type_fatura",
    "transaction_type_cekim",
]

FRAUD_TYPE_CLASSES: list[str] = [
    "CALINTI_KART",
    "HESAP_ELE_GECIRME",
    "PARA_AKLAMA",
    "SUPHELI_DAVRANIS",
    "TEMIZ",
]

RANDOM_SEED = 20260722
