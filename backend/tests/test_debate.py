"""Tests for the Debate Chamber (Prompt 9).

Checks: the skeptic never sets recommendation/utility (schema-enforced,
re-asserted here), every non-skeptic utility is derived from the exact
named formula (recomputed independently in the test, not copy-pasted from
the implementation), the result is deterministic, and -- the one real
regression this module caught while being built -- the skeptic's caveat
names a real metric where the consensus pick does not actually win.
"""

import pytest

from app.schemas.debate import DebateResult
from app.services.counterfactual import compare_counterfactuals
from app.services.debate import (
    _flight_surgeon_utility,
    _mission_commander_utility,
    _science_officer_utility,
    run_debate_chamber,
)


@pytest.fixture(scope="module")
def result() -> DebateResult:
    return run_debate_chamber()


@pytest.fixture(scope="module")
def comparisons_by_alt():
    return {c.alternative: c for c in compare_counterfactuals()}


def test_includes_all_four_roles_with_skeptic_present(result):
    roles = {r.role for r in result.recommendations}
    assert roles == {"mission_commander", "flight_surgeon", "science_officer", "skeptic"}


def test_skeptic_never_sets_recommendation_or_utility(result):
    skeptic = next(r for r in result.recommendations if r.role == "skeptic")
    assert skeptic.recommendation is None
    assert skeptic.utility is None
    assert skeptic.confidence is None
    assert len(skeptic.limitations) >= 1


def test_non_skeptic_roles_always_set_recommendation_and_utility(result):
    for r in result.recommendations:
        if r.role == "skeptic":
            continue
        assert r.recommendation in result.alternatives
        assert r.utility is not None
        assert -1.0 <= r.utility <= 1.0
        assert r.confidence is not None
        assert 0.0 <= r.confidence <= 1.0
        assert len(r.limitations) >= 1


def test_mission_commander_utility_matches_its_named_formula(result, comparisons_by_alt):
    mc = next(r for r in result.recommendations if r.role == "mission_commander")
    chosen = comparisons_by_alt[mc.recommendation]
    expected = chosen.eva_completion_probability - chosen.peak_operational_risk
    assert mc.utility == pytest.approx(expected, abs=1e-9)
    assert mc.utility == pytest.approx(_mission_commander_utility(chosen), abs=1e-9)


def test_flight_surgeon_utility_matches_its_named_formula(result, comparisons_by_alt):
    fs = next(r for r in result.recommendations if r.role == "flight_surgeon")
    chosen = comparisons_by_alt[fs.recommendation]
    expected = -(0.5 * chosen.peak_cognitive_risk + 0.5 * chosen.peak_musculoskeletal_risk)
    assert fs.utility == pytest.approx(expected, abs=1e-9)
    assert fs.utility == pytest.approx(_flight_surgeon_utility(chosen), abs=1e-9)


def test_science_officer_utility_matches_its_named_formula(result, comparisons_by_alt):
    so = next(r for r in result.recommendations if r.role == "science_officer")
    chosen = comparisons_by_alt[so.recommendation]
    expected = chosen.eva_completion_probability - chosen.mean_uncertainty
    assert so.utility == pytest.approx(expected, abs=1e-9)
    assert so.utility == pytest.approx(_science_officer_utility(chosen), abs=1e-9)


def test_each_non_skeptic_recommendation_is_the_true_argmax_of_its_own_formula(result, comparisons_by_alt):
    """Recomputes the argmax independently over ALL alternatives for each
    formula, rather than trusting that the implementation picked correctly."""
    formulas = {
        "mission_commander": lambda c: c.eva_completion_probability - c.peak_operational_risk,
        "flight_surgeon": lambda c: -(0.5 * c.peak_cognitive_risk + 0.5 * c.peak_musculoskeletal_risk),
        "science_officer": lambda c: c.eva_completion_probability - c.mean_uncertainty,
    }
    for r in result.recommendations:
        if r.role == "skeptic":
            continue
        formula = formulas[r.role]
        true_best = max(comparisons_by_alt.values(), key=formula)
        assert r.recommendation == true_best.alternative


def test_skeptic_caveat_names_a_real_metric_divergence_on_the_real_ares180_numbers(result, comparisons_by_alt):
    """Pinned regression: on the real seed, every role recommends C, but C
    does not have the lowest peak_musculoskeletal_risk (B does). The
    skeptic must surface exactly this, not a generic disclaimer.
    """
    skeptic = next(r for r in result.recommendations if r.role == "skeptic")
    non_skeptic_recs = {r.role: r.recommendation for r in result.recommendations if r.role != "skeptic"}
    assert set(non_skeptic_recs.values()) == {"C"}  # pinned: all three agree on C today
    assert "peak_musculoskeletal_risk" in skeptic.justification
    assert "B" in skeptic.justification


def test_alternatives_list_matches_the_real_comparison_and_disagreement_summary_is_consistent(result):
    assert result.alternatives == ["A", "B", "C"]
    recs = {r.role: r.recommendation for r in result.recommendations if r.role != "skeptic"}
    if len(set(recs.values())) == 1:
        assert result.disagreement_summary is None
    else:
        assert result.disagreement_summary is not None
        for alt in recs.values():
            assert alt in result.disagreement_summary


def test_mission_and_day_match_the_ares180_eva_decision(result):
    assert result.mission_id == "ares-180"
    assert result.day == 145


def test_run_debate_chamber_is_deterministic():
    first = run_debate_chamber()
    second = run_debate_chamber()
    for r1, r2 in zip(first.recommendations, second.recommendations):
        assert r1.role == r2.role
        assert r1.recommendation == r2.recommendation
        assert r1.utility == r2.utility
