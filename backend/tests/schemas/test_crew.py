import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_crew


def test_valid_crew_profile():
    crew = make_crew()
    assert crew.synthetic is True
    assert crew.id == "atlas"


def test_synthetic_cannot_be_false():
    with pytest.raises(ValidationError):
        make_crew(synthetic=False)


def test_limitations_must_be_non_empty():
    with pytest.raises(ValidationError):
        make_crew(limitations=[])


def test_limitations_must_disclose_synthetic():
    with pytest.raises(ValidationError, match="synthetic"):
        make_crew(limitations=["Some limitation with no relevant keyword"])


def test_display_name_rejects_email():
    with pytest.raises(ValidationError):
        make_crew(display_name="atlas@example.com")


def test_display_name_rejects_long_digit_run():
    with pytest.raises(ValidationError):
        make_crew(display_name="Crew Member 19850312")


def test_baseline_scores_bounded_0_1():
    bad_baseline = make_crew().baseline.model_dump()
    bad_baseline["radiation_sensitivity"] = 1.5
    with pytest.raises(ValidationError):
        make_crew(baseline=bad_baseline)


def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        make_crew(unexpected_field="nope")
