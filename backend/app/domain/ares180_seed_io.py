"""Serializes an Ares180Dataset (app.domain.ares180_seed) into the four
JSON files the specification asks for, each wrapped with the mandatory
synthetic-data notice.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.core.notices import SYNTHETIC_DATA_NOTICE_EN
from app.domain.ares180_seed import Ares180Dataset, EVA_ORIGINAL_CREW_ID, RNG_SEED


def _bundle(mission_id: str, **payload: Any) -> dict[str, Any]:
    return {
        "mission_id": mission_id,
        "synthetic_data_notice": SYNTHETIC_DATA_NOTICE_EN,
        **payload,
    }


def to_file_payloads(dataset: Ares180Dataset) -> dict[str, dict[str, Any]]:
    """Returns {filename: json-serializable dict} for the four seed files."""
    mission_id = dataset.mission.mission_id
    return {
        "mission_ares180.json": dataset.mission.model_dump(mode="json"),
        "crew_profiles.json": _bundle(
            mission_id,
            crew_profiles=[c.model_dump(mode="json") for c in dataset.crew_profiles],
        ),
        "mission_events.json": _bundle(
            mission_id,
            events=[e.model_dump(mode="json") for e in dataset.events],
        ),
        "daily_exposures.json": _bundle(
            mission_id,
            daily_exposures=[d.model_dump(mode="json") for d in dataset.daily_exposures],
            notes={
                "radiation_dose": "Normalised 0-1 scale (synthetic_parameter, not mSv)",
                "sleep_hours": "Synthetic per-day value",
                "exercise_duration_min": "0 on days the exercise module is unavailable (143-154)",
                "eva_load": (
                    "0 on non-EVA days; on day 145, only the originally assigned crew "
                    f"member ({EVA_ORIGINAL_CREW_ID}) has a nonzero value in this seed"
                ),
                "operational_workload": "Synthetic 0-1 scenario score",
                "co2_level_ppm": "Synthetic cabin CO2 concentration",
                "generation": (
                    f"Deterministic: app.domain.ares180_seed.build_daily_exposures, "
                    f"random.Random(RNG_SEED={RNG_SEED}), consumed in a fixed (day, crew) order. "
                    "Re-running the seed script reproduces this file byte-for-byte."
                ),
                "synthetic": "All values are synthetic for demonstration",
            },
        ),
    }


def write_dataset(dataset: Ares180Dataset, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for filename, payload in to_file_payloads(dataset).items():
        path = output_dir / filename
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written.append(path)
    return written
