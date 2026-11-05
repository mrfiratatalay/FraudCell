"""AI'nin analist siralamasi icin kullandigi local projection tuketicileri.
Bu projection'lar authoritative
degildir; asil kaynak Identity/Transaction/Gamification servisleridir.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json

from app.database import SessionFactory
from app.messaging.base_consumer import BaseConsumer
from app.messaging.envelope import EventEnvelope
from app.models.ai import AnalystPerformanceProjection, AnalystProfileProjection, AnalystWorkloadProjection
from app.models.messaging import InboxMessage

CONSUMER_NAME = "ai-service"


async def _already_processed(session, event_id: str) -> bool:  # type: ignore[no-untyped-def]
    return await session.get(InboxMessage, {"event_id": event_id, "consumer_name": CONSUMER_NAME}) is not None


async def _mark_processed(session, envelope: EventEnvelope, now: dt.datetime) -> None:  # type: ignore[no-untyped-def]
    payload_hash = hashlib.sha256(json.dumps(envelope.payload, sort_keys=True).encode("utf-8")).hexdigest()
    session.add(InboxMessage(
        event_id=envelope.event_id, consumer_name=CONSUMER_NAME, event_type=envelope.event_type,
        payload_hash=payload_hash, processed_at=now, correlation_id=envelope.correlation_id,
    ))


class StaffProfileUpdatedConsumer(BaseConsumer):
    queue_name = "ai.identity-staff-profile-updated"
    routing_keys = ["identity.staff.profile.updated.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            now = dt.datetime.now(dt.timezone.utc)
            payload = envelope.payload
            analyst_id = payload["userId"]

            profile = await session.get(AnalystProfileProjection, analyst_id)
            if profile is None:
                profile = AnalystProfileProjection(analyst_id=analyst_id, source_updated_at=now, projection_updated_at=now)
                session.add(profile)

            profile.display_name = payload.get("displayName")
            profile.is_active = bool(payload.get("isActive", True))
            profile.assignment_enabled = bool(payload.get("assignmentEnabled", True))
            profile.specialties = payload.get("specialties", [])
            profile.regions = payload.get("regions", [])
            profile.last_source_event_id = envelope.event_id
            profile.source_updated_at = now
            profile.projection_updated_at = now

            await _mark_processed(session, envelope, now)
            await session.commit()


class AnalystPerformanceUpdatedConsumer(BaseConsumer):
    queue_name = "ai.analyst-performance-updated"
    routing_keys = ["analyst.performance.updated.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            now = dt.datetime.now(dt.timezone.utc)
            payload = envelope.payload
            analyst_id = payload["analystId"]

            performance = await session.get(AnalystPerformanceProjection, analyst_id)
            if performance is None:
                performance = AnalystPerformanceProjection(analyst_id=analyst_id, projection_updated_at=now)
                session.add(performance)

            performance.total_decisions = int(payload.get("totalDecisions", 0))
            performance.correct_decisions = int(payload.get("correctDecisions", 0))
            performance.false_positive_count = int(payload.get("falsePositiveCount", 0))
            performance.sla_compliant_count = int(payload.get("slaCompliantCount", 0))
            performance.average_decision_seconds = payload.get("averageDecisionSeconds")
            performance.performance_score = float(payload.get("accuracyRate", 0.50))
            performance.last_source_event_id = envelope.event_id
            performance.projection_updated_at = now

            await _mark_processed(session, envelope, now)
            await session.commit()


class CaseAssignedConsumer(BaseConsumer):
    queue_name = "ai.case-assigned"
    routing_keys = ["case.assigned.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            now = dt.datetime.now(dt.timezone.utc)
            analyst_id = envelope.payload["analystId"]

            workload = await session.get(AnalystWorkloadProjection, analyst_id)
            if workload is None:
                workload = AnalystWorkloadProjection(analyst_id=analyst_id, active_case_count=0, projection_updated_at=now)
                session.add(workload)

            workload.active_case_count += 1
            workload.last_assigned_at = now
            workload.last_source_event_id = envelope.event_id
            workload.projection_updated_at = now

            await _mark_processed(session, envelope, now)
            await session.commit()


class CaseClosedConsumer(BaseConsumer):
    """`case.decision.made` ile aktif vaka sayisi azalir."""

    queue_name = "ai.case-decision-made"
    routing_keys = ["case.decision.made.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            now = dt.datetime.now(dt.timezone.utc)
            analyst_id = envelope.payload.get("analystId")

            if analyst_id:
                workload = await session.get(AnalystWorkloadProjection, analyst_id)
                if workload is not None and workload.active_case_count > 0:
                    workload.active_case_count -= 1
                    workload.projection_updated_at = now
                    workload.last_source_event_id = envelope.event_id

            await _mark_processed(session, envelope, now)
            await session.commit()
