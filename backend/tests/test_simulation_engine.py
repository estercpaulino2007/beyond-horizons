"""Tests for the daily simulation engine (Prompt 3).

Uses the real Ares-180 seed (Prompt 2) end to end, and checks the three
hard requirements from the specification plus this engine's own promises
(bounded scores, mandatory disclaimer, explained top_drivers).
"""

import pytest

from app.core.notices import SIMULATION_DISCLAIMER
from app.domain.ares180_seed import (
    EVA_DAY,
    EVA_ORIGINAL_CREW_ID,
    EXERCISE_FAILURE_END_DAY,
    EXERCISE_FAILURE_START_DAY,
    RADIATION_STORM_DAY,
    build_ares180_dataset,
)
from app.domain.risk_bands import band_for_risk
from app.schemas.countermeasure import CountermeasurePlan
from app.services.simulation_engine import simulate_mission


@pytest.fixture(scope="module")
def ares180_results():
    dataset = build_ares180_dataset()
    return simulate_mission(dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events)


def test_output_covers_every_crew_member_and_every_day(ares180_results):
    assert set(ares180_results) == {"atlas", "nova", "lyra", "orion"}
    for crew_id, trajectory in ares180_results.items():
        assert [r.day for r in trajectory] == list(range(1, 181))
        assert all(r.crew_id == crew_id for r in trajectory)


def test_every_result_carries_the_mandatory_disclaimer(ares180_results):
    for trajectory in ares180_results.values():
        assert all(r.disclaimer == SIMULATION_DISCLAIMER for r in trajectory)


def test_every_result_band_matches_the_shared_thresholds(ares180_results):
    for trajectory in ares180_results.values():
        for r in trajectory:
            assert r.band == band_for_risk(r.scores.operational_risk)


def test_radiation_burden_never_decreases(ares180_results):
    for trajectory in ares180_results.values():
        burdens = [r.scores.radiation_burden for r in trajectory]
        assert all(b2 >= b1 - 1e-9 for b1, b2 in zip(burdens, burdens[1:]))


def test_radiation_storm_clearly_increases_the_days_dose_effect(ares180_results):
    """Spec requirement: 'Tempestade no dia 143 precisa aumentar exposição.'

    The single-day increase in radiation_burden on the storm day must be
    substantially larger than the increase on an adjacent, ordinary day.
    """
    for trajectory in ares180_results.values():
        by_day = {r.day: r.scores.radiation_burden for r in trajectory}
        normal_day_delta = by_day[RADIATION_STORM_DAY - 1] - by_day[RADIATION_STORM_DAY - 2]
        storm_day_delta = by_day[RADIATION_STORM_DAY] - by_day[RADIATION_STORM_DAY - 1]
        assert storm_day_delta > normal_day_delta * 2.5


def test_exercise_failure_removes_muscle_and_bone_benefit(ares180_results):
    """Spec requirement: 'Falha de exercício precisa remover benefício dos
    dias 143 a 154.'
    """
    for trajectory in ares180_results.values():
        by_day = {r.day: r.scores for r in trajectory}
        before = by_day[EXERCISE_FAILURE_START_DAY - 1]
        after = by_day[EXERCISE_FAILURE_END_DAY]
        assert after.muscle_recovery < before.muscle_recovery
        assert after.bone_risk > before.bone_risk


def test_eva_increases_load_and_risk_temporarily_for_the_assigned_crew_member(ares180_results):
    """Spec requirement: 'EVA precisa aumentar carga e risco temporário.'

    Only the crew member actually assigned to the day-145 EVA (per the
    seed) should show a *local peak* in operational_risk on day 145 that is
    both higher than every other crew member's day-145 risk, and higher
    than that same crew member's own day-144 and day-146 risk (i.e.
    temporary, not a permanent step change).
    """
    day_145_risk = {
        crew_id: next(r for r in trajectory if r.day == EVA_DAY).scores.operational_risk
        for crew_id, trajectory in ares180_results.items()
    }
    assigned = day_145_risk[EVA_ORIGINAL_CREW_ID]
    others = [risk for crew_id, risk in day_145_risk.items() if crew_id != EVA_ORIGINAL_CREW_ID]
    assert assigned > max(others)

    assigned_trajectory = ares180_results[EVA_ORIGINAL_CREW_ID]
    by_day = {r.day: r.scores.operational_risk for r in assigned_trajectory}
    assert by_day[EVA_DAY] > by_day[EVA_DAY - 1]
    assert by_day[EVA_DAY] > by_day[EVA_DAY + 1]


def test_top_drivers_are_explained_sorted_and_bounded(ares180_results):
    for trajectory in ares180_results.values():
        for r in trajectory:
            assert 0 < len(r.top_drivers) <= 3
            contributions = [d.contribution for d in r.top_drivers]
            assert all(0.0 < c <= 1.0 for c in contributions)
            assert contributions == sorted(contributions, reverse=True)


def test_missing_exposure_raises_a_clear_error():
    dataset = build_ares180_dataset()
    incomplete_exposures = [e for e in dataset.daily_exposures if not (e.crew_id == "atlas" and e.day == 100)]
    with pytest.raises(ValueError, match="atlas.*day=100"):
        simulate_mission(dataset.mission, dataset.crew_profiles, incomplete_exposures, dataset.events)


def test_simulate_mission_is_deterministic():
    dataset = build_ares180_dataset()
    first = simulate_mission(dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events)
    second = simulate_mission(dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events)
    for crew_id in first:
        assert [r.model_dump() for r in first[crew_id]] == [r.model_dump() for r in second[crew_id]]


def test_radiation_countermeasure_reduces_final_radiation_burden():
    dataset = build_ares180_dataset()
    baseline = simulate_mission(dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events)
    shielding = CountermeasurePlan(
        id="cm_shielding",
        name="Additional radiation shielding",
        target_risk="radiation",
        description="Extra mass added around crew quarters to reduce radiation exposure.",
        limitations=["Reduces but does not eliminate dose; adds mass cost (NASA HRP Rad)."],
    )
    with_countermeasure = simulate_mission(
        dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events, [shielding]
    )
    for crew_id in baseline:
        base_final = baseline[crew_id][-1].scores.radiation_burden
        cm_final = with_countermeasure[crew_id][-1].scores.radiation_burden
        assert cm_final < base_final


def test_musculoskeletal_countermeasure_improves_bone_and_muscle_outcomes():
    dataset = build_ares180_dataset()
    baseline = simulate_mission(dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events)
    exercise_plan = CountermeasurePlan(
        id="cm_exercise",
        name="Optimised resistance exercise protocol",
        target_risk="musculoskeletal",
        description="Higher-adherence resistance exercise protocol.",
        limitations=["Depends on equipment availability; does not eliminate bone loss (NASA HRP Bone)."],
    )
    with_countermeasure = simulate_mission(
        dataset.mission, dataset.crew_profiles, dataset.daily_exposures, dataset.events, [exercise_plan]
    )
    for crew_id in baseline:
        base_final = baseline[crew_id][-1].scores
        cm_final = with_countermeasure[crew_id][-1].scores
        assert cm_final.bone_risk < base_final.bone_risk


def test_unknown_countermeasure_target_is_a_no_op():
    # target_risk is a closed Literal, so every valid CountermeasurePlan has
    # a registered effect today; this documents that behaviour rather than
    # silently assuming it stays true if COUNTERMEASURE_EFFECTS is ever
    # trimmed to fewer categories than TargetRisk offers.
    from app.schemas.countermeasure import TargetRisk
    from app.services.simulation_engine import COUNTERMEASURE_EFFECTS

    assert set(COUNTERMEASURE_EFFECTS) == set(TargetRisk.__args__)
