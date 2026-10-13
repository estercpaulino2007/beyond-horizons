"""Applies the optional SimulationRunRequest overrides (crew traits, mission
parameters, which scripted events are active) on top of a mission's seed
dataset, producing the scenario simulate_mission actually runs.

This module never touches app/domain/ares180_seed.py itself, which must stay
a pure, deterministic description of the project's own canonical Ares-180
scenario. Every override here only replaces one of the seed's own,
already-synthetic values with another caller-chosen value in the same
[0,1]/physical range -- no new evidence claim is made or implied by any of
this; a customized run is still exploratory_hypothesis/synthetic_parameter
data (docs/methodology.md), never a new source of truth.
"""

from __future__ import annotations

from app.domain.ares180_seed import EVA_ORIGINAL_CREW_ID, build_daily_exposures
from app.schemas.api import CrewOverride, MissionOverride
from app.schemas.crew import CrewBaseline, CrewProfile
from app.schemas.events import SimulationEvent
from app.schemas.exposure import DailyExposure
from app.schemas.mission import Destination, MissionConfig

# (this module's own choice) A representative surface gravity per surface
# destination, used only when a MissionOverride switches `destination` to a
# surface destination without also specifying `gravity_g`. These match the
# figures NASA commonly cites for these bodies (Moon ~0.166g, Mars ~0.38g)
# but are not derived from any source registered in docs/data-sources.md, so
# they are treated as a synthetic_parameter default, like every other number
# in this scenario -- not a cited figure.
_DEFAULT_SURFACE_GRAVITY: dict[str, float] = {
    "lunar_orbital_surface": 0.166,
    "mars_surface": 0.38,
}

_MICROGRAVITY_DESTINATIONS = {"low_earth_orbit", "lunar_orbital", "mars_transit"}


def resolve_gravity(destination: Destination, requested: float | None) -> float:
    """Mirrors MissionConfig's own gravity/destination validator: an
    orbital/transit destination is always microgravity (0.0) regardless of
    what was requested; a surface destination uses the requested value if
    given, otherwise this module's representative default for that body.
    """
    if destination in _MICROGRAVITY_DESTINATIONS:
        return 0.0
    if requested is not None:
        return requested
    return _DEFAULT_SURFACE_GRAVITY[destination]


def apply_mission_overrides(mission: MissionConfig, overrides: MissionOverride | None) -> MissionConfig:
    if overrides is None:
        return mission
    destination = overrides.destination or mission.destination
    return MissionConfig(
        mission_id=mission.mission_id,
        mission_name=mission.mission_name,
        destination=destination,
        duration_days=overrides.duration_days or mission.duration_days,
        crew_size=mission.crew_size,
        gravity_g=resolve_gravity(destination, overrides.gravity_g),
        communication_delay_minutes=(
            overrides.communication_delay_minutes
            if overrides.communication_delay_minutes is not None
            else mission.communication_delay_minutes
        ),
    )


def _merged_baseline(baseline: CrewBaseline, override) -> dict:
    data = baseline.model_dump()
    if override is not None:
        for field, value in override.model_dump(exclude_unset=True).items():
            if value is not None:
                data[field] = value
    return data


def apply_crew_overrides(crew_profiles: list[CrewProfile], overrides: list[CrewOverride]) -> list[CrewProfile]:
    """Returns a new crew list with any matching override's display_name and
    baseline traits merged in (unset fields keep the seed default). An
    override whose id does not match any seed crew member is ignored rather
    than rejected, so a caller can send a stale id without the whole run
    failing.
    """
    overrides_by_id = {o.id: o for o in overrides}
    result: list[CrewProfile] = []
    for crew in crew_profiles:
        override = overrides_by_id.get(crew.id)
        if override is None:
            result.append(crew)
            continue
        data = crew.model_dump()
        data["display_name"] = override.display_name or crew.display_name
        data["baseline"] = _merged_baseline(crew.baseline, override.baseline)
        result.append(CrewProfile(**data))
    return result


def apply_event_filter(
    events: list[SimulationEvent], active_event_ids: list[str] | None
) -> list[SimulationEvent]:
    """None means "all of the mission's default events" (unchanged
    behaviour); a list (possibly empty) selects exactly those event ids.
    """
    if active_event_ids is None:
        return events
    allowed = set(active_event_ids)
    return [e for e in events if e.id in allowed]


def rebuild_daily_exposures(
    crew_profiles: list[CrewProfile],
    mission: MissionConfig,
    events: list[SimulationEvent],
) -> list[DailyExposure]:
    """Regenerates per-day exposure records for a (possibly overridden) crew
    list, mission duration and set of active events. Still uses the seed's
    own deterministic exposure formula (app/domain/ares180_seed.py) -- a
    customized run changes *which* days carry a storm/equipment-failure/EVA
    and for how long, never the formula itself.
    """
    total_days = mission.duration_days

    def _day_or_past_range(event_type: str, default_start: int, default_end: int | None = None) -> tuple[int, int]:
        event = next((e for e in events if e.type == event_type), None)
        if event is None:
            # Excluded from this run: push it past the simulated range so
            # build_daily_exposures never marks any day as that event's day.
            past = total_days + 1
            return past, past
        return event.day_start, event.day_end

    storm_day, _ = _day_or_past_range("radiation_storm", 0)
    failure_start, failure_end = _day_or_past_range("equipment_failure", 0, 0)
    eva_day, _ = _day_or_past_range("eva", 0)

    # CrewOverride never changes a crew member's id (only display_name and
    # baseline traits), so the seed's own EVA assignment -- Atlas, in
    # app/domain/ares180_seed.py -- is still valid for a customized crew.
    # If Atlas was removed entirely from crew_profiles, pass a non-matching
    # id: build_daily_exposures then simply never sets eva_load for anyone,
    # which is the correct behaviour (no one is doing that EVA).
    known_ids = {c.id for c in crew_profiles}
    eva_crew_id = EVA_ORIGINAL_CREW_ID if EVA_ORIGINAL_CREW_ID in known_ids else "__no_eva_crew__"

    return build_daily_exposures(
        crew_profiles,
        eva_day=eva_day,
        eva_crew_id=eva_crew_id,
        total_days=total_days,
        exercise_failure_start_day=failure_start,
        exercise_failure_end_day=failure_end,
        radiation_storm_day=storm_day,
    )
