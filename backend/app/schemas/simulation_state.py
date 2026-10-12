"""DailyCrewState and RiskResult: the simulation engine's per-day output
for one crew member (the engine itself is built in Step 3; this module only
defines its output shape).

Every RiskResult carries the mandatory disclaimer from app.core.notices, and
`band` is derived from `operational_risk` rather than settable independently,
so the two can never silently disagree with each other.
"""

from pydantic import Field, model_validator

from app.core.notices import SIMULATION_DISCLAIMER
from app.domain.risk_bands import band_for_risk
from app.schemas.common import DomainModel, RiskBand, Unit


class DailyCrewState(DomainModel):
    crew_id: str = Field(min_length=1, max_length=64)
    mission_id: str = Field(min_length=1, max_length=64)
    day: int = Field(ge=1, le=1095)
    radiation_burden: Unit
    sleep_debt: Unit
    muscle_recovery: Unit
    bone_risk: Unit
    cognitive_resilience: Unit
    operational_risk: Unit
    uncertainty: Unit


class RiskDriver(DomainModel):
    name: str = Field(min_length=1, max_length=80)
    contribution: Unit


class RiskResult(DomainModel):
    crew_id: str = Field(min_length=1, max_length=64)
    mission_id: str = Field(min_length=1, max_length=64)
    day: int = Field(ge=1, le=1095)
    scores: DailyCrewState
    band: RiskBand
    uncertainty: Unit
    top_drivers: list[RiskDriver] = Field(default_factory=list, max_length=10)
    disclaimer: str = SIMULATION_DISCLAIMER

    @model_validator(mode="after")
    def _band_matches_operational_risk(self) -> "RiskResult":
        risk = self.scores.operational_risk
        expected = band_for_risk(risk)
        if self.band != expected:
            raise ValueError(
                f"band={self.band!r} does not match operational_risk={risk} "
                f"(expected {expected!r})"
            )
        return self

    @model_validator(mode="after")
    def _scores_match_header(self) -> "RiskResult":
        if (self.scores.crew_id, self.scores.mission_id, self.scores.day) != (
            self.crew_id,
            self.mission_id,
            self.day,
        ):
            raise ValueError("scores.crew_id/mission_id/day must match the RiskResult's own")
        return self

    @model_validator(mode="after")
    def _driver_names_unique(self) -> "RiskResult":
        names = [d.name for d in self.top_drivers]
        if len(names) != len(set(names)):
            raise ValueError("top_drivers must not repeat the same driver name")
        return self
