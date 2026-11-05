"""Grading AI predictions against case outcomes (app/ml/feedback.py)."""

from __future__ import annotations

import pytest

from app.ml.feedback import CategoryMetrics, category_metrics, evaluate, is_actual_fraud, rate


@pytest.mark.parametrize(
    ("final_decision", "customer_response", "expected"),
    [
        ("BLOCK", None, True),
        ("APPROVE", None, False),
        ("APPROVE", "NOT_MINE", True),   # the customer's answer outranks the decision
        ("BLOCK", "MINE", False),
        (None, None, None),
    ],
)
def test_ground_truth_prefers_the_customer_answer(final_decision: str | None, customer_response: str | None,
                                                  expected: bool | None) -> None:
    assert is_actual_fraud(final_decision, customer_response) == expected


def test_changed_fraud_type_is_a_misclassification() -> None:
    assert evaluate("CALINTI_KART", "HESAP_ELE_GECIRME", "INCELEME", None, None).is_fraud_type_correct is False
    assert evaluate("CALINTI_KART", "CALINTI_KART", "INCELEME", None, None).is_fraud_type_correct is True


def test_block_on_a_transaction_the_customer_owned_is_a_false_positive() -> None:
    outcome = evaluate("CALINTI_KART", "CALINTI_KART", "BLOK", "BLOCK", "MINE")

    assert outcome.is_decision_agreement is False
    assert outcome.is_false_positive is True


def test_block_confirmed_by_the_customer_agrees() -> None:
    outcome = evaluate("CALINTI_KART", "CALINTI_KART", "BLOK", "BLOCK", "NOT_MINE")

    assert outcome.is_decision_agreement is True
    assert outcome.is_false_positive is False


def test_review_band_is_not_graded() -> None:
    outcome = evaluate("PARA_AKLAMA", "PARA_AKLAMA", "INCELEME", "BLOCK", None)

    assert outcome.is_decision_agreement is None
    assert outcome.is_false_positive is None


def test_rate_ignores_ungraded_rows() -> None:
    assert rate([True, False, None, True]) == (3, 0.6667)
    assert rate([None]) == (0, None)


def test_category_metrics_give_precision_and_recall_per_type() -> None:
    pairs = [
        ("CALINTI_KART", "CALINTI_KART"),
        ("CALINTI_KART", "CALINTI_KART"),
        ("CALINTI_KART", "HESAP_ELE_GECIRME"),  # AI said stolen card, it was a takeover
        ("HESAP_ELE_GECIRME", "HESAP_ELE_GECIRME"),
        (None, "PARA_AKLAMA"),                  # no prediction (AI was down): not graded
    ]

    assert category_metrics(pairs) == [
        CategoryMetrics("CALINTI_KART", sample_count=3, precision=0.6667, recall=1.0),
        CategoryMetrics("HESAP_ELE_GECIRME", sample_count=1, precision=1.0, recall=0.5),
    ]
