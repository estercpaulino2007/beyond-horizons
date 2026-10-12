"""Shared types used across the domain schemas.

Every 0-1 "score" field in this project (risk scores, weights, uncertainty)
uses the Unit type alias so the bound is declared in one place. See
docs/methodology.md's reconciliation log (#3) for why this matters: the
original specification declared these fields as [0, 1] but its own update
rules could push them outside that range.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# A score or probability-like quantity, always in [0, 1].
Unit = Annotated[float, Field(ge=0.0, le=1.0)]

# The four evidence levels this project recognizes (docs/methodology.md).
# A CausalEdge's evidence_level is restricted to exactly this set.
EvidenceLevel = Literal[
    "supported_evidence",
    "data_supported_association",
    "exploratory_hypothesis",
    "synthetic_parameter",
]

# Canonical wording for each evidence level (matches docs/methodology.md,
# "Evidence levels" -- kept here as the single source of truth for any
# code that needs to display it, e.g. the evidence-graph API response).
EVIDENCE_LEVEL_DESCRIPTIONS: dict[str, str] = {
    "supported_evidence": (
        "Supported by a documented public source (e.g. an HRP evidence report or peer-reviewed "
        "paper) that is registered in docs/data-sources.md."
    ),
    "data_supported_association": (
        "Association observed in a processed dataset registered in docs/data-sources.md."
    ),
    "exploratory_hypothesis": "Hypothesis used in the simulation; not an established effect.",
    "synthetic_parameter": "Value created for the demonstration scenario.",
}

# Where an EvidenceRecord's underlying material comes from.
SourceType = Literal[
    "nasa_dataset",
    "nasa_report",
    "exploratory_hypothesis",
    "synthetic_parameter",
]

RiskBand = Literal["low", "moderate", "high", "critical"]


class DomainModel(BaseModel):
    """Base class for domain schemas: forbid unexpected fields.

    Extra fields are rejected rather than silently dropped, so a typo or a
    field invented on the fly by a caller fails loudly instead of vanishing.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def non_empty_limitations(value: list[str]) -> list[str]:
    """Shared validator body: every limitations list must be non-empty and
    every entry must be non-blank. Imported by schemas that require it.
    """
    if not value:
        raise ValueError("limitations must list at least one limitation")
    if any(not item.strip() for item in value):
        raise ValueError("limitations entries must not be blank")
    return value


IsoDate = date
