"""Merkezi karar politikasi.

Risk skoru -> (karar, risk seviyesi) esiklemesinin TEK kaynagidir. Daha once bu
mantik hem event consumer'da hem internal router'da kopyaliydi; esik degistirmek
iki yeri birden guncellemeyi gerektiriyordu. Artik tek yerden gelir.

Esikler (case zorunlulugu):
    score < 0.40           -> ONAY   / DUSUK
    0.40 <= score <= 0.70  -> INCELEME / ORTA
    0.70 <  score <= 0.90  -> INCELEME / YUKSEK
    score > 0.90           -> BLOK   / KRITIK   (tam 0.90 BLOK DEGILDIR)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Decision(StrEnum):
    APPROVE = "ONAY"
    REVIEW = "INCELEME"
    BLOCK = "BLOK"


class RiskLevel(StrEnum):
    LOW = "DUSUK"
    MEDIUM = "ORTA"
    HIGH = "YUKSEK"
    CRITICAL = "KRITIK"


@dataclass(frozen=True)
class DecisionResult:
    decision: Decision
    risk_level: RiskLevel


def evaluate_risk(score: float) -> DecisionResult:
    """Risk skorunu (0.0-1.0) karar + risk seviyesine cevirir."""
    if not 0.0 <= score <= 1.0:
        raise ValueError(f"Risk skoru 0 ile 1 arasinda olmalidir: {score}")

    if score < 0.40:
        return DecisionResult(Decision.APPROVE, RiskLevel.LOW)
    if score <= 0.70:
        return DecisionResult(Decision.REVIEW, RiskLevel.MEDIUM)
    if score <= 0.90:
        return DecisionResult(Decision.REVIEW, RiskLevel.HIGH)
    return DecisionResult(Decision.BLOCK, RiskLevel.CRITICAL)
