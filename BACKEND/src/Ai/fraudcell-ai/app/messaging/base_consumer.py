"""Yeniden kullanilabilir consumer iskeleti.

.NET tarafindaki RabbitMqConsumerHostedService ile ayni retry/DLQ mantigini
uygular: basarisiz mesaj ACK edilir ve bir kopyasi retry/DLQ zincirine
manuel olarak yeniden yayinlanir.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from decimal import Decimal

import aio_pika

from app.messaging.envelope import EventEnvelope
from app.messaging.topology import RETRY_DELAYS_SECONDS, declare_consumer_queue, retry_queue_name

logger = logging.getLogger(__name__)

RETRY_COUNT_HEADER = "x-fraudcell-retry-count"


def _parse_retry_count(value: object) -> int:
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("ascii")
    if isinstance(value, (int, float, Decimal, str)):
        return int(value)
    return 0


class BaseConsumer(ABC):
    queue_name: str
    routing_keys: list[str]

    def __init__(self, connection_url: str) -> None:
        self._connection_url = connection_url

    @abstractmethod
    async def handle(self, envelope: EventEnvelope) -> None: ...

    async def run(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                await self._run_once(stop_event)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Consumer %s loop failed; reconnecting in 5s.", self.queue_name)
                await asyncio.sleep(5)

    async def _run_once(self, stop_event: asyncio.Event) -> None:
        connection = await aio_pika.connect_robust(self._connection_url)
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=10)

            queue = await declare_consumer_queue(channel, self.queue_name, self.routing_keys)

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    if stop_event.is_set():
                        break
                    await self._process(channel, message)

    async def _process(self, channel: aio_pika.abc.AbstractChannel, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        try:
            payload = json.loads(message.body)
            envelope = EventEnvelope.model_validate(payload)
            await self.handle(envelope)
            await message.ack()
        except Exception:
            logger.exception("Failed to process message on %s; routing to retry/DLQ.", self.queue_name)
            await self._requeue_for_retry(channel, message)

    async def _requeue_for_retry(
        self, channel: aio_pika.abc.AbstractChannel, message: aio_pika.abc.AbstractIncomingMessage
    ) -> None:
        headers = dict(message.headers or {})
        retry_count = _parse_retry_count(headers.get(RETRY_COUNT_HEADER, 0))
        headers[RETRY_COUNT_HEADER] = retry_count + 1

        if retry_count < len(RETRY_DELAYS_SECONDS):
            target_exchange = "fraudcell.retry"
            routing_key = retry_queue_name(self.queue_name, RETRY_DELAYS_SECONDS[retry_count])
        else:
            target_exchange = "fraudcell.dlq"
            routing_key = self.queue_name
            logger.error("Message on %s exhausted retries; sent to DLQ.", self.queue_name)

        exchange = await channel.get_exchange(target_exchange)
        await exchange.publish(
            aio_pika.Message(body=message.body, headers=headers, content_type="application/json", delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
            routing_key=routing_key,
        )

        await message.ack()
