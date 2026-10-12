"""MissionConfig: the scenario a simulation run is set in.

Scope note (see docs/methodology.md reconciliation log): the specification's
"universal simulator" (~100 configurable variables, data-package doc 4) is
out of scope for the MVP. This schema covers only what Ares-180 needs.
Extending it to the full simulator is a later, explicitly separate step.

`destination` uses the mission-duration categories NASA's own Human
Research Program risk pages use (Low Earth Orbit / Lunar Orbital / Lunar
Orbital + Surface / Mars) -- see docs/data-sources.md, "NASA HRP risk
pages" -- rather than inventing our own labels.
"""

from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import DomainModel

Destination = Literal[
    "low_earth_orbit",
    "lunar_orbital",
    "lunar_orbital_surface",
    "mars_transit",
    "mars_surface",
]


class MissionConfig(DomainModel):
    mission_id: str = Field(min_length=1, max_length=64)
    mission_name: str = Field(min_length=1, max_length=120)
    destination: Destination
    duration_days: int = Field(ge=1, le=1095)
    crew_size: int = Field(ge=1, le=12)
    # Synthetic scenario parameters (docs/methodology.md): not measured
    # quantities, chosen to be plausible for the destination.
    gravity_g: float = Field(ge=0.0, le=1.0)
    communication_delay_minutes: float = Field(ge=0.0, le=1200.0)
    synthetic: Literal[True] = True

    @model_validator(mode="after")
    def _gravity_matches_destination(self) -> "MissionConfig":
        # A loose sanity check, not a physics engine: transit and orbital
        # phases are microgravity; only a surface destination has non-zero
        # gravity in this MVP's model.
        if self.destination in ("lunar_orbital", "mars_transit", "low_earth_orbit"):
            if self.gravity_g != 0.0:
                raise ValueError(
                    f"destination={self.destination!r} is microgravity; gravity_g must be 0.0"
                )
        return self
