"""Analyst feedback reaches the AI (case §4.3, §5.4): one prediction_feedback row
per case, written when the analyst changes the fraud type and completed when
the case is decided. app/ml/feedback.py grades the prediction."""

from __future__ import annotations

import datetime as dt
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ulid import ULID

from app.database import SessionFactory
from app.messaging.base_consumer import BaseConsumer
from app.messaging.envelope import EventEnvelope
from app.models.messaging import InboxMessage
from app.ml.feedback import evaluate
from app.models.ai import Prediction, PredictionFeedback

# case.decision.made is also consumed by the workload projection under "ai-service";
# the inbox key is (event_id, consumer_name), so this consumer needs its own name.
CONSUMER_NAME = "ai-service.feedback"


async def _already_processed(session: AsyncSession, event_id: str) -> bool:
    return await session.get(InboxMessage, {"event_id": event_id, "consumer_name": CONSUMER_NAME}) is not None


def _mark_processed(session: AsyncSession, envelope: EventEnvelope) -> None:
    session.add(InboxMessage(
        event_id=envelope.event_id, consumer_name=CONSUMER_NAME, event_type=envelope.event_type,
        payload_hash=hashlib.sha256(json.dumps(envelope.payload, sort_keys=True).encode("utf-8")).hexdigest(),
        processed_at=dt.datetime.now(dt.timezone.utc), correlation_id=envelope.correlation_id,
    ))


async def record_case_feedback(
    session: AsyncSession,
    envelope: EventEnvelope,
    *,
    case_id: str,
    transaction_id: str,
    source: str,
    effective_fraud_type: str | None,
    final_decision: str | None = None,
    customer_response: str | None = None,
) -> PredictionFeedback:
    """Creates or updates the case's feedback row and grades the AI's prediction."""
    now = dt.datetime.now(dt.timezone.utc)
    feedback = (await session.execute(
        select(PredictionFeedback).where(PredictionFeedback.case_id == case_id)
    )).scalar_one_or_none()
    if feedback is None:
        feedback = PredictionFeedback(id=str(ULID()), case_id=case_id, transaction_id=transaction_id, created_at=now)
        session.add(feedback)

    prediction = (await session.execute(
        select(Prediction).where(Prediction.transaction_id == transaction_id).order_by(Prediction.predicted_at.desc()).limit(1)
    )).scalar_one_or_none()
    feedback.prediction_id = prediction.id if prediction else None
    feedback.ai_fraud_type = prediction.fraud_type if prediction else None
    feedback.ai_decision = prediction.decision if prediction else None
    feedback.effective_fraud_type = effective_fraud_type or feedback.effective_fraud_type
    feedback.final_decision = final_decision or feedback.final_decision
    feedback.customer_response = customer_response or feedback.customer_response

    outcome = evaluate(feedback.ai_fraud_type, feedback.effective_fraud_type, feedback.ai_decision,
                       feedback.final_decision, feedback.customer_response)
    feedback.is_fraud_type_correct = outcome.is_fraud_type_correct
    feedback.is_decision_agreement = outcome.is_decision_agreement
    feedback.is_false_positive = outcome.is_false_positive
    feedback.feedback_source = source
    feedback.source_event_id = envelope.event_id
    feedback.occurred_at = envelope.occurred_at
    return feedback


class FraudTypeOverriddenConsumer(BaseConsumer):
    """An analyst or supervisor changed the AI's fraud type: a misclassification (case §5.4)."""

    queue_name = "ai.case-fraud-type-overridden"
    routing_keys = ["case.fraud_type.overridden.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            payload = envelope.payload
            await record_case_feedback(
                session, envelope, case_id=payload["caseId"], transaction_id=payload["transactionId"],
                source="ANALYST_OVERRIDE", effective_fraud_type=payload.get("newFraudType"),
            )
            _mark_processed(session, envelope)
            await session.commit()


class CaseDecisionFeedbackConsumer(BaseConsumer):
    """The case is decided: grade the prediction against the decision and the customer's answer.

    Its own queue on case.decision.made, next to the workload projection's, so each
    gets every event and fails or retries on its own.
    """

    queue_name = "ai.case-decision-feedback"
    routing_keys = ["case.decision.made.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            if await _already_processed(session, envelope.event_id):
                return

            payload = envelope.payload
            await record_case_feedback(
                session, envelope, case_id=payload["caseId"], transaction_id=payload["transactionId"],
                source="CASE_DECISION", effective_fraud_type=payload.get("fraudType"),
                final_decision=payload.get("decision"), customer_response=payload.get("customerVerification"),
            )
            _mark_processed(session, envelope)
            await session.commit()
