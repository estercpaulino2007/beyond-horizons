"""CausalNode / CausalEdge: the evidence causal graph (spec section 10).

CausalEdge is where this project's "don't invent data" rule is enforced
hardest: an edge claiming evidence_level supported_evidence or
data_supported_association must give an evidence_reference that starts with
a key from app.core.evidence_registry -- i.e. a source this project has
actually opened and written up in docs/data-sources.md. exploratory_hypothesis
and synthetic_parameter edges make no such claim and are not checked.
"""

from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.core.evidence_registry import is_verified_reference, verified_keys
from app.schemas.common import DomainModel, EvidenceLevel, Unit, non_empty_limitations

NodeCategory = Literal[
    "exposure",
    "molecular",
    "behavioral",
    "physiological",
    "operational",
    "countermeasure",
]

Relation = Literal[
    "increases",
    "decreases",
    "triggers",
    "alters",
    "improves",
]


class CausalNode(DomainModel):
    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=80)
    category: NodeCategory
    description: str = Field(min_length=1, max_length=300)


class CausalEdge(DomainModel):
    source: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=64)
    relation: Relation
    weight: Unit
    evidence_level: EvidenceLevel
    uncertainty: Unit
    evidence_reference: str = Field(min_length=1, max_length=300)
    limitations: list[str] = Field(min_length=1)

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)

    @model_validator(mode="after")
    def _no_self_loop(self) -> "CausalEdge":
        if self.source == self.target:
            raise ValueError("an edge cannot connect a node to itself")
        return self

    @model_validator(mode="after")
    def _real_evidence_must_be_verified(self) -> "CausalEdge":
        if self.evidence_level in ("supported_evidence", "data_supported_association"):
            if not is_verified_reference(self.evidence_reference):
                raise ValueError(
                    f"evidence_level={self.evidence_level!r} requires evidence_reference "
                    f"to start with a verified source key. Got {self.evidence_reference!r}; "
                    f"known keys: {verified_keys()}. Either use a verified source, or mark "
                    "this edge as exploratory_hypothesis / synthetic_parameter instead."
                )
        return self
