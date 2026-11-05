"""<c>GET /api/v1/ai/predictions/{assessmentId}</c> (dokuman §54, Assigned Analyst/Supervisor/Admin).

Staff only: app.security checks the access token and role (wired in app.main).
"""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.database import get_session
from app.ml.explanation import build_deterministic_summary, generate_explanation
from app.models.ai import Prediction
from app.schemas.public import ApiEnvelope, ExplanationResponse, PredictionResponse

router = APIRouter(prefix="/api/v1/ai/predictions", tags=["AI Predictions"])


async def _resolve_explanation(prediction: Prediction, session: AsyncSession) -> dict:
    """Aciklamayi cache'ten / Gemini'den / deterministik yedekten cozer (ortak mantik)."""
    if prediction.explanation:
        generated_at = prediction.explanation_generated_at
        return {
            "assessmentId": prediction.id,
            "explanation": prediction.explanation,
            "source": "gemini",
            "generatedAt": generated_at.isoformat() if generated_at else None,
        }

    text = await generate_explanation(prediction)
    if text is not None:
        prediction.explanation = text
        prediction.explanation_generated_at = dt.datetime.now(dt.UTC).replace(tzinfo=None)
        await session.commit()
        return {
            "assessmentId": prediction.id,
            "explanation": text,
            "source": "gemini",
            "generatedAt": prediction.explanation_generated_at.isoformat(),
        }

    return {
        "assessmentId": prediction.id,
        "explanation": build_deterministic_summary(prediction),
        "source": "deterministic",
        "generatedAt": None,
    }


@router.get("/{assessment_id}", response_model=ApiEnvelope[PredictionResponse])
async def get_prediction(assessment_id: str, session: AsyncSession = Depends(get_session)) -> dict:
    prediction = await session.get(Prediction, assessment_id)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Tahmin bulunamadı.")

    return ok({
        "assessmentId": prediction.id,
        "transactionId": prediction.transaction_id,
        "riskScore": float(prediction.risk_score),
        "riskLevel": prediction.risk_level,
        "decision": prediction.decision,
        "fraudType": prediction.fraud_type,
        "reasonCodes": prediction.reason_codes,
        "predictedAt": prediction.predicted_at.isoformat(),
    })


@router.get("/{assessment_id}/explanation", response_model=ApiEnvelope[ExplanationResponse])
async def get_prediction_explanation(
    assessment_id: str, session: AsyncSession = Depends(get_session)
) -> dict:
    """Analiste yonelik dogal dil aciklamasi (lazy + cache).

    Onceden uretilmis metin varsa cache'ten doner. Yoksa Gemini denenir; basarili
    olursa kalici olarak yazilir. Gemini erisilemezse deterministik ozete dusulur
    (cache'e YAZILMAZ, boylece api_key sonradan eklendiginde tekrar denenir).
    """
    prediction = await session.get(Prediction, assessment_id)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Tahmin bulunamadı.")

    return ok(await _resolve_explanation(prediction, session))


@router.get(
    "/by-transaction/{transaction_id}/explanation",
    response_model=ApiEnvelope[ExplanationResponse],
)
async def get_explanation_by_transaction(
    transaction_id: str, session: AsyncSession = Depends(get_session)
) -> dict:
    """Vaka detay ekrani icin: islem kimliginden en guncel tahminin aciklamasi.

    Vaka gövdesi assessmentId tasimaz, yalnizca transactionId tasir; bu route o
    bosslugu kapatir. Ayni lazy + cache + deterministik-yedek mantigini kullanir.
    """
    result = await session.execute(
        select(Prediction)
        .where(Prediction.transaction_id == transaction_id)
        .order_by(Prediction.predicted_at.desc())
        .limit(1)
    )
    prediction = result.scalar_one_or_none()
    if prediction is None:
        raise HTTPException(status_code=404, detail="Bu işlem için tahmin bulunamadı.")

    return ok(await _resolve_explanation(prediction, session))
