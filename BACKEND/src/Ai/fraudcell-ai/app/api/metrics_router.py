"""<c>/api/v1/ai/metrics/*</c>: how well the AI's predictions held up (case §5.4, §7).

Computed from `prediction_feedback`, one row per case, which the analyst's
fraud type change and the case decision fill in (app/messaging/feedback_consumers.py).
app/ml/feedback.py defines the ground truth and which rows each rate can grade.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.database import get_session
from app.ml.feedback import category_metrics, rate
from app.models.ai import ModelBundle, Prediction, PredictionFeedback
from app.schemas.public import (
    ApiEnvelope,
    CategoryAccuracyResponse,
    DecisionAgreementResponse,
    MetricsOverviewResponse,
)

router = APIRouter(prefix="/api/v1/ai/metrics", tags=["AI Metrics"])


async def _feedback(session: AsyncSession, from_: dt.datetime | None, to: dt.datetime | None) -> list[PredictionFeedback]:
    query = select(PredictionFeedback)
    if from_ is not None:
        query = query.where(PredictionFeedback.occurred_at >= from_)
    if to is not None:
        query = query.where(PredictionFeedback.occurred_at <= to)
    return list((await session.execute(query)).scalars().all())


@router.get("/overview", response_model=ApiEnvelope[MetricsOverviewResponse])
async def get_overview(
    session: AsyncSession = Depends(get_session),
    from_: dt.datetime | None = Query(default=None, alias="from"),
    to: dt.datetime | None = Query(default=None),
) -> dict:
    rows = await _feedback(session, from_, to)
    # Each rate counts only the rows it can grade.
    _, fraud_type_accuracy = rate(r.is_fraud_type_correct for r in rows)
    _, decision_agreement_rate = rate(r.is_decision_agreement for r in rows)
    _, false_positive_rate = rate(r.is_false_positive for r in rows)

    prediction_count = (await session.execute(select(func.count()).select_from(Prediction))).scalar_one()
    bundle = (await session.execute(select(ModelBundle).where(ModelBundle.status == "ACTIVE"))).scalar_one_or_none()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    return ok({
        "sampleCount": len(rows),
        "fraudTypeAccuracy": fraud_type_accuracy,
        "decisionAgreementRate": decision_agreement_rate,
        "falsePositiveRate": false_positive_rate,
        "totalPredictions": prediction_count,
        "modelBundleVersion": bundle.bundle_version if bundle else None,
        "calculatedAt": now,
    }, generated_at=now)


@router.get("/categories", response_model=ApiEnvelope[CategoryAccuracyResponse])
async def get_category_accuracy(
    session: AsyncSession = Depends(get_session),
    from_: dt.datetime | None = Query(default=None, alias="from"),
    to: dt.datetime | None = Query(default=None),
) -> dict:
    rows = await _feedback(session, from_, to)
    items = [
        {
            "fraudType": m.fraud_type,
            "sampleCount": m.sample_count,
            "accuracy": m.precision,  # kept for older clients: the share of the AI's calls that were right
            "precision": m.precision,
            "recall": m.recall,
        }
        for m in category_metrics((r.ai_fraud_type, r.effective_fraud_type) for r in rows)
    ]
    return ok({"items": items})


@router.get("/decision-agreement", response_model=ApiEnvelope[DecisionAgreementResponse])
async def get_decision_agreement(session: AsyncSession = Depends(get_session)) -> dict:
    graded, agreement_rate = rate(r.is_decision_agreement for r in await _feedback(session, None, None))
    return ok({"sampleCount": graded, "decisionAgreementRate": agreement_rate})
