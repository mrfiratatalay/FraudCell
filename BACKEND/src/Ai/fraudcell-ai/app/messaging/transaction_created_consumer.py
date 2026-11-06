"""`transaction.created` tuketicisi: risk skorlama + fraud-type + analist siralamasi
uretip `ai.assessment.completed` yayinlar.

Hata durumunda (model hazir degil, beklenmeyen exception) `ai.assessment.failed`
yayinlanir; Transaction Service ayni guvenli fallback'i (BELIRSIZ/INCELEME) uygular.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging

from sqlalchemy import select
from ulid import ULID

from app.database import SessionFactory
from app.messaging.base_consumer import BaseConsumer
from app.messaging.envelope import EventEnvelope
from app.messaging.outbox import enqueue
from app.ml.assignment import rank_candidates
from app.ml.decision_policy import evaluate_risk
from app.ml.features import build_feature_vector
from app.ml.model_registry import ModelNotReadyError, registry
from app.ml.reason_codes import generate_reason_codes
from app.models.ai import AssignmentRecommendation, AssignmentRecommendationCandidate, ModelBundle, Prediction
from app.models.messaging import InboxMessage

logger = logging.getLogger(__name__)

CONSUMER_NAME = "ai-service"


class TransactionCreatedConsumer(BaseConsumer):
    queue_name = "ai.transaction-created"
    routing_keys = ["transaction.created.v1"]

    async def handle(self, envelope: EventEnvelope) -> None:
        async with SessionFactory() as session:
            already_processed = await session.get(InboxMessage, {"event_id": envelope.event_id, "consumer_name": CONSUMER_NAME})
            if already_processed is not None:
                return

            payload = envelope.payload
            transaction_id = payload["transactionId"]
            now = dt.datetime.now(dt.timezone.utc)

            try:
                if not registry.is_ready:
                    registry.load()

                features = await build_feature_vector(
                    session,
                    customer_id=payload["customerId"],
                    amount=float(payload["amount"]),
                    transaction_type=payload["transactionType"],
                    device_fingerprint_hash=payload["deviceFingerprintHash"],
                    recipient_reference=payload["recipientReference"],
                    country_code=payload["countryCode"],
                    occurred_at=dt.datetime.fromisoformat(str(payload["occurredAt"]).replace("Z", "+00:00")),
                )

                risk_score = registry.predict_risk_score(features)
                decision_result = evaluate_risk(risk_score)
                fraud_type = registry.predict_fraud_type(features) if risk_score >= 0.40 else "TEMIZ"
                reason_codes = generate_reason_codes(features)

                bundle_id = await self._active_bundle_id(session)
                candidates = await rank_candidates(session, fraud_type)

                assessment_id = envelope.event_id  # ULID zaten benzersiz; ayri bir id uretmeye gerek yok.
                prediction = Prediction(
                    id=assessment_id,
                    transaction_id=transaction_id,
                    source_event_id=envelope.event_id,
                    correlation_id=envelope.correlation_id,
                    model_bundle_id=bundle_id,
                    risk_score=risk_score,
                    risk_level=decision_result.risk_level,
                    decision=decision_result.decision,
                    fraud_type=fraud_type,
                    feature_snapshot={**features, "customerId": payload["customerId"], "deviceFingerprintHash": payload["deviceFingerprintHash"], "recipientReference": payload["recipientReference"], "amount": payload["amount"]},
                    reason_codes=reason_codes,
                    predicted_at=now,
                    created_at=now,
                )
                session.add(prediction)

                # No ORM relationship links these rows, so SQLAlchemy cannot infer
                # that the prediction must be inserted before its FK dependants.
                await session.flush()

                if candidates:
                    recommendation = AssignmentRecommendation(
                        id=str(ULID()), prediction_id=prediction.id, transaction_id=transaction_id,
                        fraud_type=fraud_type, created_at=now,
                    )
                    session.add(recommendation)

                    for candidate in candidates:
                        session.add(AssignmentRecommendationCandidate(
                            id=str(ULID()),
                            recommendation_id=recommendation.id,
                            analyst_id=candidate.analyst_id,
                            rank=candidate.rank,
                            total_score=candidate.score,
                            expertise_score=candidate.expertise_score,
                            capacity_score=candidate.capacity_score,
                            performance_score=candidate.performance_score,
                            created_at=now,
                        ))

                outbox_message = enqueue(
                    event_type="ai.assessment.completed",
                    subject_id=transaction_id,
                    correlation_id=envelope.correlation_id,
                    causation_id=envelope.event_id,
                    occurred_at=now,
                    payload={
                        "transactionId": transaction_id,
                        "assessmentId": assessment_id,
                        "riskScore": round(risk_score, 5),
                        "fraudType": fraud_type,
                        "modelVersion": registry.metadata["bundleVersion"] if registry.metadata else "unknown",
                        "reasonCodes": reason_codes,
                        "analystCandidates": [
                            {
                                "analystId": c.analyst_id,
                                "rank": c.rank,
                                "score": c.score,
                                "expertiseScore": c.expertise_score,
                                "capacityScore": c.capacity_score,
                                "performanceScore": c.performance_score,
                            }
                            for c in candidates
                        ],
                    },
                )
                session.add(outbox_message)

            except ModelNotReadyError:
                logger.exception("Model not ready; publishing ai.assessment.failed for %s.", transaction_id)
                session.add(enqueue(
                    event_type="ai.assessment.failed",
                    subject_id=transaction_id,
                    correlation_id=envelope.correlation_id,
                    causation_id=envelope.event_id,
                    occurred_at=now,
                    payload={"transactionId": transaction_id, "reason": "MODEL_NOT_READY"},
                ))
            except Exception:
                logger.exception("Unexpected error scoring transaction %s; publishing ai.assessment.failed.", transaction_id)
                session.add(enqueue(
                    event_type="ai.assessment.failed",
                    subject_id=transaction_id,
                    correlation_id=envelope.correlation_id,
                    causation_id=envelope.event_id,
                    occurred_at=now,
                    payload={"transactionId": transaction_id, "reason": "INTERNAL_ERROR"},
                ))

            payload_hash = hashlib.sha256(json.dumps(envelope.payload, sort_keys=True).encode("utf-8")).hexdigest()
            session.add(InboxMessage(
                event_id=envelope.event_id,
                consumer_name=CONSUMER_NAME,
                event_type=envelope.event_type,
                payload_hash=payload_hash,
                processed_at=now,
                correlation_id=envelope.correlation_id,
            ))

            await session.commit()

    @staticmethod
    async def _active_bundle_id(session) -> str | None:  # type: ignore[no-untyped-def]
        result = await session.execute(select(ModelBundle.id).where(ModelBundle.status == "ACTIVE"))
        return result.scalar_one_or_none()
