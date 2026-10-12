#!/usr/bin/env python3
"""CLI: generate the Ares-180 seed files into data/synthetic/.

Usage:
    python scripts/seed_ares180.py [--output-dir data/synthetic]

The actual generation logic lives in backend/app/domain/ares180_seed.py
(and its serializer, ares180_seed_io.py) so it can be unit-tested with
pytest without going through this CLI. This script only wires that logic
to argv and prints a human-readable summary.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.domain.ares180_seed import (  # noqa: E402
    EVA_ORIGINAL_CREW_ID,
    RNG_SEED,
    build_ares180_dataset,
)
from app.domain.ares180_seed_io import write_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "data" / "synthetic",
        help="Directory to write the four JSON files into (default: data/synthetic)",
    )
    args = parser.parse_args()

    dataset = build_ares180_dataset()
    written = write_dataset(dataset, args.output_dir)

    print(f"Ares-180 seed generated (RNG_SEED={RNG_SEED}, deterministic).")
    print(f"  Mission: {dataset.mission.mission_name} ({dataset.mission.duration_days} days)")
    print(f"  Crew: {', '.join(c.display_name for c in dataset.crew_profiles)}")
    print(f"  Events: {len(dataset.events)} (radiation storm, exercise failure, comm delay, EVA)")
    print(f"    EVA on day 145 originally assigned to: {EVA_ORIGINAL_CREW_ID}")
    print(f"  Daily exposures: {len(dataset.daily_exposures)} records")
    print("  All data is synthetic; see docs/limitations.md.")
    print("Wrote:")
    for path in written:
        try:
            shown = path.relative_to(REPO_ROOT)
        except ValueError:
            shown = path
        print(f"  {shown}")


if __name__ == "__main__":
    main()
