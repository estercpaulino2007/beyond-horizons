"""Real, gene-level expression data transcribed from a verified source
(NAG9-1024 / Burns et al. 2002, see app/core/evidence_registry.py and
docs/data-sources.md) -- NOT a prediction engine. These are exactly the
values published in that paper's Table 1, with only the fold-change column
computed here (and shown with the raw numbers it comes from, so nothing is
hidden). This project has no data that predicts "which gene mutates at dose
X" for an arbitrary mission/dose -- see app/domain/evidence_graph.py for why
-- so this is deliberately presented as "what one real, NASA-funded study
measured", not as a general dose-response model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field, computed_field

from app.schemas.common import DomainModel

GeneResponseCategory = Literal["reversal_response", "additive_response"]


class GeneExpressionRecord(DomainModel):
    gene_symbol: str = Field(min_length=1, max_length=120)
    accession: str = Field(min_length=1, max_length=40)
    gene_description: str = Field(min_length=1, max_length=200)
    category: GeneResponseCategory
    control: float = Field(ge=0.0, description="Normalized fluorescence units, untreated control.")
    vitamin_a_alone: float = Field(ge=0.0, description="Normalized fluorescence units, vitamin A (retinyl acetate), no radiation.")
    dose_9gy: float = Field(ge=0.0, description="Normalized fluorescence units, 9 Gy electron irradiation, no vitamin A.")
    dose_9gy_plus_vitamin_a: float = Field(ge=0.0, description="Normalized fluorescence units, 9 Gy + vitamin A.")
    dose_18gy: float = Field(ge=0.0, description="Normalized fluorescence units, 18 Gy electron irradiation, no vitamin A.")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def fold_change_9gy_vs_control(self) -> float | None:
        """None when control=0 (division undefined) -- shown to the caller as
        'induced, not detected in control' rather than an invented number."""
        if self.control <= 0:
            return None
        return round(self.dose_9gy / self.control, 1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def vitamin_a_reduced_the_9gy_effect(self) -> bool:
        """True if adding vitamin A brought the 9 Gy level back down (the
        'reversal' pattern the source paper describes), regardless of which
        category bucket the gene is in."""
        return self.dose_9gy_plus_vitamin_a < self.dose_9gy


class GeneExpressionTableResponse(DomainModel):
    study_citation: str
    organism: str
    tissue: str
    radiation_condition: str
    timepoint: str
    evidence_reference: str
    limitations: list[str] = Field(min_length=1)
    records: list[GeneExpressionRecord]
    disclaimer: str
    synthetic_data_notice: str
