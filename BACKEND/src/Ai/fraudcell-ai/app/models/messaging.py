"""Standart outbox/inbox tablolari.

.NET tarafindaki FraudCell.BuildingBlocks ile ayni mantiksal semaya sahiptir;
boylece outbox publisher worker'i ve retry/DLQ davranisi tum servislerde tutarlidir.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OutboxMessage(Base):
    __tablename__ = "outbox_messages"
    __table_args__ = (
        Index("ix_outbox_pending", "next_attempt_at", "occurred_at", postgresql_where="published_at IS NULL"),
        {"schema": "ai"},
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(26), unique=True)
    event_type: Mapped[str] = mapped_column(String(150))
    event_version: Mapped[int] = mapped_column(Integer, default=1)
    routing_key: Mapped[str] = mapped_column(String(200))
    payload: Mapped[dict] = mapped_column(JSON)
    headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    subject_id: Mapped[str] = mapped_column(String(64))
    correlation_id: Mapped[str] = mapped_column(String(64))
    causation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    producer: Mapped[str] = mapped_column(String(50), default="ai-service")
    occurred_at: Mapped[dt.datetime] = mapped_column()
    created_at: Mapped[dt.datetime] = mapped_column()
    published_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    locked_until: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    lock_owner: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class InboxMessage(Base):
    __tablename__ = "inbox_messages"
    __table_args__ = (
        Index("ix_inbox_processed_at", "processed_at"),
        {"schema": "ai"},
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    consumer_name: Mapped[str] = mapped_column(String(100), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100))
    event_version: Mapped[int] = mapped_column(Integer, default=1)
    payload_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PROCESSED")
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[dt.datetime] = mapped_column()
    correlation_id: Mapped[str] = mapped_column(String(64))
