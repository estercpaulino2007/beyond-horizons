"""GET /api/v1/countermeasures/catalog -- the fixed list of countermeasures a
simulation run can select via SimulationRunRequest.countermeasures.
"""

from fastapi import APIRouter

from app.domain.countermeasure_catalog import get_countermeasure_catalog
from app.schemas.countermeasure import CountermeasurePlan

router = APIRouter(prefix="/countermeasures", tags=["countermeasures"])


@router.get(
    "/catalog",
    summary="List the countermeasures a simulation run can select",
    description="Fixed catalog of countermeasure plans; pass any subset of these objects "
    "verbatim as SimulationRunRequest.countermeasures to activate them for a run.",
)
def catalog() -> list[CountermeasurePlan]:
    return get_countermeasure_catalog()
