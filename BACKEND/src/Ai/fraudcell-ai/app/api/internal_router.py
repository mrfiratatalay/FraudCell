"""Internal API. Yalnizca application-network
icinden erisilir; Gateway bu route'lari public olarak disari acmaz.
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.config import settings
from app.database import SessionFactory
from app.ml.assignment import rank_candidates
from app.ml.decision_policy import evaluate_risk
from app.ml.features import build_feature_vector
from app.ml.model_registry import ModelNotReadyError, registry
from app.ml.reason_codes import generate_reason_codes
from app.schemas.internal import InternalScoreRequest

router = APIRouter(prefix="/internal/v1", tags=["Internal"])


def _require_internal_token(authorization: str | None) -> None:
    expected = f"Internal {settings.internal_api_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Internal token geçersiz.")


@router.get("/models/health")
async def models_health(authorization: str | None = Header(default=None)) -> dict:
    _require_internal_token(authorization)
    return ok({"ready": registry.is_ready, "bundleVersion": registry.metadata.get("bundleVersion") if registry.metadata else None})


@router.post("/assessments/score")
async def score_internal(request: InternalScoreRequest, authorization: str | None = Header(default=None)) -> dict:
    """Diagnostic/contract-test amaclidir; ana transaction akisi HTTP'ye bagli DEGILDIR."""
    _require_internal_token(authorization)

    if not registry.is_ready:
        try:
            registry.load()
        except ModelNotReadyError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    session: AsyncSession
    async with SessionFactory() as session:
        features = await build_feature_vector(
            session,
            customer_id=f"internal-{request.transaction_id}",
            amount=request.amount,
            transaction_type=request.transaction_type,
            device_fingerprint_hash="internal-diagnostic",
            recipient_reference="internal-diagnostic",
            country_code=request.country_code,
            occurred_at=request.occurred_at,
        )

        risk_score = registry.predict_risk_score(features)
        decision_result = evaluate_risk(risk_score)
        fraud_type = registry.predict_fraud_type(features) if risk_score >= 0.40 else "TEMIZ"
        candidates = await rank_candidates(session, fraud_type)

    return {
        "assessmentId": request.assessment_request_id,
        "transactionId": request.transaction_id,
        "riskScore": round(risk_score, 5),
        "riskLevel": decision_result.risk_level,
        "decision": decision_result.decision,
        "fraudType": fraud_type,
        "modelVersion": registry.metadata["bundleVersion"] if registry.metadata else "unknown",
        "reasonCodes": generate_reason_codes(features),
        "analystCandidates": [
            {
                "analystId": c.analyst_id, "rank": c.rank, "score": c.score,
                "expertiseScore": c.expertise_score, "capacityScore": c.capacity_score, "performanceScore": c.performance_score,
            }
            for c in candidates
        ],
        "assessedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
