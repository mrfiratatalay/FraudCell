"""Feature vector checks that need no database (case §5.1)."""

from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

import pytest

from app.ml.features import build_feature_vector

UTC = dt.timezone.utc


class _NoHistory:
    """Stands in for the AsyncSession: the customer has no earlier predictions."""

    async def execute(self, _statement: Any) -> "_NoHistory":
        return self

    def all(self) -> list:
        return []


def _features(occurred_at: dt.datetime) -> dict[str, Any]:
    return asyncio.run(build_feature_vector(
        _NoHistory(),  # type: ignore[arg-type]
        customer_id="customer-1", amount=1_000.0, transaction_type="TRANSFER",
        device_fingerprint_hash="device-1", recipient_reference="TR001", country_code="TR",
        occurred_at=occurred_at,
    ))


# The customers are in Turkey, so "night" is Istanbul time (UTC+3), not UTC.
@pytest.mark.parametrize(
    ("occurred_at_utc", "istanbul_hour", "is_night"),
    [
        (dt.datetime(2026, 7, 17, 22, 30, tzinfo=UTC), 1, 1.0),   # 01:30 in Istanbul
        (dt.datetime(2026, 7, 17, 20, 0, tzinfo=UTC), 23, 1.0),   # 23:00 in Istanbul
        (dt.datetime(2026, 7, 18, 5, 0, tzinfo=UTC), 8, 0.0),     # 08:00 in Istanbul
        (dt.datetime(2026, 7, 18, 2, 59, tzinfo=UTC), 5, 1.0),    # 05:59 in Istanbul
        (dt.datetime(2026, 7, 18, 3, 0, tzinfo=UTC), 6, 0.0),     # 06:00 in Istanbul
    ],
)
def test_night_is_measured_in_istanbul_time(occurred_at_utc: dt.datetime, istanbul_hour: int, is_night: float) -> None:
    features = _features(occurred_at_utc)

    assert features["hour_of_day"] == istanbul_hour
    assert features["is_night"] == is_night
