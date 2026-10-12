"""Daily simulation engine (spec section 11, "Motor de risco e simulação").

## Which formula this uses, and why (docs/methodology.md, reconciliation #2)

The project's specification documents gave three different formulas for
operational_risk. This engine uses the one from the main implementation
guide (section 11), because that document is the project's primary
execution plan:

    operational_risk = sigmoid(
        0.30 * radiation_burden
        + 0.25 * sleep_debt
        + 0.20 * (1 - cognitive_resilience)
        + 0.15 * eva_load
        + 0.10 * (1 - muscle_recovery)
    )

The weights already sum to 1.0. `sigmoid` here is a *centered, steepened*
logistic curve (see `_sigmoid` below) rather than the raw logistic function:
a raw `1/(1+exp(-x))` over x in [0, 1] only ever outputs [0.5, 0.73], which
compresses almost the whole scenario into the "moderate" band. Centering
at 0.5 and steepening the slope is this engine's own calibration choice
(a synthetic_parameter, like everything else here), made so the score
actually spans the low/moderate/high/critical bands defined in
app/domain/risk_bands.py.

## Why every update rule below is bounded (reconciliation #3)

The specification's own per-variable update rules (e.g.
`sleep_debt += 8 - hours`) grow without bound, even though the same
document declares these fields must stay in [0, 1]. Every rule in this
engine instead moves the previous day's value toward a day's "pressure" or
"target" using a saturating update -- either

    new = old + (1 - old) * rate * pressure          (accumulates, can't exceed 1)
    new = old - old * rate * relief                  (decays, can't go below 0)

or an exponential move toward a bounded target

    new = old + rate * (target - old)                (target in [0,1] => new in [0,1])

so the [0, 1] bound holds by construction, not by an after-the-fact clamp
that would silently hide a bug. `_clamp` is still applied defensively.

## Every rate constant below is a synthetic_parameter

None of the numeric constants in this module (accumulation rates, decay
rates, the sigmoid's centering and steepness) come from a NASA source. They
were chosen so the Ares-180 scenario behaves the way the specification
describes it qualitatively (radiation accumulates and does not reverse;
sleep debt accumulates and recovers; exercise helps muscle/bone and its
loss hurts them; an EVA temporarily raises load and risk) -- not because
any of them are measured quantities. See docs/methodology.md, "Simulation
engine formulas", for the full table.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.core.notices import SIMULATION_DISCLAIMER
from app.domain.risk_bands import band_for_risk
from app.schemas.countermeasure import CountermeasurePlan, TargetRisk
from app.schemas.crew import CrewProfile
from app.schemas.events import SimulationEvent
from app.schemas.exposure import DailyExposure
from app.schemas.mission import MissionConfig
from app.schemas.simulation_state import DailyCrewState, RiskDriver, RiskResult

# ---------------------------------------------------------------------------
# Rate constants (all synthetic_parameter; see module docstring).
# ---------------------------------------------------------------------------

SLEEP_NEED_HOURS = 7.5
SLEEP_DEBT_ACCUMULATION_RATE = 0.10
SLEEP_DEBT_RECOVERY_RATE = 0.35

RADIATION_DAILY_DOSE_REFERENCE = 0.20  # normalises DailyExposure.radiation_dose to a 0-1 "pressure"
RADIATION_ACCUMULATION_RATE = 0.12  # radiation_burden only ever grows (see module docstring)

MUSCLE_EXERCISE_DURATION_REFERENCE_MIN = 120.0
MUSCLE_RECOVERY_GAIN_RATE = 0.30
MUSCLE_RECOVERY_DECAY_RATE = 0.12  # applies when exercise is unavailable or EVA load is high

BONE_RISK_ACCUMULATION_RATE = 0.05  # slow: bone loss accrues gradually even without exercise
BONE_RISK_RECOVERY_RATE = 0.02  # slower still: bone recovery is slow (docs/limitations.md)

COGNITIVE_RESILIENCE_ADAPTATION_RATE = 0.40

BASE_UNCERTAINTY = 0.12
STORM_UNCERTAINTY_BUMP = 0.15
EQUIPMENT_FAILURE_UNCERTAINTY_BUMP = 0.05
EVA_UNCERTAINTY_BUMP = 0.10

SIGMOID_CENTER = 0.5
SIGMOID_STEEPNESS = 6.0

OPERATIONAL_RISK_WEIGHTS = {
    "radiation_burden": 0.30,
    "sleep_debt": 0.25,
    "cognitive_load": 0.20,  # (1 - cognitive_resilience)
    "eva_load": 0.15,
    "muscle_deconditioning": 0.10,  # (1 - muscle_recovery)
}

DRIVER_LABELS = {
    "radiation_burden": "Radiation burden",
    "sleep_debt": "Sleep debt",
    "cognitive_load": "Cognitive load",
    "eva_load": "EVA load",
    "muscle_deconditioning": "Muscle deconditioning",
}

# (this engine's own choice) how an active CountermeasurePlan nudges the
# rate constants above, keyed by the plan's target_risk. Multiplicative, so
# several countermeasures on the same target_risk compound.
COUNTERMEASURE_EFFECTS: dict[TargetRisk, dict[str, float]] = {
    "musculoskeletal": {
        "muscle_gain_rate_multiplier": 1.5,
        "bone_accumulation_rate_multiplier": 0.6,
    },
    "radiation": {
        "radiation_accumulation_rate_multiplier": 0.7,
    },
    "cognitive_operational": {
        "sleep_recovery_rate_multiplier": 1.6,
        "cognitive_adaptation_rate_multiplier": 1.2,
    },
}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-SIGMOID_STEEPNESS * (x - SIGMOID_CENTER)))


@dataclass(frozen=True)
class _EffectiveRates:
    """Rate constants after applying any active countermeasures."""

    sleep_recovery_rate: float = SLEEP_DEBT_RECOVERY_RATE
    radiation_accumulation_rate: float = RADIATION_ACCUMULATION_RATE
    muscle_gain_rate: float = MUSCLE_RECOVERY_GAIN_RATE
    bone_accumulation_rate: float = BONE_RISK_ACCUMULATION_RATE
    cognitive_adaptation_rate: float = COGNITIVE_RESILIENCE_ADAPTATION_RATE


def _effective_rates(countermeasures: list[CountermeasurePlan]) -> _EffectiveRates:
    rates = _EffectiveRates()
    for plan in countermeasures:
        effect = COUNTERMEASURE_EFFECTS.get(plan.target_risk)
        if not effect:
            continue
        rates = _EffectiveRates(
            sleep_recovery_rate=rates.sleep_recovery_rate
            * effect.get("sleep_recovery_rate_multiplier", 1.0),
            radiation_accumulation_rate=rates.radiation_accumulation_rate
            * effect.get("radiation_accumulation_rate_multiplier", 1.0),
            muscle_gain_rate=rates.muscle_gain_rate * effect.get("muscle_gain_rate_multiplier", 1.0),
            bone_accumulation_rate=rates.bone_accumulation_rate
            * effect.get("bone_accumulation_rate_multiplier", 1.0),
            cognitive_adaptation_rate=rates.cognitive_adaptation_rate
            * effect.get("cognitive_adaptation_rate_multiplier", 1.0),
        )
    return rates


@dataclass(frozen=True)
class _ActiveEventEffects:
    """Extra qualitative pressure from SimulationEvents active on a given
    day, beyond what is already encoded numerically in DailyExposure.
    """

    cognitive_pressure: float = 0.0
    storm_active: bool = False
    equipment_failure_active: bool = False
    eva_active: bool = False


def _active_event_effects(events: list[SimulationEvent], day: int) -> _ActiveEventEffects:
    cognitive_pressure = 0.0
    storm_active = False
    equipment_failure_active = False
    eva_active = False
    for event in events:
        if not (event.day_start <= day <= event.day_end):
            continue
        if event.type == "radiation_storm":
            storm_active = True
            cognitive_pressure += event.effects.get("cognitive_impact", 0.0)
        elif event.type == "equipment_failure":
            equipment_failure_active = True
        elif event.type == "eva":
            eva_active = True
            cognitive_pressure += event.effects.get("cognitive_load", 0.0)
    return _ActiveEventEffects(
        cognitive_pressure=_clamp(cognitive_pressure),
        storm_active=storm_active,
        equipment_failure_active=equipment_failure_active,
        eva_active=eva_active,
    )


@dataclass(frozen=True)
class _RawState:
    """Internal, unvalidated carrier for the day-to-day accumulators.

    DailyCrewState (the public schema) requires day >= 1, so it cannot
    represent the "before day 1" starting point. This lightweight type
    carries the same six accumulator fields through _initial_state/_step;
    _score_day converts to a validated DailyCrewState once an actual day
    number (>= 1) is known.
    """

    radiation_burden: float
    sleep_debt: float
    muscle_recovery: float
    bone_risk: float
    cognitive_resilience: float


def _initial_state(crew: CrewProfile) -> _RawState:
    """Day-1 starting point: accumulators (radiation_burden, sleep_debt,
    bone_risk) start at zero (nothing has accumulated yet); capacities
    (muscle_recovery, cognitive_resilience) start at the crew member's own
    baseline.
    """
    return _RawState(
        radiation_burden=0.0,
        sleep_debt=0.0,
        muscle_recovery=crew.baseline.muscle_recovery,
        bone_risk=0.0,
        cognitive_resilience=crew.baseline.cognitive_resilience,
    )


def _step(
    previous: _RawState,
    crew: CrewProfile,
    exposure: DailyExposure,
    event_effects: _ActiveEventEffects,
    rates: _EffectiveRates,
) -> _RawState:
    """Advance one crew member's state by exactly one day."""

    # --- sleep_debt: saturating accumulate/recover around SLEEP_NEED_HOURS.
    shortfall = (SLEEP_NEED_HOURS - exposure.sleep_hours) / SLEEP_NEED_HOURS
    if shortfall >= 0:
        sleep_debt = previous.sleep_debt + (1 - previous.sleep_debt) * SLEEP_DEBT_ACCUMULATION_RATE * shortfall
    else:
        sleep_debt = previous.sleep_debt - previous.sleep_debt * rates.sleep_recovery_rate * (-shortfall)
    sleep_debt = _clamp(sleep_debt)

    # --- radiation_burden: monotonic saturating accumulation; never
    # recovers on its own (see module docstring and docs/limitations.md).
    radiation_pressure = _clamp(exposure.radiation_dose / RADIATION_DAILY_DOSE_REFERENCE)
    sensitivity = 0.5 + 0.5 * crew.baseline.radiation_sensitivity  # 0.5-1.0: sensitivity modulates, never zeroes, the effect
    radiation_burden = previous.radiation_burden + (1 - previous.radiation_burden) * (
        rates.radiation_accumulation_rate * sensitivity * radiation_pressure
    )
    radiation_burden = _clamp(radiation_burden)

    # --- muscle_recovery: gains when exercise happened, decays when the
    # module is unavailable (exercise_duration_min == 0) or EVA load is high.
    exercise_effect = _clamp(exposure.exercise_duration_min / MUSCLE_EXERCISE_DURATION_REFERENCE_MIN)
    if exposure.exercise_duration_min > 0:
        muscle_recovery = previous.muscle_recovery + (1 - previous.muscle_recovery) * (
            rates.muscle_gain_rate * exercise_effect
        )
    else:
        muscle_recovery = previous.muscle_recovery - previous.muscle_recovery * MUSCLE_RECOVERY_DECAY_RATE
    if exposure.eva_load > 0:
        muscle_recovery -= previous.muscle_recovery * MUSCLE_RECOVERY_DECAY_RATE * exposure.eva_load
    muscle_recovery = _clamp(muscle_recovery)

    # --- bone_risk: accumulates faster without exercise, recovers slowly
    # (recovery << accumulation, matching the spec's own recovery notes).
    susceptibility = 0.5 + 0.5 * crew.baseline.bone_loss_susceptibility
    if exposure.exercise_duration_min > 0:
        bone_risk = previous.bone_risk - previous.bone_risk * BONE_RISK_RECOVERY_RATE * exercise_effect
    else:
        bone_risk = previous.bone_risk + (1 - previous.bone_risk) * (
            rates.bone_accumulation_rate * susceptibility
        )
    bone_risk = _clamp(bone_risk)

    # --- cognitive_resilience: eases toward a target set by sleep debt,
    # radiation burden and any event cognitive pressure (storm/EVA).
    cognitive_target = _clamp(
        crew.baseline.cognitive_resilience
        - 0.35 * sleep_debt
        - 0.15 * radiation_burden
        - event_effects.cognitive_pressure
    )
    cognitive_resilience = previous.cognitive_resilience + rates.cognitive_adaptation_rate * (
        cognitive_target - previous.cognitive_resilience
    )
    cognitive_resilience = _clamp(cognitive_resilience)

    return _RawState(
        radiation_burden=radiation_burden,
        sleep_debt=sleep_debt,
        muscle_recovery=muscle_recovery,
        bone_risk=bone_risk,
        cognitive_resilience=cognitive_resilience,
    )


def _score_day(
    crew_id: str,
    mission_id: str,
    day: int,
    state: _RawState,
    exposure: DailyExposure,
    event_effects: _ActiveEventEffects,
) -> RiskResult:
    """Compute operational_risk, uncertainty and top_drivers for a day's
    state (module docstring has the formula and why it is centered/steepened).
    """
    terms = {
        "radiation_burden": OPERATIONAL_RISK_WEIGHTS["radiation_burden"] * state.radiation_burden,
        "sleep_debt": OPERATIONAL_RISK_WEIGHTS["sleep_debt"] * state.sleep_debt,
        "cognitive_load": OPERATIONAL_RISK_WEIGHTS["cognitive_load"] * (1 - state.cognitive_resilience),
        "eva_load": OPERATIONAL_RISK_WEIGHTS["eva_load"] * exposure.eva_load,
        "muscle_deconditioning": OPERATIONAL_RISK_WEIGHTS["muscle_deconditioning"]
        * (1 - state.muscle_recovery),
    }
    z = sum(terms.values())
    operational_risk = _clamp(_sigmoid(z))

    uncertainty = _clamp(
        BASE_UNCERTAINTY
        + (STORM_UNCERTAINTY_BUMP if event_effects.storm_active else 0.0)
        + (EQUIPMENT_FAILURE_UNCERTAINTY_BUMP if event_effects.equipment_failure_active else 0.0)
        + (EVA_UNCERTAINTY_BUMP if event_effects.eva_active else 0.0)
    )

    total_terms = sum(terms.values()) or 1e-9  # avoid division by zero on an all-zero day
    drivers = sorted(
        (
            RiskDriver(name=DRIVER_LABELS[key], contribution=_clamp(value / total_terms))
            for key, value in terms.items()
            if value > 0
        ),
        key=lambda d: d.contribution,
        reverse=True,
    )[:3]

    daily_crew_state = DailyCrewState(
        crew_id=crew_id,
        mission_id=mission_id,
        day=day,
        radiation_burden=state.radiation_burden,
        sleep_debt=state.sleep_debt,
        muscle_recovery=state.muscle_recovery,
        bone_risk=state.bone_risk,
        cognitive_resilience=state.cognitive_resilience,
        operational_risk=operational_risk,
        uncertainty=uncertainty,
    )

    return RiskResult(
        crew_id=crew_id,
        mission_id=mission_id,
        day=day,
        scores=daily_crew_state,
        band=band_for_risk(operational_risk),
        uncertainty=uncertainty,
        top_drivers=drivers,
        disclaimer=SIMULATION_DISCLAIMER,
    )


def simulate_mission(
    mission: MissionConfig,
    crew_profiles: list[CrewProfile],
    exposures: list[DailyExposure],
    events: list[SimulationEvent] | None = None,
    countermeasures: list[CountermeasurePlan] | None = None,
) -> dict[str, list[RiskResult]]:
    """Run the daily engine for every crew member across the whole mission.

    Returns {crew_id: [RiskResult, ...]} with one entry per day, ordered by
    day, for each crew member in `crew_profiles`.
    """
    events = events or []
    countermeasures = countermeasures or []
    rates = _effective_rates(countermeasures)

    exposures_by_crew_day: dict[tuple[str, int], DailyExposure] = {
        (e.crew_id, e.day): e for e in exposures
    }

    results: dict[str, list[RiskResult]] = {}
    for crew in crew_profiles:
        state = _initial_state(crew)
        crew_results: list[RiskResult] = []
        for day in range(1, mission.duration_days + 1):
            exposure = exposures_by_crew_day.get((crew.id, day))
            if exposure is None:
                raise ValueError(f"missing DailyExposure for crew={crew.id!r} day={day}")
            event_effects = _active_event_effects(events, day)
            state = _step(state, crew, exposure, event_effects, rates)
            crew_results.append(
                _score_day(crew.id, mission.mission_id, day, state, exposure, event_effects)
            )
        results[crew.id] = crew_results
    return results
