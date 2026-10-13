"""POST /api/v1/simulations/run (spec section 15)."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.domain.mission_catalog import available_mission_ids, get_mission_dataset
from app.domain.scenario_builder import (
    apply_crew_overrides,
    apply_event_filter,
    apply_mission_overrides,
    rebuild_daily_exposures,
)
from app.schemas.api import CrewTrajectory, SimulationRunRequest, SimulationRunResponse
from app.services.simulation_engine import simulate_mission
from app.services.vulnerability import find_vulnerability_windows

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post(
    "/run",
    summary="Run the daily simulation engine",
    description=(
        "Runs the exploratory simulation engine over a mission's crew and daily exposures, "
        "returning per-crew risk trajectories with explained drivers and automatically "
        "detected vulnerability windows. Exploratory synthetic simulation; not medical advice."
    ),
    responses={404: {"description": "Unknown mission_id"}, 500: {"description": "Simulation could not be completed"}},
)
def run_simulation(request: SimulationRunRequest) -> SimulationRunResponse:
    dataset = get_mission_dataset(request.mission_id)
    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown mission_id {request.mission_id!r}. Available missions: "
                f"{available_mission_ids()}."
            ),
        )

    mission = apply_mission_overrides(dataset.mission, request.mission_overrides)
    crew_profiles = apply_crew_overrides(dataset.crew_profiles, request.crew_overrides)
    events = apply_event_filter(dataset.events, request.active_event_ids)

    has_overrides = (
        bool(request.crew_overrides) or request.mission_overrides is not None or request.active_event_ids is not None
    )
    exposures = (
        rebuild_daily_exposures(crew_profiles, mission, events) if has_overrides else dataset.daily_exposures
    )

    try:
        results = simulate_mission(
            mission,
            crew_profiles,
            exposures,
            events,
            request.countermeasures,
        )
    except ValueError as exc:
        # Defensive: should not happen with seed data, but never leak a raw
        # traceback for something the caller didn't cause.
        raise HTTPException(status_code=500, detail=f"Simulation could not be completed: {exc}") from exc

    crew_by_id = {c.id: c for c in crew_profiles}
    band_day_counts: dict[str, dict[str, int]] = {}
    trajectories: list[CrewTrajectory] = []
    for crew_id, trajectory in results.items():
        counts = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
        for r in trajectory:
            counts[r.band] += 1
        band_day_counts[crew_id] = counts
        trajectories.append(
            CrewTrajectory(
                crew_id=crew_id,
                display_name=crew_by_id[crew_id].display_name,
                risk_results=trajectory,
                vulnerability_windows=find_vulnerability_windows(trajectory),
            )
        )

    return SimulationRunResponse(
        mission_id=mission.mission_id,
        generated_at=datetime.now(timezone.utc),
        disclaimer=SIMULATION_DISCLAIMER,
        synthetic_data_notice=SYNTHETIC_DATA_NOTICE_EN,
        trajectories=trajectories,
        band_day_counts=band_day_counts,
        mission=mission,
        crew_profiles=crew_profiles,
    )
