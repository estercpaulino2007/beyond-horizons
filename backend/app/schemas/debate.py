"""AgentRecommendation / DebateResult: the auditable Debate Chamber
(spec section 14). These are deterministic functions of simulation
outputs, not an LLM roleplay -- the engine that computes utility lives in
a later step; this module only defines the output shape.

Rule: the skeptic role never recommends an alternative (it critiques), and
must always list at least one limitation -- both enforced structurally
rather than left to the engine to remember.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.core.notices import SIMULATION_DISCLAIMER
from app.schemas.common import DomainModel, Unit, non_empty_limitations

Role = Literal["mission_commander", "flight_surgeon", "science_officer", "skeptic"]


class AgentRecommendation(DomainModel):
    role: Role
    recommendation: Literal["A", "B", "C"] | None = None
    utility: float | None = Field(default=None, ge=-1.0, le=1.0)
    confidence: Unit | None = None
    justification: str = Field(min_length=1, max_length=500)
    limitations: list[str] = Field(min_length=1)

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)

    @model_validator(mode="after")
    def _skeptic_does_not_recommend(self) -> "AgentRecommendation":
        if self.role == "skeptic":
            if self.recommendation is not None or self.utility is not None:
                raise ValueError("the skeptic role critiques and must not set recommendation/utility")
        else:
            if self.recommendation is None or self.utility is None:
                raise ValueError(f"role={self.role!r} must set both recommendation and utility")
        return self


class DebateResult(DomainModel):
    mission_id: str = Field(min_length=1, max_length=64)
    day: int = Field(ge=1, le=1095)
    alternatives: list[str] = Field(min_length=2, max_length=8)
    recommendations: list[AgentRecommendation] = Field(min_length=1)
    disagreement_summary: str | None = Field(default=None, max_length=500)
    generated_at: datetime
    disclaimer: str = SIMULATION_DISCLAIMER

    @model_validator(mode="after")
    def _includes_skeptic(self) -> "DebateResult":
        roles = [r.role for r in self.recommendations]
        if len(roles) != len(set(roles)):
            raise ValueError("recommendations must not repeat the same role")
        if "skeptic" not in roles:
            raise ValueError("a DebateResult must always include the skeptic role")
        return self

    @model_validator(mode="after")
    def _recommendations_reference_real_alternatives(self) -> "DebateResult":
        alt_set = set(self.alternatives)
        for rec in self.recommendations:
            if rec.recommendation is not None and rec.recommendation not in alt_set:
                raise ValueError(
                    f"{rec.role} recommends {rec.recommendation!r}, which is not in alternatives={self.alternatives}"
                )
        return self
