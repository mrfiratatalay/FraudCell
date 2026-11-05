"""app.ml.explanation birim testleri.

Gemini erisilemedigi (api_key yok, timeout, hata) durumlarda katmanin None
donerek deterministik yedege dustugunu dogrular; boylece fraud karari asla
LLM'e bagimli olmaz.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from app.ml import explanation


@dataclass
class _FakePrediction:
    risk_level: str = "YUKSEK"
    decision: str = "INCELEME"
    fraud_type: str = "CALINTI_KART"
    reason_codes: list[dict[str, str]] = field(default_factory=list)


def test_deterministic_summary_lists_signals() -> None:
    prediction = _FakePrediction(
        reason_codes=[
            {"code": "NEW_DEVICE", "label": "İlk kez görülen cihaz", "impact": "HIGH"},
            {"code": "NIGHT_TRANSACTION", "label": "Gece saatinde işlem", "impact": "MEDIUM"},
        ]
    )

    summary = explanation.build_deterministic_summary(prediction)

    assert "İlk kez görülen cihaz" in summary
    assert "Gece saatinde işlem" in summary
    assert "INCELEME" in summary


def test_deterministic_summary_handles_nominal_only() -> None:
    prediction = _FakePrediction(
        risk_level="DUSUK",
        decision="ONAY",
        fraud_type="TEMIZ",
        reason_codes=[{"code": "NOMINAL_PATTERN", "label": "Sinyal yok", "impact": "LOW"}],
    )

    summary = explanation.build_deterministic_summary(prediction)

    assert "nominal" in summary.lower()
    assert "Sinyal yok" not in summary  # NOMINAL_PATTERN metne dahil edilmez


@pytest.mark.asyncio
async def test_generate_explanation_returns_none_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    # api_key bos => is_active False => hicbir ag cagrisi yapilmadan None doner.
    monkeypatch.setattr(explanation.settings.gemini, "api_key", "", raising=False)
    monkeypatch.setattr(explanation, "_client", None, raising=False)
    monkeypatch.setattr(explanation, "_client_ready", False, raising=False)

    assert await explanation.generate_explanation(_FakePrediction()) is None


@pytest.mark.asyncio
async def test_generate_explanation_returns_none_on_client_error(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BoomModels:
        async def generate_content(self, **_kwargs: object) -> object:
            raise RuntimeError("upstream down")

    class _BoomClient:
        aio = type("Aio", (), {"models": _BoomModels()})()

    monkeypatch.setattr(explanation, "_get_client", lambda: _BoomClient())

    # Hata yutulur ve deterministik yedege sinyal olarak None doner.
    assert await explanation.generate_explanation(_FakePrediction()) is None
