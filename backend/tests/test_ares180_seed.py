"""Tests for the Ares-180 seed (Prompt 2).

Covers the requirements: 180 days, the four named crew members, the
radiation storm on day 143, the exercise-module failure on days 143-154,
the 22-minute comm delay, the day-145 critical EVA, and -- the seed's own
promise -- full determinism.
"""

import json

from app.domain.ares180_seed import (
    EVA_DAY,
    EVA_ORIGINAL_CREW_ID,
    EXERCISE_FAILURE_END_DAY,
    EXERCISE_FAILURE_START_DAY,
    MISSION_ID,
    RADIATION_STORM_DAY,
    TOTAL_DAYS,
    build_ares180_dataset,
    build_crew_profiles,
    build_daily_exposures,
    build_mission_config,
    build_mission_events,
)
from app.domain.ares180_seed_io import to_file_payloads, write_dataset


def test_mission_is_180_days():
    mission = build_mission_config()
    assert mission.duration_days == TOTAL_DAYS == 180
    assert mission.communication_delay_minutes == 22.0
    assert mission.mission_id == MISSION_ID


def test_four_named_crew_members():
    crew = build_crew_profiles()
    assert [c.display_name for c in crew] == ["Atlas", "Nova", "Lyra", "Orion"]
    assert all(c.synthetic is True for c in crew)


def test_events_match_the_scripted_scenario():
    events = {e.id: e for e in build_mission_events()}
    assert events["evt_radiation_storm"].day_start == events["evt_radiation_storm"].day_end == RADIATION_STORM_DAY
    assert events["evt_exercise_failure"].day_start == EXERCISE_FAILURE_START_DAY
    assert events["evt_exercise_failure"].day_end == EXERCISE_FAILURE_END_DAY
    assert events["evt_comm_delay"].day_start == 1
    assert events["evt_comm_delay"].day_end == TOTAL_DAYS
    eva = events["evt_eva_critical"]
    assert eva.day_start == eva.day_end == EVA_DAY == 145
    assert eva.decision_point is not None
    assert {a.id for a in eva.decision_point.alternatives} == {"A", "B", "C"}


def test_daily_exposures_cover_every_day_and_crew_member():
    crew = build_crew_profiles()
    exposures = build_daily_exposures(crew)
    assert len(exposures) == TOTAL_DAYS * len(crew)
    days_seen = {e.day for e in exposures}
    assert days_seen == set(range(1, TOTAL_DAYS + 1))


def test_radiation_storm_elevates_dose_on_day_143_only():
    crew = build_crew_profiles()
    exposures = build_daily_exposures(crew)
    by_day = {}
    for e in exposures:
        by_day.setdefault(e.day, []).append(e.radiation_dose)

    baseline_day = sum(by_day[1]) / len(by_day[1])
    storm_day = sum(by_day[RADIATION_STORM_DAY]) / len(by_day[RADIATION_STORM_DAY])
    day_after = sum(by_day[RADIATION_STORM_DAY + 1]) / len(by_day[RADIATION_STORM_DAY + 1])

    assert storm_day > baseline_day * 3.0  # roughly the 3.5x multiplier
    assert day_after < storm_day / 2.0  # back to baseline the next day


def test_exercise_unavailable_for_every_crew_member_during_the_failure_window():
    crew = build_crew_profiles()
    exposures = build_daily_exposures(crew)
    for e in exposures:
        if EXERCISE_FAILURE_START_DAY <= e.day <= EXERCISE_FAILURE_END_DAY:
            assert e.exercise_duration_min == 0.0
        else:
            assert e.exercise_duration_min > 0.0


def test_only_the_assigned_crew_member_has_eva_load_on_eva_day():
    crew = build_crew_profiles()
    exposures = build_daily_exposures(crew)
    eva_day_rows = [e for e in exposures if e.day == EVA_DAY]
    assert len(eva_day_rows) == len(crew)
    with_load = [e for e in eva_day_rows if e.eva_load > 0]
    assert len(with_load) == 1
    assert with_load[0].crew_id == EVA_ORIGINAL_CREW_ID


def test_build_daily_exposures_is_deterministic():
    crew = build_crew_profiles()
    first = build_daily_exposures(crew)
    second = build_daily_exposures(crew)
    assert [e.model_dump() for e in first] == [e.model_dump() for e in second]


def test_full_dataset_is_deterministic():
    first = build_ares180_dataset()
    second = build_ares180_dataset()
    assert [e.model_dump() for e in first.daily_exposures] == [
        e.model_dump() for e in second.daily_exposures
    ]
    assert first.mission.model_dump() == second.mission.model_dump()


def test_every_exposure_field_is_within_schema_bounds():
    # Constructing DailyExposure already enforces this, but assert
    # explicitly so a future refactor that bypasses the schema is still caught.
    crew = build_crew_profiles()
    for e in build_daily_exposures(crew):
        assert 0.0 <= e.radiation_dose <= 1.0
        assert 0.0 <= e.sleep_hours <= 24.0
        assert 0.0 <= e.exercise_duration_min <= 1440.0
        assert 0.0 <= e.eva_load <= 1.0
        assert 0.0 <= e.operational_workload <= 1.0
        assert e.co2_level_ppm >= 0.0


def test_write_dataset_produces_the_four_files(tmp_path):
    dataset = build_ares180_dataset()
    written = write_dataset(dataset, tmp_path)
    names = {p.name for p in written}
    assert names == {
        "mission_ares180.json",
        "crew_profiles.json",
        "mission_events.json",
        "daily_exposures.json",
    }
    for path in written:
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload  # non-empty, valid JSON


def test_file_payloads_carry_the_synthetic_data_notice():
    dataset = build_ares180_dataset()
    payloads = to_file_payloads(dataset)
    assert "synthetic" in json.dumps(payloads["mission_ares180.json"]).casefold()
    for name in ("crew_profiles.json", "mission_events.json", "daily_exposures.json"):
        assert "synthetic_data_notice" in payloads[name]


def test_daily_exposures_file_has_720_rows():
    dataset = build_ares180_dataset()
    payloads = to_file_payloads(dataset)
    assert len(payloads["daily_exposures.json"]["daily_exposures"]) == 180 * 4
