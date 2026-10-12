"""In-memory catalog of missions this MVP can serve via the API.

Only Ares-180 exists today (the "full universal simulator" from the
data-package specification is explicitly out of MVP scope -- see
docs/methodology.md). When a second scenario is added, register it here
rather than hardcoding mission_id checks throughout the API layer.
"""

from app.domain.ares180_seed import Ares180Dataset, build_ares180_dataset

_BUILDERS = {
    "ares-180": build_ares180_dataset,
}


def available_mission_ids() -> list[str]:
    return sorted(_BUILDERS)


def get_mission_dataset(mission_id: str) -> Ares180Dataset | None:
    """Returns the dataset for mission_id, or None if it isn't known.

    Rebuilds the dataset on every call (the seed is deterministic and cheap
    to construct -- see app/domain/ares180_seed.py) rather than caching, so
    a request always reflects the current code.
    """
    builder = _BUILDERS.get(mission_id)
    return builder() if builder else None
