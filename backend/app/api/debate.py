"""GET /api/v1/debate/ares-180 (spec section 14)."""

from fastapi import APIRouter

from app.schemas.debate import DebateResult
from app.services.debate import run_debate_chamber

router = APIRouter(prefix="/debate", tags=["debate"])


@router.get(
    "/ares-180",
    summary="Get the Debate Chamber for the day-145 EVA decision",
    description=(
        "Runs the day-145 EVA counterfactual comparison once and derives four deterministic, "
        "auditable perspectives on it -- mission_commander, flight_surgeon, science_officer and "
        "a skeptic who never recommends but always names a real caveat. This is not an LLM "
        "roleplay: every utility is a named, fixed formula over the counterfactual engine's "
        "real output (see app/services/debate.py)."
    ),
)
def get_debate() -> DebateResult:
    return run_debate_chamber()
