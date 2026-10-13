"""POST /api/v1/assistant/ask and GET /api/v1/assistant/status.

Bring-your-own-key in-app assistant (app/services/assistant.py). The status
endpoint lets the frontend widget show an honest "not configured" state
instead of making the user hit a 503 first.
"""

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.core.notices import ASSISTANT_NOT_CONFIGURED_NOTICE, SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.schemas.assistant import AssistantAskRequest, AssistantAskResponse, AssistantStatusResponse
from app.services.assistant import AssistantNotConfiguredError, AssistantUpstreamError, ask, is_configured

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get(
    "/status",
    summary="Whether the in-app assistant is configured",
    description=(
        "True only when an operator has set ASSISTANT_API_KEY in the backend environment. This "
        "project does not bundle or pay for a key on anyone's behalf (see app/core/config.py)."
    ),
)
def get_status() -> AssistantStatusResponse:
    settings = get_settings()
    if settings.assistant_configured:
        return AssistantStatusResponse(configured=True, model=settings.assistant_model)
    return AssistantStatusResponse(configured=False, notice=ASSISTANT_NOT_CONFIGURED_NOTICE)


@router.post(
    "/ask",
    summary="Ask the in-app assistant a question",
    description=(
        "Answers are grounded only in this app's own mission/crew/evidence-graph data "
        "(app/services/assistant_context.py) and carry the same synthetic-data disclaimers as the "
        "rest of the API. Returns 503 if no operator has configured ASSISTANT_API_KEY, and 502 if "
        "the configured provider errors or times out."
    ),
)
async def post_ask(payload: AssistantAskRequest) -> AssistantAskResponse:
    if not is_configured():
        raise HTTPException(status_code=503, detail=ASSISTANT_NOT_CONFIGURED_NOTICE)
    try:
        answer = await ask(payload.message, payload.history, payload.vitals_summary)
    except AssistantNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=ASSISTANT_NOT_CONFIGURED_NOTICE) from exc
    except AssistantUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AssistantAskResponse(
        answer=answer,
        disclaimer=SIMULATION_DISCLAIMER,
        synthetic_data_notice=SYNTHETIC_DATA_NOTICE_EN,
    )
