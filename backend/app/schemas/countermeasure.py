"""CountermeasurePlan: a named intervention the simulation can apply.

Modelled on spec section "Contramedidas Disponíveis": each real-world
countermeasure there is described qualitatively (cost, benefit, limitation,
NASA source) rather than with an invented numeric effect size, so this
schema does the same -- no numeric "expected_risk_reduction" field exists
here (docs/methodology.md, reconciliation log #7: placeholder numeric
outputs like that were never real and must never be shown).
"""

from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import DomainModel, non_empty_limitations

TargetRisk = Literal[
    "musculoskeletal",
    "radiation",
    "cognitive_operational",
]


class CountermeasurePlan(DomainModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    target_risk: TargetRisk
    description: str = Field(min_length=1, max_length=500)
    limitations: list[str] = Field(min_length=1)
    evidence_reference: str | None = Field(default=None, max_length=200)

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)
