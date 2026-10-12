import pytest
from pydantic import ValidationError

from tests.schemas.factories import (
    make_debate_result,
    make_experiment_proposal,
    make_recommendation,
)


def test_priority_is_computed_from_inputs():
    proposal = make_experiment_proposal(
        mission_impact=0.8, uncertainty=0.5, expected_information_gain=0.4, relative_cost=2.0
    )
    assert proposal.priority == pytest.approx(0.8 * 0.5 * 0.4 / 2.0)


def test_priority_field_cannot_be_set_directly():
    with pytest.raises(ValidationError):
        make_experiment_proposal(priority=999.0)


def test_experiment_requires_limitations():
    with pytest.raises(ValidationError):
        make_experiment_proposal(limitations=[])


def test_skeptic_cannot_set_recommendation():
    with pytest.raises(ValidationError, match="skeptic"):
        make_recommendation("skeptic", recommendation="A", utility=0.1)


def test_non_skeptic_must_set_recommendation_and_utility():
    with pytest.raises(ValidationError):
        make_recommendation("flight_surgeon", recommendation=None, utility=None)


def test_valid_debate_result_includes_skeptic():
    result = make_debate_result()
    roles = {r.role for r in result.recommendations}
    assert "skeptic" in roles
    assert len(roles) == 4


def test_debate_result_requires_skeptic():
    with pytest.raises(ValidationError, match="skeptic"):
        make_debate_result(
            recommendations=[
                make_recommendation("mission_commander"),
                make_recommendation("flight_surgeon"),
            ]
        )


def test_debate_result_rejects_duplicate_roles():
    with pytest.raises(ValidationError, match="repeat"):
        make_debate_result(
            recommendations=[
                make_recommendation("mission_commander"),
                make_recommendation("mission_commander"),
                make_recommendation("skeptic"),
            ]
        )


def test_recommendation_must_reference_a_real_alternative():
    # Default recommendations pick "B"; excluding it from the alternative
    # set must be rejected.
    with pytest.raises(ValidationError, match="not in alternatives"):
        make_debate_result(alternatives=["A", "D"])
