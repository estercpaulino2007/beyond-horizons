"""CrewProfile: a synthetic crew member used in the simulation.

Hard rule (spec section 4 and docs/limitations.md): crew profiles are always
synthetic and never represent real people. `synthetic` is typed as
`Literal[True]` rather than `bool` so a profile with `synthetic: false`
fails validation before it can reach the rest of the system, instead of
relying on someone remembering to set the flag correctly.
"""

import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.common import DomainModel, Unit, non_empty_limitations

# A crude but useful PII guard: reject identifiers that look like an email,
# a phone number, or a long digit run (a document or birth-date number).
# This cannot prove a name is fictional, but it blocks the most obvious
# accidental leaks (pasting a real contact's details as a "profile").
_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+")
_LONG_DIGIT_RUN_RE = re.compile(r"\d{4,}")


def _reject_obvious_pii(value: str, field_name: str) -> str:
    if _EMAIL_RE.search(value):
        raise ValueError(f"{field_name} must not contain an email address")
    if _LONG_DIGIT_RUN_RE.search(value):
        raise ValueError(f"{field_name} must not contain a long digit sequence (looks like an ID/date)")
    return value


class CrewBaseline(DomainModel):
    """Scenario parameters for one crew member. All synthetic_parameter by
    construction (see docs/methodology.md) — never sourced from a real
    individual's measurements.
    """

    radiation_sensitivity: Unit
    bone_loss_susceptibility: Unit
    sleep_resilience: Unit
    muscle_recovery: Unit
    cognitive_resilience: Unit
    inflammatory_baseline: Unit


class CrewProfile(DomainModel):
    id: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=80)
    role: str = Field(min_length=1, max_length=80)
    synthetic: Literal[True] = True
    baseline: CrewBaseline
    characteristics: list[str] = Field(default_factory=list)
    primary_vulnerability: str = Field(min_length=1, max_length=200)
    limitations: list[str] = Field(min_length=1)

    @field_validator("id", "display_name", "role")
    @classmethod
    def _no_pii(cls, value: str, info) -> str:
        return _reject_obvious_pii(value, info.field_name)

    @field_validator("limitations")
    @classmethod
    def _limitations_non_empty(cls, value: list[str]) -> list[str]:
        return non_empty_limitations(value)

    @model_validator(mode="after")
    def _limitations_mention_synthetic(self) -> "CrewProfile":
        # Every crew profile must itself disclose, in its own limitations,
        # that it is synthetic -- not just rely on the `synthetic` flag,
        # since the flag may not survive every place this model is rendered.
        joined = " ".join(self.limitations).casefold()
        if "synthetic" not in joined and "not a real" not in joined and "fictional" not in joined:
            raise ValueError(
                "limitations must explicitly state the profile is synthetic "
                "(e.g. 'Synthetic persona for demonstration only')"
            )
        return self
