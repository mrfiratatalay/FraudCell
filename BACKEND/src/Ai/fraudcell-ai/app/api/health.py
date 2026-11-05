"""Health endpoint'leri."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionFactory
from app.ml.model_registry import registry
from app.schemas.public import HealthLiveResponse, HealthReadyResponse

router = APIRouter(tags=["Health"])


@router.get("/health/live", response_model=HealthLiveResponse)
async def live() -> dict[str, str]:
    return {"status": "Healthy"}


@router.get("/health/ready", response_model=HealthReadyResponse)
async def ready() -> dict[str, object]:
    checks: dict[str, str] = {}

    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "Healthy"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"Unhealthy: {exc}"

    checks["model"] = "Healthy" if registry.is_ready else "Unhealthy"

    overall = "Healthy" if all(v == "Healthy" for v in checks.values()) else "Unhealthy"
    return {"status": overall, "checks": checks}
