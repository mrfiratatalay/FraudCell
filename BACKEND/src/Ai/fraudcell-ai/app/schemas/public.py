"""Public HTTP response models used by FastAPI's OpenAPI document."""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiMeta(BaseModel):
    traceId: str
    generatedAt: str | None = None


class ApiEnvelope(BaseModel, Generic[T]):
    success: Literal[True]
    data: T
    error: None = None
    meta: ApiMeta


class HealthLiveResponse(BaseModel):
    status: str


class HealthReadyResponse(BaseModel):
    status: str
    checks: dict[str, str]


class RiskModelResponse(BaseModel):
    version: str | None
    algorithm: str | None
    calibrated: bool


class FraudTypeModelResponse(BaseModel):
    version: str | None
    algorithm: str | None


class ActiveModelResponse(BaseModel):
    bundleVersion: str
    riskModel: RiskModelResponse
    fraudTypeModel: FraudTypeModelResponse
    activatedAt: str | None


class ModelVersionResponse(BaseModel):
    version: str
    modelKind: str
    algorithm: str
    status: str
    metrics: dict[str, Any]
    createdAt: str
    activatedAt: str | None


class MetricsOverviewResponse(BaseModel):
    sampleCount: int
    fraudTypeAccuracy: float | None
    decisionAgreementRate: float | None
    falsePositiveRate: float | None
    totalPredictions: int
    modelBundleVersion: str | None
    calculatedAt: str


class CategoryAccuracyItemResponse(BaseModel):
    fraudType: str
    sampleCount: int
    accuracy: float | None
    precision: float | None
    recall: float | None


class CategoryAccuracyResponse(BaseModel):
    items: list[CategoryAccuracyItemResponse]


class DecisionAgreementResponse(BaseModel):
    sampleCount: int
    decisionAgreementRate: float | None


class ReasonCodeResponse(BaseModel):
    code: str
    label: str
    impact: Literal["HIGH", "MEDIUM", "LOW"]


class ExplanationResponse(BaseModel):
    assessmentId: str
    explanation: str
    source: Literal["gemini", "deterministic"]
    generatedAt: str | None


class PredictionResponse(BaseModel):
    assessmentId: str
    transactionId: str
    riskScore: float
    riskLevel: Literal["DUSUK", "ORTA", "YUKSEK", "KRITIK"]
    decision: Literal["ONAY", "INCELEME", "BLOK"]
    fraudType: Literal[
        "CALINTI_KART",
        "HESAP_ELE_GECIRME",
        "PARA_AKLAMA",
        "SUPHELI_DAVRANIS",
        "TEMIZ",
    ]
    reasonCodes: list[ReasonCodeResponse]
    predictedAt: str
