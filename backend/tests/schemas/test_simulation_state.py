import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_daily_state, make_risk_result


def test_valid_risk_result_band_matches_risk():
    result = make_risk_result()
    assert result.band == "high"  # operational_risk=0.68 -> [0.5, 0.75) -> high


def test_band_mismatch_rejected():
    with pytest.raises(ValidationError, match="does not match"):
        make_risk_result(band="low")


def test_scores_header_must_match_result_header():
    state = make_daily_state(crew_id="nova")
    with pytest.raises(ValidationError, match="must match"):
        make_risk_result(scores=state, crew_id="atlas", mission_id="ares-180", day=145)


def test_duplicate_driver_names_rejected():
    with pytest.raises(ValidationError, match="repeat"):
        make_risk_result(
            top_drivers=[
                {"name": "Radiation burden", "contribution": 0.3},
                {"name": "Radiation burden", "contribution": 0.1},
            ]
        )


def test_daily_state_scores_bounded_0_1():
    with pytest.raises(ValidationError):
        make_daily_state(operational_risk=1.1)
