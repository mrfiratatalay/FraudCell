"""app.ml.decision_policy boundary testleri.

Esik degerlerinin tam sinirlarda dogru karar/risk seviyesi urettigini dogrular;
ozellikle tam 0.90'in BLOK OLMADIGINI (case kurali `> 0.90`).
"""

from __future__ import annotations

import pytest

from app.ml.decision_policy import Decision, RiskLevel, evaluate_risk


@pytest.mark.parametrize(
    ("score", "decision", "risk_level"),
    [
        (0.0000, Decision.APPROVE, RiskLevel.LOW),
        (0.3999, Decision.APPROVE, RiskLevel.LOW),
        (0.4000, Decision.REVIEW, RiskLevel.MEDIUM),
        (0.7000, Decision.REVIEW, RiskLevel.MEDIUM),
        (0.7001, Decision.REVIEW, RiskLevel.HIGH),
        (0.9000, Decision.REVIEW, RiskLevel.HIGH),   # tam 0.90 BLOK DEGIL
        (0.9001, Decision.BLOCK, RiskLevel.CRITICAL),
        (1.0000, Decision.BLOCK, RiskLevel.CRITICAL),
    ],
)
def test_evaluate_risk_boundaries(score: float, decision: Decision, risk_level: RiskLevel) -> None:
    result = evaluate_risk(score)
    assert result.decision == decision
    assert result.risk_level == risk_level


def test_exactly_090_is_not_block() -> None:
    # Case kurali `> 0.90` oldugu icin tam 0.90 asla BLOK olmamali.
    assert evaluate_risk(0.90).decision == Decision.REVIEW


@pytest.mark.parametrize("score", [-0.01, 1.01, 2.0, -5.0])
def test_evaluate_risk_rejects_out_of_range(score: float) -> None:
    with pytest.raises(ValueError):
        evaluate_risk(score)


def test_strenum_serializes_as_plain_string() -> None:
    # DB kolonu / JSON payload string bekliyor; StrEnum str alt sinifidir.
    result = evaluate_risk(0.95)
    assert result.decision == "BLOK"
    assert result.risk_level == "KRITIK"
