"""SimulationEvent: a scripted, synthetic occurrence during the mission
(e.g. the Ares-180 radiation storm or the exercise-module failure), and its
optional decision point (e.g. the day-145 EVA go/delay/reassign choice).
"""

from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import DomainModel

EventType = Literal[
    "radiation_storm",
    "equipment_failure",
    "communication_delay",
    "eva",
    "other",
]

Severity = Literal["low", "medium", "high"]


class DecisionAlternative(DomainModel):
    id: str = Field(min_length=1, max_length=8)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)


class DecisionPoint(DomainModel):
    alternatives: list[DecisionAlternative] = Field(min_length=2)

    @model_validator(mode="after")
    def _unique_alternative_ids(self) -> "DecisionPoint":
        ids = [alt.id for alt in self.alternatives]
        if len(ids) != len(set(ids)):
            raise ValueError("alternative ids must be unique within a decision point")
        return self


class SimulationEvent(DomainModel):
    id: str = Field(min_length=1, max_length=64)
    mission_id: str = Field(min_length=1, max_length=64)
    day_start: int = Field(ge=1, le=1095)
    day_end: int = Field(ge=1, le=1095)
    type: EventType
    severity: Severity
    description: str = Field(min_length=1, max_length=300)
    effects: dict[str, float] = Field(default_factory=dict)
    synthetic: Literal[True] = True
    decision_point: DecisionPoint | None = None

    @model_validator(mode="after")
    def _day_range_ordered(self) -> "SimulationEvent":
        if self.day_end < self.day_start:
            raise ValueError("day_end must be >= day_start")
        return self
