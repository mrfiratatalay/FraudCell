"""Transactional outbox yazici. SaveChanges/commit CAGIRMAZ;
cagiran kod business degisiklikleriyle ayni transaction'da flush/commit eder.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from ulid import ULID

from app.models.messaging import OutboxMessage


def enqueue(
    *,
    event_type: str,
    subject_id: str,
    payload: dict[str, Any],
    correlation_id: str,
    causation_id: str | None = None,
    event_version: int = 1,
    occurred_at: dt.datetime | None = None,
) -> OutboxMessage:
    now = dt.datetime.now(dt.timezone.utc)
    event_id = str(ULID())

    return OutboxMessage(
        id=event_id,
        event_id=event_id,
        event_type=event_type,
        event_version=event_version,
        routing_key=f"{event_type}.v{event_version}",
        payload=payload,
        subject_id=subject_id,
        correlation_id=correlation_id,
        causation_id=causation_id,
        producer="ai-service",
        occurred_at=occurred_at or now,
        created_at=now,
        attempt_count=0,
        next_attempt_at=now,
    )
