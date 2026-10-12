"""Debate Chamber (spec section 14): an auditable, deterministic multi-role
critique of the day-145 EVA counterfactual comparison.

This is **not** an LLM roleplay. Each role's recommendation and utility are
computed directly from the Step-5 counterfactual engine's real output
(app/services/counterfactual.py) through one named, fixed formula per role
-- this project's "nothing invented" rule applies here exactly as it does
everywhere else: every number in a DebateResult traces back to a real
simulated trajectory, and every formula is written down, not implied.

Four roles, four different lenses on the same three real comparisons:

- mission_commander: mission-success framing. utility = eva_completion_probability - peak_operational_risk.
- flight_surgeon: crew-health framing, ignores mission completion entirely.
  utility = -(0.5*peak_cognitive_risk + 0.5*peak_musculoskeletal_risk).
- science_officer: data-quality framing. utility = eva_completion_probability - mean_uncertainty.
- skeptic: never recommends (enforced by AgentRecommendation's own validator,
  app/schemas/debate.py); instead names one real, computed caveat -- a metric
  where the overall favorite does not actually win, or, if there is truly
  none, says so and names the comparison's own structural limits instead.

On the real Ares-180 numbers, all three non-skeptic roles land on the same
alternative (C), which is itself a real finding worth reporting honestly:
see `tests/test_debate.py` for what happens if that ever changes.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone

from app.domain.ares180_seed import EVA_DAY
from app.schemas.debate import AgentRecommendation, DebateResult
from app.services.counterfactual import Alternative, AlternativeComparison, compare_counterfactuals

MISSION_ID = "ares-180"

UTILITY_FORMULAS: dict[str, str] = {
    "mission_commander": "eva_completion_probability - peak_operational_risk",
    "flight_surgeon": "-(0.5 * peak_cognitive_risk + 0.5 * peak_musculoskeletal_risk)",
    "science_officer": "eva_completion_probability - mean_uncertainty",
}

_SHARED_LIMITATIONS = [
    "Utility formula is this project's own operational framing, not a validated decision model.",
    "eva_completion_probability is a bounded heuristic (app/services/counterfactual.py), not a validated prediction.",
]


def _clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _mission_commander_utility(c: AlternativeComparison) -> float:
    return _clamp(c.eva_completion_probability - c.peak_operational_risk)


def _flight_surgeon_utility(c: AlternativeComparison) -> float:
    return _clamp(-(0.5 * c.peak_cognitive_risk + 0.5 * c.peak_musculoskeletal_risk))


def _science_officer_utility(c: AlternativeComparison) -> float:
    return _clamp(c.eva_completion_probability - c.mean_uncertainty)


def _confidence(c: AlternativeComparison) -> float:
    # Lower mean_uncertainty in the comparison window -> higher confidence
    # in whichever alternative utility picked. Same window, same clamp
    # convention as the rest of this project's Unit fields.
    return max(0.0, min(1.0, 1 - c.mean_uncertainty))


def _best(comparisons: list[AlternativeComparison], utility_fn: Callable[[AlternativeComparison], float]) -> AlternativeComparison:
    return max(comparisons, key=utility_fn)


def _mission_commander_recommendation(comparisons: list[AlternativeComparison]) -> AgentRecommendation:
    best = _best(comparisons, _mission_commander_utility)
    utility = _mission_commander_utility(best)
    return AgentRecommendation(
        role="mission_commander",
        recommendation=best.alternative,
        utility=utility,
        confidence=_confidence(best),
        justification=(
            f"Alternative {best.alternative} maximizes {UTILITY_FORMULAS['mission_commander']} "
            f"({best.eva_completion_probability:.3f} - {best.peak_operational_risk:.3f} = {utility:.3f}), "
            "the mission-success-weighted view of this decision: get the EVA done, with the lowest "
            "peak operational risk along the way."
        ),
        limitations=[*_SHARED_LIMITATIONS, "Does not weigh crew physiological cost on its own terms."],
    )


def _flight_surgeon_recommendation(comparisons: list[AlternativeComparison]) -> AgentRecommendation:
    best = _best(comparisons, _flight_surgeon_utility)
    utility = _flight_surgeon_utility(best)
    return AgentRecommendation(
        role="flight_surgeon",
        recommendation=best.alternative,
        utility=utility,
        confidence=_confidence(best),
        justification=(
            f"Alternative {best.alternative} maximizes {UTILITY_FORMULAS['flight_surgeon']} "
            f"(-(0.5*{best.peak_cognitive_risk:.3f} + 0.5*{best.peak_musculoskeletal_risk:.3f}) = {utility:.3f}), "
            "a crew-health-only view that deliberately ignores mission completion."
        ),
        limitations=[
            *_SHARED_LIMITATIONS,
            "peak_musculoskeletal_risk is itself a reporting-only average (0.5*bone_risk + "
            "0.5*(1-muscle_recovery)), not a value the engine computes directly.",
        ],
    )


def _science_officer_recommendation(comparisons: list[AlternativeComparison]) -> AgentRecommendation:
    best = _best(comparisons, _science_officer_utility)
    utility = _science_officer_utility(best)
    return AgentRecommendation(
        role="science_officer",
        recommendation=best.alternative,
        utility=utility,
        confidence=_confidence(best),
        justification=(
            f"Alternative {best.alternative} maximizes {UTILITY_FORMULAS['science_officer']} "
            f"({best.eva_completion_probability:.3f} - {best.mean_uncertainty:.3f} = {utility:.3f}), "
            "favoring the alternative most likely to yield a completed, usable EVA under the "
            "comparison window's shared uncertainty level."
        ),
        limitations=[
            *_SHARED_LIMITATIONS,
            "mean_uncertainty is identical across all three alternatives in this seed (it does not "
            "vary with the EVA decision itself), so this role's ranking is driven entirely by "
            "eva_completion_probability here -- not evidence that uncertainty is irrelevant in general.",
        ],
    )


_METRIC_GETTERS: list[tuple[str, Callable[[AlternativeComparison], float], Callable]] = [
    ("peak_operational_risk", lambda c: c.peak_operational_risk, min),
    ("peak_cognitive_risk", lambda c: c.peak_cognitive_risk, min),
    ("peak_musculoskeletal_risk", lambda c: c.peak_musculoskeletal_risk, min),
    ("eva_completion_probability", lambda c: c.eva_completion_probability, max),
]


def _skeptic_recommendation(comparisons: list[AlternativeComparison], recommended: dict[str, Alternative]) -> AgentRecommendation:
    distinct = set(recommended.values())
    by_alt = {c.alternative: c for c in comparisons}

    if len(distinct) == 1:
        winner_id = next(iter(distinct))
        winner = by_alt[winner_id]
        divergent: tuple[str, AlternativeComparison] | None = None
        for metric_name, getter, pick in _METRIC_GETTERS:
            metric_best = pick(comparisons, key=getter)
            if metric_best.alternative != winner_id:
                divergent = (metric_name, metric_best)
                break

        if divergent is not None:
            metric_name, metric_best = divergent
            justification = (
                f"Every role recommends alternative {winner_id}, but {winner_id} does not win on "
                f"every metric: alternative {metric_best.alternative} has the better {metric_name} "
                f"({getattr(metric_best, metric_name):.3f} vs {winner_id}'s {getattr(winner, metric_name):.3f}). "
                "A utility score that aggregates several risk dimensions can hide a dimension where "
                "the 'winning' alternative is not actually best -- check the dimension your decision "
                "cares about most before treating this consensus as final."
            )
        else:
            justification = (
                f"Every role recommends alternative {winner_id}, and {winner_id} genuinely has the best "
                "value on every tracked metric in this comparison -- a real finding in this synthetic "
                "scenario, not an averaging artifact. The remaining caveat is structural: "
                f"mean_uncertainty ({winner.mean_uncertainty:.3f}) is identical across all three "
                "alternatives in this window, and eva_completion_probability is a bounded heuristic, "
                "not a validated prediction -- none of these numbers reflect new information collected "
                "under any alternative."
            )
    else:
        parts = ", ".join(f"{role}->{alt}" for role, alt in sorted(recommended.items()))
        justification = (
            f"The roles disagree ({parts}), which is itself informative: their utility formulas weigh "
            "the same three real comparisons differently on purpose (mission success vs. crew health "
            "vs. data quality), so a split is a genuine trade-off exposed by the decision, not noise."
        )

    return AgentRecommendation(
        role="skeptic",
        recommendation=None,
        utility=None,
        confidence=None,
        justification=justification,
        limitations=[
            "The skeptic role critiques the other roles' reasoning; it does not run an independent model.",
            "Every comparison here shares the same simulation engine and the same scenario-authoring "
            "choices (app/services/counterfactual.py) -- this critique cannot surface a blind spot "
            "common to all four roles.",
        ],
    )


def run_debate_chamber() -> DebateResult:
    """Runs the counterfactual comparison once and derives all four roles'
    recommendations from that single real result -- never four separate,
    silently-inconsistent re-runs."""
    comparisons = compare_counterfactuals()

    mission_commander = _mission_commander_recommendation(comparisons)
    flight_surgeon = _flight_surgeon_recommendation(comparisons)
    science_officer = _science_officer_recommendation(comparisons)

    recommended: dict[str, Alternative] = {
        "mission_commander": mission_commander.recommendation,  # type: ignore[dict-item]
        "flight_surgeon": flight_surgeon.recommendation,  # type: ignore[dict-item]
        "science_officer": science_officer.recommendation,  # type: ignore[dict-item]
    }
    skeptic = _skeptic_recommendation(comparisons, recommended)

    distinct = set(recommended.values())
    disagreement_summary = None
    if len(distinct) > 1:
        disagreement_summary = "; ".join(f"{role} recommends {alt}" for role, alt in sorted(recommended.items()))

    return DebateResult(
        mission_id=MISSION_ID,
        day=EVA_DAY,
        alternatives=sorted({c.alternative for c in comparisons}),
        recommendations=[mission_commander, flight_surgeon, science_officer, skeptic],
        disagreement_summary=disagreement_summary,
        generated_at=datetime.now(timezone.utc),
    )
