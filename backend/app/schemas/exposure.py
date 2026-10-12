"""DailyExposure: one crew member's synthetic exposure record for one day."""

from typing import Literal

from pydantic import Field

from app.schemas.common import DomainModel, Unit


class DailyExposure(DomainModel):
    mission_id: str = Field(min_length=1, max_length=64)
    crew_id: str = Field(min_length=1, max_length=64)
    day: int = Field(ge=1, le=1095)
    radiation_dose: Unit  # normalised 0-1 scale (synthetic_parameter, not mSv)
    sleep_hours: float = Field(ge=0.0, le=24.0)
    exercise_duration_min: float = Field(ge=0.0, le=1440.0)
    eva_load: Unit
    operational_workload: Unit
    co2_level_ppm: float = Field(ge=0.0, le=20000.0)
    synthetic: Literal[True] = True
