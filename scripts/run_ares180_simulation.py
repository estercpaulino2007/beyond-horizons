#!/usr/bin/env python3
"""CLI: run the daily simulation engine over the Ares-180 seed and save the
result as JSON.

Usage:
    python scripts/run_ares180_simulation.py [--output data/processed/ares180_simulation_result.json]

Output goes to data/processed/ by default, which is gitignored (see
docs/reproducibility.md): this is a *derived* artifact, fully reproducible
from the seed and the engine, not source data -- regenerate it rather than
hand-editing or committing it.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.notices import PLATFORM_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN  # noqa: E402
from app.domain.ares180_seed import build_ares180_dataset  # noqa: E402
from app.domain.risk_bands import band_for_risk  # noqa: E402
from app.services.simulation_engine import simulate_mission  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "data" / "processed" / "ares180_simulation_result.json",
        help="File to write the simulation result to (default: data/processed/ares180_simulation_result.json)",
    )
    args = parser.parse_args()

    dataset = build_ares180_dataset()
    results = simulate_mission(
        dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events
    )

    band_counts: dict[str, dict[str, int]] = {}
    for crew_id, trajectory in results.items():
        counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
        for r in trajectory:
            counts[r.band] += 1
        band_counts[crew_id] = counts

    payload = {
        "mission_id": dataset.mission.mission_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "platform_disclaimer": PLATFORM_DISCLAIMER,
        "synthetic_data_notice": SYNTHETIC_DATA_NOTICE_EN,
        "band_day_counts": band_counts,
        "results": {
            crew_id: [r.model_dump(mode="json") for r in trajectory]
            for crew_id, trajectory in results.items()
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Ran Ares-180 simulation for {len(results)} crew members, {dataset.mission.duration_days} days each.")
    print("Days per risk band:")
    for crew_id, counts in band_counts.items():
        print(f"  {crew_id:8s} " + " ".join(f"{band}={n}" for band, n in counts.items()))
    print(f"Wrote: {args.output.relative_to(REPO_ROOT) if REPO_ROOT in args.output.parents else args.output}")


if __name__ == "__main__":
    main()
