"""The training data and the Turkish scenarios are committed (case §5.1); these
tests keep the files honest: they are what generate_data.py produces, and the
scenario set covers what the case asks for."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

import generate_data
from app.ml.schema import FEATURE_COLUMNS, FRAUD_TYPE_CLASSES

DATA = Path(__file__).resolve().parent.parent / "data"


def test_committed_training_data_matches_the_generator() -> None:
    assert (DATA / "training_data.csv").read_text(encoding="utf-8") == generate_data.training_csv()


def test_committed_scenarios_match_the_templates() -> None:
    assert (DATA / "scenarios_tr.csv").read_text(encoding="utf-8") == generate_data.scenarios_csv()


def test_scenarios_cover_every_class_with_turkish_descriptions() -> None:
    scenarios = pd.read_csv(DATA / "scenarios_tr.csv")

    assert len(scenarios) >= 100
    assert set(scenarios["fraud_type"]) == set(FRAUD_TYPE_CLASSES)
    assert scenarios["scenario_id"].is_unique
    assert scenarios["description"].str.len().min() > 20
    assert (scenarios["is_fraud"] == (scenarios["fraud_type"] != "TEMIZ")).all()


def test_scenario_features_are_consistent() -> None:
    scenarios = pd.read_csv(DATA / "scenarios_tr.csv")
    hours = scenarios["hour_of_day"]

    assert list(scenarios.columns[2:-2]) == FEATURE_COLUMNS
    assert (scenarios["is_night"] == ((hours < 6) | (hours >= 23)).astype(float)).all()
    one_hot = scenarios[[c for c in FEATURE_COLUMNS if c.startswith("transaction_type_")]]
    assert (one_hot.sum(axis=1) == 1).all()
