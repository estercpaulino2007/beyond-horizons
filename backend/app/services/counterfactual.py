"""Counterfactual engine (spec section 12, "Contrafactuais").

Compares three alternatives for the Ares-180 day-145 EVA decision:

  A. Maintain  -- proceed as scheduled, Atlas performs the EVA on day 145.
  B. Delay     -- postpone the EVA by 10 days (day 155), same crew member.
  C. Reassign + Recovery -- a different crew member performs the EVA on
     day 145, and a sleep-recovery countermeasure is applied mission-wide.

Each alternative is a *full re-run* of the Step-3 simulation engine over a
scenario rebuilt from the Step-2 seed generator (not a hand-tweaked copy of
the baseline trajectory), so every difference between alternatives is a
genuine consequence of the changed inputs, not something asserted after
the fact.

## A finding this module surfaced, not one it was designed to produce

Running this module for real (not just unit-testing it in isolation) shows
that alternative B does **not** clearly reduce peak operational risk
relative to A, contradicting the specification's own illustrative example
("B claramente reduz risco imediato mas atrasa a missão"). The mechanism is
fully traceable and is forced by the specification's own numbers, not by
any choice made here: the exercise-module failure runs through day 154
(EXERCISE_FAILURE_END_DAY), and a 10-day delay from day 145
(EVA_DAY + DELAY_DAYS) lands the EVA on day 155 -- the day immediately
after the failure ends, when `muscle_recovery` is at its lowest point of
the whole window (only one day of exercise has had a chance to help). The
EVA's own physical and cognitive load then compounds on an
already-depleted crew member, giving B a *higher* peak operational risk
than A in this seed (0.596 vs 0.549), and a lower EVA completion
probability. On the real Ares-180 numbers, C (reassign + recovery) comes out
ahead of both A and B on peak_operational_risk, peak_cognitive_risk and
eva_completion_probability -- but not on every metric: B has the lowest
peak_musculoskeletal_risk of the three (0.561, vs C's 0.594 and A's 0.567),
because C's reassigned crew member (Nova) has a musculoskeletal, not
cognitive, primary_vulnerability (see "Choices this module makes" below).
C is the better overall choice on the metrics this scenario's EVA decision
actually turns on (cognitive load and operational risk), not on literally
every number this module reports.

This is documented as reconciliation issue #12 in docs/methodology.md
rather than adjusted to match the specification's assumption: the
specification's own event timing (day-154 failure end, day-145 EVA + a
10-day delay) is what produces this result, and changing the model to
force B to look better would mean the numbers stop reflecting what the
engine actually computes. The results below are exactly what the engine
produces; `tests/test_counterfactual.py` asserts the *true* consistency
property -- that each alternative's peak risk and its EVA completion
probability move together (higher risk means lower completion probability,
never the reverse) -- rather than asserting the specification's example
outcome, which the model does not reproduce for this scenario.

## Choices this module makes that the specification does not fix

- **Reassigned crew member (alternative C):** Nova. The specification
  never names who Atlas would be reassigned to. Nova's baseline
  `cognitive_resilience` (0.72) is the highest of the four, and her
  `primary_vulnerability` is musculoskeletal, not cognitive -- since the
  EVA's dominant risk driver for Atlas was cognitive load compounding on
  top of the day-143 storm, reassigning to the crew member least exposed
  to that specific risk is the most defensible choice available, not an
  arbitrary one. This is a scenario-authoring decision, not a spec fact.
- **Comparison window:** peaks and mean uncertainty are computed over days
  143-160 (the radiation storm through 15 days after the original EVA
  date), for whichever crew member actually performs the EVA under that
  alternative. Comparing over the full 180-day mission would dilute the
  decision's actual near-term consequences among 180 days of otherwise
  near-identical trajectory; the specification does not fix a window, so
  this one was chosen to bracket the decision's real effects.
- **musculoskeletal_risk** is not a field the engine computes directly
  (Step 3's DailyCrewState has `bone_risk` and `muscle_recovery`
  separately). This module reports `musculoskeletal_risk = 0.5*bone_risk +
  0.5*(1 - muscle_recovery)`, a simple average of the two, purely for this
  comparison's reporting -- it does not feed back into operational_risk.
- **EVA completion probability** is a bounded heuristic, not a validated
  model: `1 - 0.5*operational_risk - 0.5*cognitive_risk` on the EVA day
  itself, clamped to [0.05, 0.99] (never exactly certain or impossible).
  Every result carries language marking this explicitly as an exploratory
  estimate (see RESULT_LANGUAGE_NOTE below), matching spec section 13's
  communication rule, reused here for the same reason.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domain.ares180_seed import (
    EVA_DAY,
    EVA_ORIGINAL_CREW_ID,
    RADIATION_STORM_DAY,
    build_crew_profiles,
    build_daily_exposures,
    build_mission_config,
    build_mission_events,
)
from app.schemas.countermeasure import CountermeasurePlan
from app.schemas.simulation_state import RiskResult
from app.services.simulation_engine import simulate_mission

Alternative = Literal["A", "B", "C"]

DELAY_DAYS = 10
DELAYED_EVA_DAY = EVA_DAY + DELAY_DAYS  # 155

# (this module's own choice) see module docstring.
REASSIGNED_CREW_ID = "nova"

COMPARISON_WINDOW_START = RADIATION_STORM_DAY  # 143
COMPARISON_WINDOW_END = EVA_DAY + 15  # 160

RESULT_LANGUAGE_NOTE = (
    "Exploratory synthetic comparison. Peaks, mean uncertainty and EVA completion "
    "probability are heuristic estimates from the simulation engine, not validated "
    "predictions or medical guidance."
)

ALTERNATIVE_DESCRIPTIONS: dict[Alternative, str] = {
    "A": "Maintain EVA: proceed with the EVA as scheduled on day 145 with the originally assigned crew member.",
    "B": f"Delay EVA: postpone the EVA by {DELAY_DAYS} days (to day {DELAYED_EVA_DAY}), same crew member.",
    "C": (
        f"Reassign + Recovery: {REASSIGNED_CREW_ID} performs the EVA on day 145 instead, "
        "with a sleep-recovery protocol applied mission-wide."
    ),
}

_SLEEP_RECOVERY_COUNTERMEASURE = CountermeasurePlan(
    id="cm_sleep_recovery_protocol",
    name="Sleep recovery protocol",
    target_risk="cognitive_operational",
    description="Adjusted schedule and sleep hygiene support applied to reduce accumulated sleep debt.",
    limitations=[
        "Effect size is a scenario parameter, not a validated intervention effect.",
        "Depends on schedule flexibility and crew compliance (NASA HRP Sleep).",
    ],
)


@dataclass(frozen=True)
class AlternativeScenario:
    alternative: Alternative
    eva_day: int
    eva_crew_id: str
    countermeasures: list[CountermeasurePlan]


def _scenario_for(alternative: Alternative) -> AlternativeScenario:
    if alternative == "A":
        return AlternativeScenario("A", EVA_DAY, EVA_ORIGINAL_CREW_ID, [])
    if alternative == "B":
        return AlternativeScenario("B", DELAYED_EVA_DAY, EVA_ORIGINAL_CREW_ID, [])
    if alternative == "C":
        return AlternativeScenario("C", EVA_DAY, REASSIGNED_CREW_ID, [_SLEEP_RECOVERY_COUNTERMEASURE])
    raise ValueError(f"unknown alternative {alternative!r}")  # pragma: no cover (Literal-guarded)


def _run_alternative(alternative: Alternative) -> tuple[AlternativeScenario, list[RiskResult]]:
    scenario = _scenario_for(alternative)
    crew_profiles = build_crew_profiles()
    exposures = build_daily_exposures(crew_profiles, eva_day=scenario.eva_day, eva_crew_id=scenario.eva_crew_id)
    events = build_mission_events(eva_day=scenario.eva_day)
    results = simulate_mission(
        build_mission_config(), crew_profiles, exposures, events, scenario.countermeasures
    )
    return scenario, results[scenario.eva_crew_id]


@dataclass(frozen=True)
class AlternativeComparison:
    alternative: Alternative
    description: str
    eva_crew_id: str
    eva_day: int
    peak_operational_risk: float
    peak_cognitive_risk: float
    peak_musculoskeletal_risk: float
    mean_uncertainty: float
    eva_completion_probability: float
    top_drivers: list[str]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _compare_one(scenario: AlternativeScenario, trajectory: list[RiskResult]) -> AlternativeComparison:
    window = [r for r in trajectory if COMPARISON_WINDOW_START <= r.day <= COMPARISON_WINDOW_END]
    if not window:  # pragma: no cover (defensive; window always covers the seed's 180 days)
        raise ValueError("comparison window has no days for this trajectory")

    peak_operational_risk = max(r.scores.operational_risk for r in window)
    peak_cognitive_risk = max(1 - r.scores.cognitive_resilience for r in window)
    peak_musculoskeletal_risk = max(
        0.5 * r.scores.bone_risk + 0.5 * (1 - r.scores.muscle_recovery) for r in window
    )
    mean_uncertainty = sum(r.uncertainty for r in window) / len(window)

    eva_day_result = next((r for r in trajectory if r.day == scenario.eva_day), None)
    if eva_day_result is None:  # pragma: no cover (defensive; eva_day is always within 1..180 here)
        eva_completion_probability = 0.5
    else:
        eva_completion_probability = _clamp(
            1
            - 0.5 * eva_day_result.scores.operational_risk
            - 0.5 * (1 - eva_day_result.scores.cognitive_resilience),
            low=0.05,
            high=0.99,
        )

    driver_counts: dict[str, int] = {}
    for r in window:
        for driver in r.top_drivers:
            driver_counts[driver.name] = driver_counts.get(driver.name, 0) + 1
    top_drivers = [name for name, _ in sorted(driver_counts.items(), key=lambda kv: kv[1], reverse=True)][:3]

    return AlternativeComparison(
        alternative=scenario.alternative,
        description=ALTERNATIVE_DESCRIPTIONS[scenario.alternative],
        eva_crew_id=scenario.eva_crew_id,
        eva_day=scenario.eva_day,
        peak_operational_risk=peak_operational_risk,
        peak_cognitive_risk=peak_cognitive_risk,
        peak_musculoskeletal_risk=peak_musculoskeletal_risk,
        mean_uncertainty=mean_uncertainty,
        eva_completion_probability=eva_completion_probability,
        top_drivers=top_drivers,
    )


def compare_counterfactuals() -> list[AlternativeComparison]:
    """Runs A, B and C for the Ares-180 day-145 EVA decision and returns
    their comparison, in that order. Ares-180 specific by design (the day
    numbers and crew IDs above are this scenario's own); a second mission
    would need its own counterfactual module, not a parameterised version
    of this one.
    """
    comparisons = []
    for alternative in ("A", "B", "C"):
        scenario, trajectory = _run_alternative(alternative)
        comparisons.append(_compare_one(scenario, trajectory))
    return comparisons
