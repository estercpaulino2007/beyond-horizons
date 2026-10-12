"""ExperimentProposal: a hypothetical experiment ranked by the Research
Navigator (spec section 13).

`priority` is a read-only computed property, not a settable field: it is
always mission_impact * uncertainty * expected_information_gain /
relative_cost, so a caller can never set a priority number that disagrees
with its own inputs (docs/methodology.md, reconciliation log #7 -- no
invented/placeholder scores).
"""

from pydantic import Field, computed_field, field_validator

from app.schemas.common import DomainModel, Unit, non_empty_limitations


class ExperimentProposal(DomainModel):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=160)
    gap_description: str = Field(min_length=1, max_length=500)
    mission_impact: Unit
    uncertainty: Unit
    expected_information_gain: Unit
    relative_cost: float = Field(gt=0.0, le=10.0)
    limitations: list[str] = Field(min_length=1)

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)

    @computed_field  # type: ignore[misc]
    @property
    def priority(self) -> float:
        return (
            self.mission_impact * self.uncertainty * self.expected_information_gain
        ) / self.relative_cost
