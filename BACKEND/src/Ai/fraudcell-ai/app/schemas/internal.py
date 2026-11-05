"""Internal diagnostic score endpoint sema."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


class InternalScoreRequest(BaseModel):
    assessment_request_id: str = Field(alias="assessmentRequestId")
    transaction_id: str = Field(alias="transactionId")
    amount: float
    currency: str = "TRY"
    transaction_type: str = Field(alias="transactionType")
    city: str
    country_code: str = Field(alias="countryCode")
    occurred_at: dt.datetime = Field(alias="occurredAt")

    model_config = {"populate_by_name": True}
