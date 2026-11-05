"""<c>/api/v1/ai/models/*</c> (dokuman `07-API-DESIGN.md` §54-55)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.envelope import ok
from app.database import get_session
from app.models.ai import ModelBundle, ModelVersion
from app.schemas.public import ActiveModelResponse, ApiEnvelope, ModelVersionResponse

router = APIRouter(prefix="/api/v1/ai/models", tags=["AI Models"])


@router.get("/active", response_model=ApiEnvelope[ActiveModelResponse])
async def get_active_bundle(session: AsyncSession = Depends(get_session)) -> dict:
    bundle = (await session.execute(select(ModelBundle).where(ModelBundle.status == "ACTIVE"))).scalar_one_or_none()
    if bundle is None:
        raise HTTPException(status_code=404, detail="Aktif model bundle bulunamadı.")

    risk = await session.get(ModelVersion, bundle.risk_model_id)
    fraud_type = await session.get(ModelVersion, bundle.fraud_type_model_id)

    return ok({
        "bundleVersion": bundle.bundle_version,
        "riskModel": {
            "version": risk.semantic_version if risk else None,
            "algorithm": risk.algorithm if risk else None,
            "calibrated": True,
        },
        "fraudTypeModel": {
            "version": fraud_type.semantic_version if fraud_type else None,
            "algorithm": fraud_type.algorithm if fraud_type else None,
        },
        "activatedAt": bundle.activated_at.isoformat() if bundle.activated_at else None,
    })


@router.get("/{model_version}", response_model=ApiEnvelope[ModelVersionResponse])
async def get_model_version(model_version: str, session: AsyncSession = Depends(get_session)) -> dict:
    version = (
        await session.execute(select(ModelVersion).where(ModelVersion.semantic_version == model_version))
    ).scalar_one_or_none()

    if version is None:
        raise HTTPException(status_code=404, detail="Model versiyonu bulunamadı.")

    return ok({
        "version": version.semantic_version,
        "modelKind": version.model_kind,
        "algorithm": version.algorithm,
        "status": version.status,
        "metrics": version.metrics,
        "createdAt": version.created_at.isoformat(),
        "activatedAt": version.activated_at.isoformat() if version.activated_at else None,
    })
