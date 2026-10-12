import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_event, make_eva_decision_event, make_exposure


def test_valid_exposure():
    exposure = make_exposure()
    assert exposure.synthetic is True


def test_exposure_radiation_dose_bounded():
    with pytest.raises(ValidationError):
        make_exposure(radiation_dose=1.2)


def test_exposure_sleep_hours_bounded():
    with pytest.raises(ValidationError):
        make_exposure(sleep_hours=30.0)


def test_event_day_range_must_be_ordered():
    with pytest.raises(ValidationError, match="day_end"):
        make_event(day_start=150, day_end=140)


def test_event_valid_single_day():
    event = make_event()
    assert event.day_start == event.day_end == 143


def test_eva_decision_point_has_three_alternatives():
    event = make_eva_decision_event()
    assert event.decision_point is not None
    assert {alt.id for alt in event.decision_point.alternatives} == {"A", "B", "C"}


def test_decision_point_requires_at_least_two_alternatives():
    with pytest.raises(ValidationError):
        make_eva_decision_event(
            decision_point={
                "alternatives": [
                    {"id": "A", "name": "Only one", "description": "Not a real choice"}
                ]
            }
        )


def test_decision_point_rejects_duplicate_alternative_ids():
    from app.schemas.events import DecisionAlternative, DecisionPoint

    with pytest.raises(ValidationError):
        DecisionPoint(
            alternatives=[
                DecisionAlternative(id="A", name="Maintain", description="x"),
                DecisionAlternative(id="A", name="Duplicate id", description="y"),
            ]
        )
