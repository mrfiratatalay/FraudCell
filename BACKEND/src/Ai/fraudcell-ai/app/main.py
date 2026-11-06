"""FraudCell AI Service giris noktasi.

Ana transaction degerlendirme akisi bu HTTP surecinin ICINDE, arka planda
calisan RabbitMQ consumer'lari araciligiyla ilerler; public API yalnizca
sorgu/health/internal-diagnostic amaclidir.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.api import health, internal_router, metrics_router, models_router, predictions_router
from app.bootstrap import bootstrap_models
from app.config import settings
from app.messaging.feedback_consumers import CaseDecisionFeedbackConsumer, FraudTypeOverriddenConsumer
from app.messaging.outbox_worker import run as run_outbox_worker
from app.messaging.projection_consumers import (
    AnalystPerformanceUpdatedConsumer,
    CaseAssignedConsumer,
    CaseClosedConsumer,
    StaffProfileUpdatedConsumer,
)
from app.messaging.transaction_created_consumer import TransactionCreatedConsumer
from app.migrate import migrate
from app.security import STAFF, SUPERVISOR_OR_ADMIN, require_roles

logging.basicConfig(level=logging.INFO, format='{"timestamp":"%(asctime)s","level":"%(levelname)s","service":"ai-service","message":"%(message)s"}')
logger = logging.getLogger(__name__)

_stop_event = asyncio.Event()
_background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Servis kendi database'inin semasini kendi uygular; baska hicbir servisin
    # database'ine dokunmaz.
    await migrate()

    try:
        await bootstrap_models()
    except Exception:
        logger.exception("Model bootstrap failed at startup; /health/ready will report Unhealthy until resolved.")

    consumers = [
        TransactionCreatedConsumer(settings.rabbitmq.url),
        StaffProfileUpdatedConsumer(settings.rabbitmq.url),
        AnalystPerformanceUpdatedConsumer(settings.rabbitmq.url),
        CaseAssignedConsumer(settings.rabbitmq.url),
        CaseClosedConsumer(settings.rabbitmq.url),
        FraudTypeOverriddenConsumer(settings.rabbitmq.url),
        CaseDecisionFeedbackConsumer(settings.rabbitmq.url),
    ]

    for consumer in consumers:
        _background_tasks.append(asyncio.create_task(consumer.run(_stop_event)))

    _background_tasks.append(asyncio.create_task(run_outbox_worker(_stop_event)))

    yield

    _stop_event.set()
    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)


app = FastAPI(title="FraudCell AI Service", version="1.0.0", lifespan=lifespan)

app.include_router(health.router)
# Case §3.3: AI details for staff, accuracy metrics (the dashboard) for supervisors and admins.
app.include_router(models_router.router, dependencies=[Depends(require_roles(*STAFF))])
app.include_router(metrics_router.router, dependencies=[Depends(require_roles(*SUPERVISOR_OR_ADMIN))])
app.include_router(predictions_router.router, dependencies=[Depends(require_roles(*STAFF))])
app.include_router(internal_router.router)
