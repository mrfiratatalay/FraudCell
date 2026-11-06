"""Outbox publisher worker. .NET'teki OutboxPublisherService'in
Python esdegeri: SKIP LOCKED benzeri kira mekanizmasi ile bekleyen kayitlari yayinlar.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import socket
import uuid

import aio_pika
from sqlalchemy import text

from app.config import settings
from app.database import SessionFactory
from app.messaging.topology import declare_exchanges

logger = logging.getLogger(__name__)

_INSTANCE_ID = f"{socket.gethostname()}:{uuid.uuid4().hex[:8]}"
_POLL_INTERVAL_SECONDS = 0.5
_BATCH_SIZE = 50
_LEASE_SECONDS = 60


async def run(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await _publish_batch()
        except Exception:
            logger.exception("Outbox publish cycle failed; will retry.")
            await asyncio.sleep(2)

        await asyncio.sleep(_POLL_INTERVAL_SECONDS)


async def _publish_batch() -> None:
    async with SessionFactory() as session:
        rows = (
            await session.execute(
                text(
                    """
                    SELECT id, event_id, event_type, event_version, routing_key, payload,
                           subject_id, correlation_id, causation_id, producer, occurred_at
                    FROM ai.outbox_messages
                    WHERE published_at IS NULL
                      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
                      AND (locked_until IS NULL OR locked_until < now())
                    ORDER BY occurred_at
                    LIMIT :batch_size
                    FOR UPDATE SKIP LOCKED
                    """
                ),
                {"batch_size": _BATCH_SIZE},
            )
        ).mappings().all()

        if not rows:
            return

        ids = [row["id"] for row in rows]
        # _LEASE_SECONDS sabit bir int'tir (kullanici girdisi degil); interval literaline
        # dogrudan gomulmesi SQL injection riski tasimaz.
        await session.execute(
            text(
                f"UPDATE ai.outbox_messages SET locked_until = now() + interval '{_LEASE_SECONDS} seconds', "
                "lock_owner = :owner, attempt_count = attempt_count + 1 WHERE id = ANY(:ids)"
            ),
            {"owner": _INSTANCE_ID, "ids": ids},
        )
        await session.commit()

    connection = await aio_pika.connect_robust(settings.rabbitmq.url)
    async with connection:
        channel = await connection.channel(publisher_confirms=True)
        exchanges = await declare_exchanges(channel)

        async with SessionFactory() as session:
            for row in rows:
                try:
                    body = _build_envelope_bytes(row)
                    await exchanges["events"].publish(
                        aio_pika.Message(
                            body=body,
                            content_type="application/json",
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                            message_id=row["event_id"],
                            correlation_id=row["correlation_id"],
                            type=row["event_type"],
                            app_id=row["producer"],
                        ),
                        routing_key=row["routing_key"],
                    )

                    await session.execute(
                        text(
                            "UPDATE ai.outbox_messages SET published_at = now(), last_error = NULL, "
                            "next_attempt_at = NULL, locked_until = NULL, lock_owner = NULL WHERE id = :id"
                        ),
                        {"id": row["id"]},
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Failed to publish outbox message %s: %s", row["event_id"], exc)
                    await session.execute(
                        text(
                            "UPDATE ai.outbox_messages SET last_error = :error, "
                            "next_attempt_at = now() + interval '5 seconds', locked_until = NULL WHERE id = :id"
                        ),
                        {"error": str(exc)[:2000], "id": row["id"]},
                    )

            await session.commit()


def _build_envelope_bytes(row) -> bytes:  # type: ignore[no-untyped-def]
    payload = row["payload"]
    envelope = {
        "eventId": row["event_id"],
        "eventType": row["event_type"],
        "eventVersion": row["event_version"],
        "occurredAt": _as_utc_isoformat(row["occurred_at"]),
        "producer": row["producer"],
        "correlationId": row["correlation_id"],
        "causationId": row["causation_id"],
        "subjectId": row["subject_id"],
        "payload": payload,
    }
    return json.dumps(envelope, ensure_ascii=False).encode("utf-8")


def _as_utc_isoformat(value: dt.datetime) -> str:
    # PostgreSQL timestamp-without-time-zone values return as naive datetimes.
    # Outbox timestamps are written in UTC, so restore that contract at the
    # service boundary instead of letting consumers interpret local machine time.
    if value.tzinfo is None:
        value = value.replace(tzinfo=dt.timezone.utc)
    else:
        value = value.astimezone(dt.timezone.utc)
    return value.isoformat().replace("+00:00", "Z")
