"""RabbitMQ topolojisi.

.NET tarafindaki FraudCell.BuildingBlocks.Messaging.RabbitMq.RabbitMqTopology
ile AYNI exchange/kuyruk isimlendirmesini kullanir; boylece iki calisma
zamani (Python/`.NET`) ayni broker uzerinde birbiriyle konusabilir.
"""

from __future__ import annotations

import aio_pika

from app.config import settings

RETRY_DELAYS_SECONDS = [5, 30, 120]


async def declare_exchanges(channel: aio_pika.abc.AbstractChannel) -> dict[str, aio_pika.abc.AbstractExchange]:
    events = await channel.declare_exchange("fraudcell.events", aio_pika.ExchangeType.TOPIC, durable=True)
    retry = await channel.declare_exchange("fraudcell.retry", aio_pika.ExchangeType.DIRECT, durable=True)
    requeue = await channel.declare_exchange("fraudcell.requeue", aio_pika.ExchangeType.DIRECT, durable=True)
    dlq = await channel.declare_exchange("fraudcell.dlq", aio_pika.ExchangeType.DIRECT, durable=True)
    return {"events": events, "retry": retry, "requeue": requeue, "dlq": dlq}


async def declare_consumer_queue(
    channel: aio_pika.abc.AbstractChannel, queue_name: str, routing_keys: list[str]
) -> aio_pika.abc.AbstractQueue:
    exchanges = await declare_exchanges(channel)

    queue = await channel.declare_queue(queue_name, durable=True)
    for routing_key in routing_keys:
        await queue.bind(exchanges["events"], routing_key=routing_key)

    await queue.bind(exchanges["requeue"], routing_key=queue_name)

    for delay in RETRY_DELAYS_SECONDS:
        retry_queue_name = f"{queue_name}.retry.{delay}"
        retry_queue = await channel.declare_queue(
            retry_queue_name,
            durable=True,
            arguments={
                "x-message-ttl": delay * 1000,
                "x-dead-letter-exchange": "fraudcell.requeue",
                "x-dead-letter-routing-key": queue_name,
            },
        )
        await retry_queue.bind(exchanges["retry"], routing_key=retry_queue_name)

    dlq_queue = await channel.declare_queue(f"{queue_name}.dlq", durable=True)
    await dlq_queue.bind(exchanges["dlq"], routing_key=queue_name)

    return queue


def retry_queue_name(queue_name: str, delay_seconds: int) -> str:
    return f"{queue_name}.retry.{delay_seconds}"


__all__ = ["declare_exchanges", "declare_consumer_queue", "retry_queue_name", "RETRY_DELAYS_SECONDS", "settings"]
