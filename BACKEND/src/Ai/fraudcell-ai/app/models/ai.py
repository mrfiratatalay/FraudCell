"""AI Database domain tablolari."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (UniqueConstraint("name", "version"), {"schema": "ai"})

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    version: Mapped[str] = mapped_column(String(50))
    record_count: Mapped[int] = mapped_column(Integer)
    class_distribution: Mapped[dict] = mapped_column(JSON)
    generator_version: Mapped[str] = mapped_column(String(50))
    random_seed: Mapped[int] = mapped_column(Integer)
    source_type: Mapped[str] = mapped_column(String(20), default="SYNTHETIC")
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    data_checksum: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[dt.datetime] = mapped_column()


class TrainingRun(Base):
    __tablename__ = "training_runs"
    __table_args__ = {"schema": "ai"}

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.datasets.id"))
    run_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    algorithm: Mapped[str] = mapped_column(String(100))
    parameters: Mapped[dict] = mapped_column(JSON)
    train_record_count: Mapped[int] = mapped_column(Integer)
    validation_record_count: Mapped[int] = mapped_column(Integer)
    test_record_count: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[dt.datetime] = mapped_column()
    completed_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source_commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column()


class ModelVersion(Base):
    __tablename__ = "model_versions"
    __table_args__ = (
        UniqueConstraint("model_kind", "semantic_version"),
        Index("ux_model_versions_active_kind", "model_kind", unique=True, postgresql_where="status = 'ACTIVE'"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    model_kind: Mapped[str] = mapped_column(String(20))
    semantic_version: Mapped[str] = mapped_column(String(50))
    training_run_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("ai.training_runs.id"), nullable=True)
    algorithm: Mapped[str] = mapped_column(String(100))
    artifact_path: Mapped[str] = mapped_column(String(500))
    artifact_sha256: Mapped[str] = mapped_column(String(128))
    feature_schema_version: Mapped[int] = mapped_column(Integer, default=1)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="CREATED")
    created_at: Mapped[dt.datetime] = mapped_column()
    activated_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    retired_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)


class ModelBundle(Base):
    __tablename__ = "model_bundles"
    __table_args__ = (
        Index("ux_model_bundles_active", "status", unique=True, postgresql_where="status = 'ACTIVE'"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    bundle_version: Mapped[str] = mapped_column(String(100), unique=True)
    risk_model_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.model_versions.id"))
    fraud_type_model_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.model_versions.id"))
    status: Mapped[str] = mapped_column(String(20), default="CREATED")
    activated_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    retired_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column()


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("source_event_id"),
        UniqueConstraint("transaction_id", "model_bundle_id"),
        Index("ix_predictions_transaction", "transaction_id", "predicted_at"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(26))
    source_event_id: Mapped[str] = mapped_column(String(26))
    correlation_id: Mapped[str] = mapped_column(String(64))
    model_bundle_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.model_bundles.id"))
    risk_score: Mapped[float] = mapped_column(Numeric(6, 5))
    risk_level: Mapped[str] = mapped_column(String(20))
    decision: Mapped[str] = mapped_column(String(20))
    fraud_type: Mapped[str] = mapped_column(String(40))
    feature_snapshot: Mapped[dict] = mapped_column(JSON)
    reason_codes: Mapped[list] = mapped_column(JSON)
    # Gemini aciklama anlatisi (lazy uretilir + cache'lenir; skorlamayi etkilemez).
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation_generated_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    predicted_at: Mapped[dt.datetime] = mapped_column()
    created_at: Mapped[dt.datetime] = mapped_column()


class AssignmentRecommendation(Base):
    __tablename__ = "assignment_recommendations"
    __table_args__ = (UniqueConstraint("prediction_id"), {"schema": "ai"})

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    prediction_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.predictions.id"))
    transaction_id: Mapped[str] = mapped_column(String(26))
    fraud_type: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[dt.datetime] = mapped_column()


class AssignmentRecommendationCandidate(Base):
    __tablename__ = "assignment_recommendation_candidates"
    __table_args__ = (
        UniqueConstraint("recommendation_id", "analyst_id"),
        UniqueConstraint("recommendation_id", "rank"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    recommendation_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.assignment_recommendations.id"))
    analyst_id: Mapped[str] = mapped_column(String(26))
    rank: Mapped[int] = mapped_column(Integer)
    total_score: Mapped[float] = mapped_column(Numeric(6, 5))
    expertise_score: Mapped[float] = mapped_column(Numeric(6, 5))
    capacity_score: Mapped[float] = mapped_column(Numeric(6, 5))
    performance_score: Mapped[float] = mapped_column(Numeric(6, 5))
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column()


class AnalystProfileProjection(Base):
    __tablename__ = "analyst_profile_projection"
    __table_args__ = {"schema": "ai"}

    analyst_id: Mapped[str] = mapped_column(String(26), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    assignment_enabled: Mapped[bool] = mapped_column(default=True)
    specialties: Mapped[list] = mapped_column(JSON, default=list)
    regions: Mapped[list] = mapped_column(JSON, default=list)
    identity_profile_version: Mapped[int] = mapped_column(Integer, default=1)
    last_source_event_id: Mapped[str | None] = mapped_column(String(26), nullable=True)
    source_updated_at: Mapped[dt.datetime] = mapped_column()
    projection_updated_at: Mapped[dt.datetime] = mapped_column()


class AnalystWorkloadProjection(Base):
    __tablename__ = "analyst_workload_projection"
    __table_args__ = {"schema": "ai"}

    analyst_id: Mapped[str] = mapped_column(String(26), primary_key=True)
    active_case_count: Mapped[int] = mapped_column(Integer, default=0)
    last_assigned_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    source_version: Mapped[int] = mapped_column(Integer, default=0)
    last_source_event_id: Mapped[str | None] = mapped_column(String(26), nullable=True)
    projection_updated_at: Mapped[dt.datetime] = mapped_column()


class AnalystPerformanceProjection(Base):
    __tablename__ = "analyst_performance_projection"
    __table_args__ = {"schema": "ai"}

    analyst_id: Mapped[str] = mapped_column(String(26), primary_key=True)
    total_decisions: Mapped[int] = mapped_column(Integer, default=0)
    correct_decisions: Mapped[int] = mapped_column(Integer, default=0)
    false_positive_count: Mapped[int] = mapped_column(Integer, default=0)
    sla_compliant_count: Mapped[int] = mapped_column(Integer, default=0)
    average_decision_seconds: Mapped[float | None] = mapped_column(nullable=True)
    performance_score: Mapped[float] = mapped_column(Numeric(6, 5), default=0.50)
    last_source_event_id: Mapped[str | None] = mapped_column(String(26), nullable=True)
    projection_updated_at: Mapped[dt.datetime] = mapped_column()


class PredictionFeedback(Base):
    __tablename__ = "prediction_feedback"
    __table_args__ = (UniqueConstraint("source_event_id"), {"schema": "ai"})

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    prediction_id: Mapped[str | None] = mapped_column(String(26), ForeignKey("ai.predictions.id"), nullable=True)
    transaction_id: Mapped[str] = mapped_column(String(26))
    case_id: Mapped[str | None] = mapped_column(String(26), nullable=True)
    ai_fraud_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    effective_fraud_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ai_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    final_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    customer_response: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_fraud_type_correct: Mapped[bool | None] = mapped_column(nullable=True)
    is_decision_agreement: Mapped[bool | None] = mapped_column(nullable=True)
    is_false_positive: Mapped[bool | None] = mapped_column(nullable=True)
    feedback_source: Mapped[str] = mapped_column(String(30))
    source_event_id: Mapped[str] = mapped_column(String(26))
    occurred_at: Mapped[dt.datetime] = mapped_column()
    created_at: Mapped[dt.datetime] = mapped_column()


class ModelMetricSnapshot(Base):
    __tablename__ = "model_metric_snapshots"
    __table_args__ = (
        UniqueConstraint("model_bundle_id", "metric_scope", "category", "period_start", "period_end"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    model_bundle_id: Mapped[str] = mapped_column(String(26), ForeignKey("ai.model_bundles.id"))
    metric_scope: Mapped[str] = mapped_column(String(20))
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(nullable=True)
    precision: Mapped[float | None] = mapped_column(nullable=True)
    recall: Mapped[float | None] = mapped_column(nullable=True)
    f1_score: Mapped[float | None] = mapped_column(nullable=True)
    false_positive_rate: Mapped[float | None] = mapped_column(nullable=True)
    decision_agreement_rate: Mapped[float | None] = mapped_column(nullable=True)
    calculated_at: Mapped[dt.datetime] = mapped_column()
    period_start: Mapped[dt.datetime] = mapped_column()
    period_end: Mapped[dt.datetime] = mapped_column()
