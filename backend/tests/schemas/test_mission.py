import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_mission


def test_valid_mission():
    mission = make_mission()
    assert mission.duration_days == 180
    assert mission.synthetic is True


def test_duration_out_of_range_rejected():
    with pytest.raises(ValidationError):
        make_mission(duration_days=0)
    with pytest.raises(ValidationError):
        make_mission(duration_days=1096)


def test_microgravity_destination_requires_zero_gravity():
    with pytest.raises(ValidationError, match="microgravity"):
        make_mission(destination="mars_transit", gravity_g=0.38)


def test_surface_destination_allows_nonzero_gravity():
    mission = make_mission(destination="mars_surface", gravity_g=0.38)
    assert mission.gravity_g == 0.38


def test_unknown_destination_rejected():
    with pytest.raises(ValidationError):
        make_mission(destination="asteroid")
