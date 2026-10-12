"""GET /api/v1/missions/{mission_id} (spec section 15)."""

from fastapi import APIRouter, HTTPException

from app.core.notices import SYNTHETIC_DATA_NOTICE_EN
from app.domain.mission_catalog import available_mission_ids, get_mission_dataset
from app.schemas.api import MissionResponse

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get(
    "/{mission_id}",
    summary="Get a mission scenario",
    description=(
        "Returns the mission configuration, synthetic crew profiles and scripted events for "
        "a scenario. Only `ares-180` exists in this MVP -- the full configurable simulator "
        "described in the project's data-package specification is out of scope (see "
        "docs/methodology.md)."
    ),
    responses={404: {"description": "Unknown mission_id"}},
)
def get_mission(mission_id: str) -> MissionResponse:
    dataset = get_mission_dataset(mission_id)
    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown mission_id {mission_id!r}. Available missions: "
                f"{available_mission_ids()}."
            ),
        )
    return MissionResponse(
        mission=dataset.mission,
        crew_profiles=dataset.crew_profiles,
        events=dataset.events,
        synthetic_data_notice=SYNTHETIC_DATA_NOTICE_EN,
    )
