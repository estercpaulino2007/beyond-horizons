"""Deterministic seed data for the Ares-180 scenario (spec section 4).

Everything here is `synthetic_parameter`: a scenario built for demonstration,
not a measurement of anything real. Two kinds of numbers appear below:

1. Values copied verbatim from the project's own specification documents
   (crew baselines, event definitions, mission parameters) -- these are
   marked "(spec value)" in comments, because they were given to us
   directly, not invented here.
2. Values this seed itself decides (the day-to-day exposure formula, which
   crew member was originally assigned the day-145 EVA) -- these are marked
   "(this seed's own choice)", because the specification did not fix them
   and a decision was needed to produce a runnable scenario.

Determinism: `build_daily_exposures` uses a single `random.Random(RNG_SEED)`
instance, consumed in a fixed (day, crew) order, so calling any `build_*`
function twice with the same code always produces byte-identical output.
`tests/test_ares180_seed.py` checks this directly.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from app.schemas.crew import CrewBaseline, CrewProfile
from app.schemas.events import DecisionAlternative, DecisionPoint, SimulationEvent
from app.schemas.exposure import DailyExposure
from app.schemas.mission import MissionConfig

MISSION_ID = "ares-180"
TOTAL_DAYS = 180
RNG_SEED = 180180  # arbitrary but fixed; documented here so it is never "silently" reseeded elsewhere

RADIATION_STORM_DAY = 143
EXERCISE_FAILURE_START_DAY = 143
EXERCISE_FAILURE_END_DAY = 154
EVA_DAY = 145

# (this seed's own choice) The specification says a critical EVA is planned
# for day 145 and describes alternatives (maintain / delay / reassign), but
# never states who was originally assigned. We assign Atlas: Atlas's
# documented primary_vulnerability is "cognitive fatigue under sleep debt"
# (spec value, see build_crew_profiles), which makes the day-145 decision
# meaningfully risky given the radiation storm two days earlier. This is a
# scenario-authoring choice, not a fact taken from the specification.
EVA_ORIGINAL_CREW_ID = "atlas"


def build_mission_config() -> MissionConfig:
    """(spec value) Ares-180: 180-day Mars transit, 22-minute comm delay."""
    return MissionConfig(
        mission_id=MISSION_ID,
        mission_name="Ares-180 Mars Transit Simulation",
        destination="mars_transit",
        duration_days=TOTAL_DAYS,
        crew_size=4,
        gravity_g=0.0,
        communication_delay_minutes=22.0,
    )


def build_crew_profiles() -> list[CrewProfile]:
    """(spec value) The four synthetic crew profiles, with the exact baseline
    scores given in the project's data-package specification, section 2.1.
    """
    return [
        CrewProfile(
            id="atlas",
            display_name="Atlas",
            role="Mission Specialist",
            baseline=CrewBaseline(
                radiation_sensitivity=0.45,
                bone_loss_susceptibility=0.35,
                sleep_resilience=0.30,
                muscle_recovery=0.75,
                cognitive_resilience=0.58,
                inflammatory_baseline=0.40,
            ),
            characteristics=[
                "High physical capacity",
                "Unstable sleep patterns",
                "Good muscle recovery",
            ],
            primary_vulnerability="Cognitive fatigue under sleep debt",
            limitations=[
                "Synthetic persona for demonstration only",
                "Not calibrated to an individual human",
            ],
        ),
        CrewProfile(
            id="nova",
            display_name="Nova",
            role="Flight Engineer",
            baseline=CrewBaseline(
                radiation_sensitivity=0.38,
                bone_loss_susceptibility=0.62,
                sleep_resilience=0.65,
                muscle_recovery=0.48,
                cognitive_resilience=0.72,
                inflammatory_baseline=0.35,
            ),
            characteristics=[
                "Good cognitive recovery",
                "Higher bone loss risk",
                "Moderate sleep resilience",
            ],
            primary_vulnerability="Musculoskeletal deconditioning",
            limitations=[
                "Synthetic persona for demonstration only",
                "Not calibrated to an individual human",
            ],
        ),
        CrewProfile(
            id="lyra",
            display_name="Lyra",
            role="Science Officer",
            baseline=CrewBaseline(
                radiation_sensitivity=0.68,
                bone_loss_susceptibility=0.42,
                sleep_resilience=0.55,
                muscle_recovery=0.60,
                cognitive_resilience=0.65,
                inflammatory_baseline=0.50,
            ),
            characteristics=[
                "Higher sensitivity to cumulative exposure",
                "Moderate recovery across systems",
                "Elevated inflammatory baseline",
            ],
            primary_vulnerability="Radiation-related cumulative risk",
            limitations=[
                "Synthetic persona for demonstration only",
                "Not calibrated to an individual human",
            ],
        ),
        CrewProfile(
            id="orion",
            display_name="Orion",
            role="Commander",
            baseline=CrewBaseline(
                radiation_sensitivity=0.40,
                bone_loss_susceptibility=0.38,
                sleep_resilience=0.48,
                muscle_recovery=0.70,
                cognitive_resilience=0.62,
                inflammatory_baseline=0.38,
            ),
            characteristics=[
                "Good physical resilience",
                "High operational workload",
                "Moderate sleep vulnerability",
            ],
            primary_vulnerability="Operational error under high workload",
            limitations=[
                "Synthetic persona for demonstration only",
                "Not calibrated to an individual human",
            ],
        ),
    ]


def build_mission_events(eva_day: int = EVA_DAY) -> list[SimulationEvent]:
    """(spec value) The four scripted Ares-180 events: radiation storm,
    exercise-module failure, the standing communication delay, and the
    critical EVA with its A/B/C decision point -- all numbers here are
    taken from the project's own specification documents.

    `eva_day` lets the counterfactual engine (Step 5) rebuild this event set
    for alternative B ("delay by 10 days") without duplicating the other
    three events; it defaults to the seed's own EVA_DAY.
    """
    return [
        SimulationEvent(
            id="evt_radiation_storm",
            mission_id=MISSION_ID,
            day_start=RADIATION_STORM_DAY,
            day_end=RADIATION_STORM_DAY,
            type="radiation_storm",
            severity="high",
            description="Solar particle event causes acute radiation exposure",
            effects={
                "radiation_dose_multiplier": 3.5,
                "cognitive_impact": 0.15,
                "inflammatory_trigger": 0.20,
            },
        ),
        SimulationEvent(
            id="evt_exercise_failure",
            mission_id=MISSION_ID,
            day_start=EXERCISE_FAILURE_START_DAY,
            day_end=EXERCISE_FAILURE_END_DAY,
            type="equipment_failure",
            severity="medium",
            description="Exercise module unavailable due to technical failure",
            effects={
                "muscle_recovery_reduction": 0.25,
                "bone_risk_increase": 0.15,
                "exercise_benefit_removed": 1.0,
            },
        ),
        SimulationEvent(
            id="evt_comm_delay",
            mission_id=MISSION_ID,
            day_start=1,
            day_end=TOTAL_DAYS,
            type="communication_delay",
            severity="medium",
            description="Communication delay with Earth: 22 minutes one-way",
            effects={
                "operational_stress": 0.10,
                "decision_autonomy_required": 1.0,
            },
        ),
        SimulationEvent(
            id="evt_eva_critical",
            mission_id=MISSION_ID,
            day_start=eva_day,
            day_end=eva_day,
            type="eva",
            severity="high",
            description="Critical EVA scheduled for day 145" if eva_day == EVA_DAY else f"Critical EVA (rescheduled to day {eva_day})",
            effects={
                "eva_load": 0.40,
                "radiation_exposure_eva": 0.20,
                "physical_fatigue": 0.30,
                "cognitive_load": 0.35,
            },
            decision_point=DecisionPoint(
                alternatives=[
                    DecisionAlternative(
                        id="A",
                        name="Maintain EVA",
                        description="Proceed with EVA as scheduled with original crew member",
                    ),
                    DecisionAlternative(
                        id="B",
                        name="Delay EVA",
                        description="Postpone EVA by 10 days to allow recovery",
                    ),
                    DecisionAlternative(
                        id="C",
                        name="Reassign + Recovery",
                        description="Reassign EVA to different crew member and apply sleep recovery protocol",
                    ),
                ]
            ),
        ),
    ]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class _ExposureBaseline:
    """(this seed's own choice) Baseline daily-exposure levels. The 0.008
    radiation dose, ~120-minute exercise session and ~4500 ppm CO2 figures
    match the illustrative daily_exposures.json example in the project's
    data-package specification (section 2.3); the workload and jitter
    amounts are this seed's own design, chosen only to keep every field
    inside its schema bounds while looking like a real daily log.
    """

    radiation_dose: float = 0.008
    sleep_hours: float = 7.0
    exercise_duration_min: float = 120.0
    operational_workload: float = 0.47
    co2_level_ppm: float = 4500.0


_BASELINE = _ExposureBaseline()


def build_daily_exposures(
    crew_profiles: list[CrewProfile],
    eva_day: int = EVA_DAY,
    eva_crew_id: str = EVA_ORIGINAL_CREW_ID,
) -> list[DailyExposure]:
    """One DailyExposure per (day, crew member), 1..TOTAL_DAYS.

    Deterministic: a single `random.Random(RNG_SEED)` is consumed in a fixed
    (day, crew) order, so this function returns identical output on every
    call, in every process, as long as RNG_SEED and TOTAL_DAYS are unchanged.
    This holds regardless of `eva_day`/`eva_crew_id`: the RNG stream consumed
    per (day, crew) does not depend on which day is "the EVA day", only the
    deterministic eva_load/workload formula below does -- so the counterfactual
    engine (Step 5) can rebuild exposures for a different EVA day or a
    different assigned crew member and still get fully reproducible output.
    """
    rng = random.Random(RNG_SEED)
    exposures: list[DailyExposure] = []

    for day in range(1, TOTAL_DAYS + 1):
        exercise_unavailable = EXERCISE_FAILURE_START_DAY <= day <= EXERCISE_FAILURE_END_DAY
        is_storm_day = day == RADIATION_STORM_DAY
        is_eva_day = day == eva_day

        for crew in crew_profiles:
            sleep_hours = _clamp(_BASELINE.sleep_hours + rng.uniform(-0.6, 0.6), 4.0, 10.0)

            exercise_duration_min = (
                0.0
                if exercise_unavailable
                else _clamp(_BASELINE.exercise_duration_min + rng.uniform(-15.0, 15.0), 60.0, 180.0)
            )

            radiation_dose = _BASELINE.radiation_dose * (3.5 if is_storm_day else 1.0)
            radiation_dose = _clamp(radiation_dose + rng.uniform(-0.0005, 0.0005), 0.0, 1.0)

            eva_load = 0.40 if (is_eva_day and crew.id == eva_crew_id) else 0.0

            workload = _BASELINE.operational_workload
            if exercise_unavailable:
                workload += 0.05  # contingency management during the equipment failure
            if is_eva_day and crew.id == eva_crew_id:
                workload += 0.15  # EVA day, for the assigned crew member only
            operational_workload = _clamp(workload + rng.uniform(-0.05, 0.05), 0.0, 1.0)

            co2_level_ppm = _clamp(_BASELINE.co2_level_ppm + rng.uniform(-150.0, 150.0), 3800.0, 5200.0)

            exposures.append(
                DailyExposure(
                    mission_id=MISSION_ID,
                    crew_id=crew.id,
                    day=day,
                    radiation_dose=radiation_dose,
                    sleep_hours=sleep_hours,
                    exercise_duration_min=exercise_duration_min,
                    eva_load=eva_load,
                    operational_workload=operational_workload,
                    co2_level_ppm=co2_level_ppm,
                )
            )

    return exposures


@dataclass(frozen=True)
class Ares180Dataset:
    mission: MissionConfig
    crew_profiles: list[CrewProfile]
    events: list[SimulationEvent]
    daily_exposures: list[DailyExposure]


def build_ares180_dataset() -> Ares180Dataset:
    crew_profiles = build_crew_profiles()
    return Ares180Dataset(
        mission=build_mission_config(),
        crew_profiles=crew_profiles,
        events=build_mission_events(),
        daily_exposures=build_daily_exposures(crew_profiles),
    )
