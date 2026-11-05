"""Ozellik muhendisligi.

AI Service Transaction Database'e baglanamaz;
bu yuzden hiz/yenilik sinyalleri AI'nin KENDI `predictions.feature_snapshot`
gecmisinden turetilir. Bu, ayri bir tablo eklemeden servis sinirini korur.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.schema import FEATURE_COLUMNS
from app.models.ai import Prediction

_TRANSACTION_TYPE_KEYS = {
    "ODEME": "transaction_type_odeme",
    "TRANSFER": "transaction_type_transfer",
    "FATURA": "transaction_type_fatura",
    "CEKIM": "transaction_type_cekim",
}

# Yeni musteride kisisel gecmis yoktur. Tutari kendisine bolmek her ilk islemi
# yapay olarak "1x normal" gosteriyor ve PDF'deki zorunlu yuksek-tutarli,
# yurt-disi ilk islem demosunun en guclu sinyalini siliyordu. 5.000 TRY,
# cold-start icin acik ve muhafazakar bir operasyonel referanstir.
_COLD_START_AVERAGE_AMOUNT_TRY = 5_000.0

# Customers are in Turkey, so hour and "night" are local time. Istanbul has been
# UTC+3 all year since 2016 (no daylight saving), so a fixed offset is exact.
ISTANBUL = dt.timezone(dt.timedelta(hours=3), "Europe/Istanbul")


async def build_feature_vector(
    session: AsyncSession,
    *,
    customer_id: str,
    amount: float,
    transaction_type: str,
    device_fingerprint_hash: str,
    recipient_reference: str,
    country_code: str,
    occurred_at: dt.datetime,
) -> dict[str, Any]:
    """Gecmis tahminlerden musteri bazli sinyalleri hesaplar ve tam ozellik vektorunu doner."""

    history_rows = await session.execute(
        select(Prediction.feature_snapshot, Prediction.predicted_at)
        .where(Prediction.feature_snapshot["customerId"].as_string() == customer_id)
        .order_by(Prediction.predicted_at.desc())
        .limit(500)
    )
    history = history_rows.all()

    now = occurred_at if occurred_at.tzinfo else occurred_at.replace(tzinfo=dt.timezone.utc)

    device_seen_at: dt.datetime | None = None
    recipient_seen_at: dt.datetime | None = None
    amounts: list[float] = []
    last_10_min = 0
    last_24h = 0

    for snapshot, predicted_at in history:
        predicted_at_utc = predicted_at if predicted_at.tzinfo else predicted_at.replace(tzinfo=dt.timezone.utc)
        age = now - predicted_at_utc

        if snapshot.get("deviceFingerprintHash") == device_fingerprint_hash:
            device_seen_at = predicted_at_utc if device_seen_at is None else max(device_seen_at, predicted_at_utc)
        if snapshot.get("recipientReference") == recipient_reference:
            recipient_seen_at = predicted_at_utc if recipient_seen_at is None else max(recipient_seen_at, predicted_at_utc)

        raw_amount = snapshot.get("amount")
        if raw_amount is not None:
            amounts.append(float(raw_amount))

        if dt.timedelta(0) <= age <= dt.timedelta(minutes=10):
            last_10_min += 1
        if dt.timedelta(0) <= age <= dt.timedelta(hours=24):
            last_24h += 1

    customer_average_amount = (
        sum(amounts) / len(amounts) if amounts else _COLD_START_AVERAGE_AMOUNT_TRY
    )
    amount_deviation_ratio = amount / customer_average_amount if customer_average_amount > 0 else 1.0

    device_age_days = (now - device_seen_at).days if device_seen_at else 0
    recipient_age_days = (now - recipient_seen_at).days if recipient_seen_at else 0

    local_hour = now.astimezone(ISTANBUL).hour
    features: dict[str, Any] = {
        "amount": float(amount),
        "hour_of_day": local_hour,
        "is_night": 1.0 if local_hour < 6 or local_hour >= 23 else 0.0,
        "is_foreign_country": 0.0 if country_code.upper() == "TR" else 1.0,
        "is_new_device": 1.0 if device_seen_at is None else 0.0,
        "is_new_recipient": 1.0 if recipient_seen_at is None else 0.0,
        "amount_deviation_ratio": float(amount_deviation_ratio),
        "transactions_last_10_minutes": float(last_10_min),
        "transactions_last_24_hours": float(last_24h),
        "device_age_days": float(device_age_days),
        "recipient_age_days": float(recipient_age_days),
        "transaction_type_odeme": 0.0,
        "transaction_type_transfer": 0.0,
        "transaction_type_fatura": 0.0,
        "transaction_type_cekim": 0.0,
    }

    type_key = _TRANSACTION_TYPE_KEYS.get(transaction_type.upper())
    if type_key:
        features[type_key] = 1.0

    return {column: features[column] for column in FEATURE_COLUMNS}
