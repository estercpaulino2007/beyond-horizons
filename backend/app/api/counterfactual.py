"""POST /api/v1/counterfactual/compare (spec section 12)."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.notices import SIMULATION_DISCLAIMER
from app.schemas.api import (
    CounterfactualAlternativeResult,
    CounterfactualCompareRequest,
    CounterfactualCompareResponse,
)
from app.services.counterfactual import RESULT_LANGUAGE_NOTE, compare_counterfactuals

router = APIRouter(prefix="/counterfactual", tags=["counterfactual"])

_SUPPORTED_MISSION_ID = "ares-180"


@router.post(
    "/compare",
    summary="Compare the day-145 EVA alternatives",
    description=(
        "Runs the counterfactual engine for the Ares-180 day-145 EVA decision: A (maintain), "
        "B (delay 10 days) and C (reassign + sleep-recovery protocol). Each alternative is a "
        "full, independent re-run of the simulation engine, not a hand-adjusted estimate. "
        "Exploratory synthetic comparison; not medical or operational guidance."
    ),
    responses={404: {"description": "Unknown mission_id"}},
)
def compare(request: CounterfactualCompareRequest) -> CounterfactualCompareResponse:
    if request.mission_id != _SUPPORTED_MISSION_ID:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown mission_id {request.mission_id!r}. The counterfactual comparison "
                f"currently only covers {_SUPPORTED_MISSION_ID!r}'s day-145 EVA decision."
            ),
        )

    comparisons = compare_counterfactuals()

    return CounterfactualCompareResponse(
        mission_id=_SUPPORTED_MISSION_ID,
        generated_at=datetime.now(timezone.utc),
        disclaimer=SIMULATION_DISCLAIMER,
        language_note=RESULT_LANGUAGE_NOTE,
        alternatives=[
            CounterfactualAlternativeResult(
                alternative=c.alternative,
                description=c.description,
                eva_crew_id=c.eva_crew_id,
                eva_day=c.eva_day,
                peak_operational_risk=c.peak_operational_risk,
                peak_cognitive_risk=c.peak_cognitive_risk,
                peak_musculoskeletal_risk=c.peak_musculoskeletal_risk,
                mean_uncertainty=c.mean_uncertainty,
                eva_completion_probability=c.eva_completion_probability,
                top_drivers=c.top_drivers,
            )
            for c in comparisons
        ],
    )
