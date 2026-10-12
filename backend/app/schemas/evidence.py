"""EvidenceRecord: provenance for one piece of real or synthetic data.

Rule (spec section 6 "Regras de proveniência", tightened by this project's
own stricter standard in docs/methodology.md): a record claiming
source_type nasa_dataset or nasa_report must carry a source_url and must be
traceable to something in docs/data-sources.md via the evidence registry.
A record for exploratory_hypothesis or synthetic_parameter carries no such
claim and is not checked against the registry.
"""

from datetime import date
from typing import Literal

from pydantic import Field, HttpUrl, field_validator, model_validator

from app.core.evidence_registry import is_verified_reference, verified_keys
from app.schemas.common import DomainModel, SourceType, non_empty_limitations

Condition = Literal[
    "spaceflight",
    "ground_control",
    "ground_based_simulated_radiation",
    "pre_flight",
    "post_flight",
    "synthetic",
    "other",
]


class EvidenceRecord(DomainModel):
    source_type: SourceType
    dataset_id: str | None = Field(default=None, max_length=80)
    source_url: HttpUrl | None = None
    organism: str | None = Field(default=None, max_length=80)
    tissue: str | None = Field(default=None, max_length=80)
    condition: Condition
    analysis_method: str | None = Field(default=None, max_length=200)
    limitations: list[str] = Field(min_length=1)
    accessed_at: date

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)

    @model_validator(mode="after")
    def _real_sources_need_provenance(self) -> "EvidenceRecord":
        if self.source_type in ("nasa_dataset", "nasa_report"):
            if self.source_url is None:
                raise ValueError(
                    f"source_type={self.source_type!r} requires source_url"
                )
            if not self.dataset_id and not (self.organism or self.tissue):
                raise ValueError(
                    f"source_type={self.source_type!r} requires dataset_id, "
                    "or organism/tissue, to identify what was actually checked"
                )
            reference = self.dataset_id or str(self.source_url)
            if not is_verified_reference(reference):
                raise ValueError(
                    f"dataset_id={self.dataset_id!r} is not in the verified-source "
                    f"registry (app/core/evidence_registry.py). Known keys: "
                    f"{verified_keys()}. Verify the source and register it in "
                    "docs/data-sources.md and the registry before citing it."
                )
        if self.source_type == "synthetic_parameter" and self.condition != "synthetic":
            raise ValueError("source_type=synthetic_parameter requires condition='synthetic'")
        return self
