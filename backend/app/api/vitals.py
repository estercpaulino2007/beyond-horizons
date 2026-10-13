"""POST /api/v1/vitals/evaluate -- self-reported vital signs, evaluated
against standard adult resting reference ranges (see
app/domain/vitals_reference.py). Stateless: the backend holds no history for
this. Day-to-day history and the evolution chart live entirely in the
browser (frontend/lib/vitalsStore.ts), one evaluated entry at a time.
"""

from fastapi import APIRouter

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.domain.vitals_reference import evaluate_vitals
from app.schemas.vitals import VitalsEntry, VitalsEvaluationResponse

router = APIRouter(prefix="/vitals", tags=["vitals"])


@router.post(
    "/evaluate",
    summary="Evaluate a self-reported vitals snapshot",
    description=(
        "Compares one self-reported snapshot (heart rate, SpO2, body temperature, respiratory rate, "
        "sleep, stress, activity) against standard adult resting reference ranges and returns a "
        "deterministic, rule-based evaluation per metric plus an overall status. Not a diagnosis, not "
        "spaceflight-specific, and the backend does not store the entry -- see "
        "app/domain/vitals_reference.py for exactly which ranges are used and why."
    ),
)
def post_vitals_evaluate(entry: VitalsEntry) -> VitalsEvaluationResponse:
    return evaluate_vitals(
        entry,
        disclaimer=SIMULATION_DISCLAIMER,
        synthetic_data_notice=SYNTHETIC_DATA_NOTICE_EN,
    )
