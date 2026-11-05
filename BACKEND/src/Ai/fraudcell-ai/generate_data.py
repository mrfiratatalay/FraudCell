"""Writes the AI training data and the Turkish scenario set into data/ (case §5.1).

Both files are committed, so anyone can read exactly what the model learned from.
Generation is deterministic (fixed seed, no clock), and a test checks that the
committed files match a fresh run:

    uv run --group training python generate_data.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from app.ml.scenarios import SCENARIO_COLUMNS, scenario_rows  # noqa: E402
from app.ml.schema import RANDOM_SEED  # noqa: E402
from app.ml.synthetic_data import generate_dataset  # noqa: E402

DATA_DIR = Path(__file__).parent / "data"
TRAINING_DATA = DATA_DIR / "training_data.csv"
SCENARIOS = DATA_DIR / "scenarios_tr.csv"
TRAINING_SAMPLES = 10_000


def training_csv() -> str:
    return generate_dataset(n_samples=TRAINING_SAMPLES, seed=RANDOM_SEED).to_csv(index=False, lineterminator="\n")


def scenarios_csv() -> str:
    return pd.DataFrame(scenario_rows(), columns=SCENARIO_COLUMNS).to_csv(index=False, lineterminator="\n")


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    TRAINING_DATA.write_text(training_csv(), encoding="utf-8")
    SCENARIOS.write_text(scenarios_csv(), encoding="utf-8")
    print(f"Wrote {TRAINING_DATA} and {SCENARIOS}")


if __name__ == "__main__":
    main()
