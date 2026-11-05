"""How a case's outcome grades the AI's prediction (case §4.3, §5.4, §7).

Ground truth, in order of strength:
  1. The customer's verification answer (case §4.5): "NOT_MINE" means fraud,
     "MINE" means a legitimate transaction.
  2. Otherwise the analyst's final decision: BLOCK means fraud, APPROVE means legitimate.

Fraud type: the type the case ends with is the truth. If an analyst or
supervisor changed the AI's type, the AI misclassified it (case §5.4).

Risk decision: only a BLOK prediction states "this is fraud" (and an ONAY
prediction "this is not"). INCELEME means "a human should decide", so it is
not graded as right or wrong. A BLOK on a legitimate transaction is a false positive.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from app.ml.decision_policy import Decision


@dataclass(frozen=True)
class FeedbackOutcome:
    is_fraud_type_correct: bool | None
    is_decision_agreement: bool | None
    is_false_positive: bool | None


def is_actual_fraud(final_decision: str | None, customer_response: str | None) -> bool | None:
    if customer_response == "NOT_MINE":
        return True
    if customer_response == "MINE":
        return False
    if final_decision == "BLOCK":
        return True
    if final_decision == "APPROVE":
        return False
    return None


def evaluate(
    ai_fraud_type: str | None,
    effective_fraud_type: str | None,
    ai_decision: str | None,
    final_decision: str | None,
    customer_response: str | None,
) -> FeedbackOutcome:
    type_correct = None if ai_fraud_type is None or effective_fraud_type is None else ai_fraud_type == effective_fraud_type

    actual = is_actual_fraud(final_decision, customer_response)
    ai_says_fraud = {Decision.BLOCK.value: True, Decision.APPROVE.value: False}.get(ai_decision or "")
    if actual is None or ai_says_fraud is None:
        return FeedbackOutcome(type_correct, None, None)

    return FeedbackOutcome(type_correct, ai_says_fraud == actual, ai_says_fraud and not actual)


def rate(values: Iterable[bool | None]) -> tuple[int, float | None]:
    """Share of True among the graded (non-None) values, and how many were graded."""
    graded = [v for v in values if v is not None]
    return len(graded), (round(sum(graded) / len(graded), 4) if graded else None)


@dataclass(frozen=True)
class CategoryMetrics:
    fraud_type: str
    sample_count: int  # cases the AI put in this type
    precision: float | None  # of those, how many really were this type
    recall: float | None  # of the cases really of this type, how many the AI found


def category_metrics(pairs: Iterable[tuple[str | None, str | None]]) -> list[CategoryMetrics]:
    """Per fraud type precision and recall from (AI type, final type) pairs."""
    known = [(ai, final) for ai, final in pairs if ai is not None and final is not None]
    types = sorted({ai for ai, _ in known} | {final for _, final in known})
    result = []
    for fraud_type in types:
        predicted = [final for ai, final in known if ai == fraud_type]
        actual_count = sum(1 for _, final in known if final == fraud_type)
        hits = sum(1 for final in predicted if final == fraud_type)
        result.append(CategoryMetrics(
            fraud_type=fraud_type,
            sample_count=len(predicted),
            precision=round(hits / len(predicted), 4) if predicted else None,
            recall=round(hits / actual_count, 4) if actual_count else None,
        ))
    return result
