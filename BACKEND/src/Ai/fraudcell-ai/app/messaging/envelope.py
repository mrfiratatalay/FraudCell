"""Standart event zarfi.

.NET tarafindaki EventEnvelope ile alan alan ayni: eventId, eventType,
eventVersion, occurredAt, producer, correlationId, causationId, subjectId, payload.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import BaseModel, Field


class EventEnvelope(BaseModel):
    event_id: str = Field(alias="eventId")
    event_type: str = Field(alias="eventType")
    event_version: int = Field(alias="eventVersion")
    occurred_at: dt.datetime = Field(alias="occurredAt")
    producer: str
    correlation_id: str = Field(alias="correlationId")
    causation_id: str | None = Field(default=None, alias="causationId")
    subject_id: str = Field(alias="subjectId")
    payload: dict[str, Any]

    model_config = {"populate_by_name": True}
