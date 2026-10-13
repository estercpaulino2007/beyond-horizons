"""Self-reported vital signs, entered by the person using the app as a stand-in
for "the astronaut", and their rule-based evaluation against standard adult
resting reference ranges.

This is deliberately the ONLY place in the backend that evaluates a live,
user-supplied number against a medical reference range -- see
app/domain/vitals_reference.py for exactly which ranges and why. Nothing here
is a diagnosis: VitalsEvaluationResponse always carries the same
SIMULATION_DISCLAIMER as the rest of the app, plus its own limitations list
spelling out that the ranges are general clinical knowledge, not
spaceflight-specific, and that a single self-reported reading proves nothing
on its own.
"""

from typing import Literal

from pydantic import Field

from app.schemas.common import DomainModel

MetricStatus = Literal["normal", "attention", "alert"]

# The six monitoring categories from the challenge brief (spec section 1):
# cardiac, respiratory, temperature, sleep/fatigue, activity/muscle,
# hydration/other. Every metric below is tagged with exactly one of these so
# the UI can group cards the same way the brief groups them.
VitalsCategory = Literal["cardiac", "respiratory", "temperature", "sleep_fatigue", "activity_muscle", "hydration_other"]

HeartRhythm = Literal["regular", "irregular"]


class VitalsEntry(DomainModel):
    """One self-reported snapshot. All fields are what a consumer wearable or
    a person checking themselves could plausibly report -- no field here
    requires a clinical instrument. body_mass_kg is optional and deliberately
    NOT evaluated against any range (no universal "normal" body mass exists);
    it exists only so the trend chart has something to plot, exactly like the
    brief's "tendências de massa corporal" point.
    """

    heart_rate_bpm: float = Field(ge=20, le=250, description="Resting heart rate, beats per minute.")
    heart_rhythm: HeartRhythm = Field(default="regular", description="Self-reported: did it feel regular or irregular?")
    spo2_percent: float = Field(ge=50, le=100, description="Peripheral oxygen saturation, percent.")
    body_temp_c: float = Field(ge=30, le=43, description="Body temperature, degrees Celsius.")
    respiratory_rate_bpm: float = Field(ge=4, le=60, description="Breaths per minute, resting.")
    sleep_hours: float = Field(ge=0, le=24, description="Hours slept in the last 24h.")
    sleep_quality: int = Field(ge=1, le=5, default=3, description="Self-rated rest quality, 1 (poor) to 5 (excellent).")
    stress_level: int = Field(ge=0, le=10, description="Self-reported stress, 0 (none) to 10 (extreme).")
    activity_minutes: float = Field(ge=0, le=600, description="Minutes of physical activity in the last 24h.")
    hydration_level: int = Field(ge=0, le=10, default=7, description="Self-estimated hydration adequacy, 0 (very poor) to 10 (excellent). Not a measurement -- see limitations.")
    body_mass_kg: float | None = Field(default=None, ge=20, le=250, description="Optional, for your own trend only -- no universal reference range exists.")


class VitalMetricEvaluation(DomainModel):
    metric_id: str
    label: str
    category: VitalsCategory
    value: float
    unit: str
    status: MetricStatus
    reference_range: str
    note: str
    recommendations: list[str] = Field(default_factory=list)


class VitalsEvaluationResponse(DomainModel):
    overall_status: MetricStatus
    metrics: list[VitalMetricEvaluation]
    insights: list[str]
    reference_source: str
    limitations: list[str]
    disclaimer: str
    synthetic_data_notice: str
