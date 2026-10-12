"""Request/response shapes for POST /api/v1/assistant/ask and
GET /api/v1/assistant/status (app/api/assistant.py)."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import DomainModel
from app.services.assistant import MAX_MESSAGE_LENGTH, AssistantTurn


class AssistantStatusResponse(DomainModel):
    configured: bool = Field(description="False until an operator sets ASSISTANT_API_KEY in the backend environment.")
    model: str | None = Field(default=None, description="The model that will be used, when configured.")
    notice: str | None = Field(default=None, description="Set when configured=false, explaining why.")


class AssistantAskRequest(DomainModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    history: list[AssistantTurn] = Field(
        default_factory=list,
        description="Prior turns of this conversation, oldest first. Only the most recent few are sent upstream.",
    )


class AssistantAskResponse(DomainModel):
    answer: str
    disclaimer: str
    synthetic_data_notice: str
