"""Tests for the counterfactual engine (Prompt 5).

Asserts what the engine actually, verifiably computes -- including a
genuine finding documented in app/services/counterfactual.py's module
docstring: alternative B (delay 10 days) does not reduce peak operational
risk relative to A in this seed, because the delay lands the EVA right
after the exercise-failure window ends, when muscle_recovery is at its
lowest. The *true* consistency property this module guarantees is that
each alternative's risk and its EVA completion probability always move
together (never higher risk with higher completion probability) --
that is what is tested here, deterministically.
"""

import pytest

from app.services.counterfactual import (
    ALTERNATIVE_DESCRIPTIONS,
    COMPARISON_WINDOW_END,
    COMPARISON_WINDOW_START,
    DELAYED_EVA_DAY,
    REASSIGNED_CREW_ID,
    compare_counterfactuals,
)


@pytest.fixture(scope="module")
def comparisons():
    return {c.alternative: c for c in compare_counterfactuals()}


def test_all_three_alternatives_are_present(comparisons):
    assert set(comparisons) == {"A", "B", "C"}
    for alt, result in comparisons.items():
        assert result.alternative == alt
        assert result.description == ALTERNATIVE_DESCRIPTIONS[alt]


def test_alternative_a_maintains_original_assignment_and_day(comparisons):
    a = comparisons["A"]
    assert a.eva_crew_id == "atlas"
    assert a.eva_day == 145


def test_alternative_b_delays_by_ten_days_same_crew_member(comparisons):
    b = comparisons["B"]
    assert b.eva_crew_id == "atlas"
    assert b.eva_day == DELAYED_EVA_DAY == 155


def test_alternative_c_reassigns_and_keeps_the_original_day(comparisons):
    c = comparisons["C"]
    assert c.eva_crew_id == REASSIGNED_CREW_ID == "nova"
    assert c.eva_day == 145


def test_every_metric_is_bounded_0_1(comparisons):
    for result in comparisons.values():
        assert 0.0 <= result.peak_operational_risk <= 1.0
        assert 0.0 <= result.peak_cognitive_risk <= 1.0
        assert 0.0 <= result.peak_musculoskeletal_risk <= 1.0
        assert 0.0 <= result.mean_uncertainty <= 1.0
        assert 0.05 <= result.eva_completion_probability <= 0.99


def test_every_alternative_explains_its_top_drivers(comparisons):
    for result in comparisons.values():
        assert 0 < len(result.top_drivers) <= 3


def test_risk_and_completion_probability_are_never_contradictory(comparisons):
    """The one consistency property this engine actually guarantees: within
    each alternative, and across alternatives, higher peak operational risk
    never comes with a higher EVA completion probability than a
    lower-risk alternative. (Both are derived from the same day's
    operational_risk/cognitive_resilience, so this holds by construction,
    but we assert it explicitly as a regression guard.)
    """
    ordered = sorted(comparisons.values(), key=lambda c: c.peak_operational_risk)
    for lower_risk, higher_risk in zip(ordered, ordered[1:]):
        assert lower_risk.eva_completion_probability >= higher_risk.eva_completion_probability


def test_reassign_and_recovery_is_the_most_protective_alternative(comparisons):
    """On the real Ares-180 numbers, C outperforms both A and B on peak
    operational risk and EVA completion probability -- the metrics this
    decision actually turns on. It does NOT win on every metric: B has a
    marginally lower peak_musculoskeletal_risk (see the module docstring
    and docs/methodology.md reconciliation issue #12 for why), which this
    test deliberately does not assert.
    """
    a, b, c = comparisons["A"], comparisons["B"], comparisons["C"]
    assert c.peak_operational_risk < a.peak_operational_risk
    assert c.peak_operational_risk < b.peak_operational_risk
    assert c.eva_completion_probability > a.eva_completion_probability
    assert c.eva_completion_probability > b.eva_completion_probability


def test_reassign_and_recovery_is_not_better_on_every_metric(comparisons):
    """Regression guard for the overstatement this project caught while
    building the Debate Chamber (Step 8/9): C does not have the lowest
    peak_musculoskeletal_risk -- B does, because C's reassigned crew member
    (Nova) trades a cognitive vulnerability for a musculoskeletal one. Pin
    this explicitly so a future change can't silently re-introduce the
    'C wins on every metric' claim without a test noticing.
    """
    a, b, c = comparisons["A"], comparisons["B"], comparisons["C"]
    assert b.peak_musculoskeletal_risk < c.peak_musculoskeletal_risk
    assert b.peak_musculoskeletal_risk < a.peak_musculoskeletal_risk


def test_alternative_b_does_not_trivially_match_alternative_a():
    """Regression guard for the finding itself: B must differ from A (the
    model is actually sensitive to the 10-day shift), even though it does
    not come out ahead of A on peak risk.
    """
    comparisons_dict = {c.alternative: c for c in compare_counterfactuals()}
    a, b = comparisons_dict["A"], comparisons_dict["B"]
    assert a.peak_operational_risk != b.peak_operational_risk
    assert b.peak_operational_risk > a.peak_operational_risk  # the documented finding, pinned as a regression guard


def test_comparison_window_is_shared_and_covers_the_original_eva_day():
    assert COMPARISON_WINDOW_START <= 145 <= COMPARISON_WINDOW_END
    assert COMPARISON_WINDOW_START <= DELAYED_EVA_DAY <= COMPARISON_WINDOW_END


def test_compare_counterfactuals_is_deterministic():
    first = compare_counterfactuals()
    second = compare_counterfactuals()
    assert [c.__dict__ for c in first] == [c.__dict__ for c in second]
