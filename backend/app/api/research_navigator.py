"""GET /api/v1/research-navigator/rankings (spec section 13)."""

from fastapi import APIRouter

from app.domain.research_navigator import rank_research_proposals
from app.schemas.api import ResearchNavigatorRankingsResponse

router = APIRouter(prefix="/research-navigator", tags=["research-navigator"])

PRIORITY_FORMULA = (
    "priority = mission_impact * uncertainty * expected_information_gain / relative_cost"
)
LANGUAGE_NOTE = (
    "These are this project's own hypothetical experiment proposals, built from gaps "
    "visible in the evidence graph (GET /api/v1/evidence/graph). They are not funded, "
    "scheduled, or endorsed by NASA -- see each proposal's limitations."
)


@router.get(
    "/rankings",
    summary="Get ranked research proposals",
    description=(
        "Returns a small set of hypothetical follow-up experiments, each addressing a gap "
        "in the evidence graph (an exploratory_hypothesis edge with no backing dataset), "
        "ranked by a transparent priority formula. Every proposal explicitly states its own "
        "limitations -- none of these are real, funded studies."
    ),
)
def get_research_navigator_rankings() -> ResearchNavigatorRankingsResponse:
    return ResearchNavigatorRankingsResponse(
        priority_formula=PRIORITY_FORMULA,
        language_note=LANGUAGE_NOTE,
        proposals=rank_research_proposals(),
    )
