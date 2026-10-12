import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_causal_node, make_hypothesis_edge, make_verified_edge


def test_valid_verified_edge():
    edge = make_verified_edge()
    assert edge.evidence_level == "supported_evidence"


def test_valid_hypothesis_edge_not_checked_against_registry():
    edge = make_hypothesis_edge()
    assert edge.evidence_level == "exploratory_hypothesis"


def test_supported_evidence_with_unregistered_reference_is_rejected():
    with pytest.raises(ValidationError, match="verified source key"):
        make_verified_edge(evidence_reference="A paper I skimmed once but never registered")


def test_data_supported_association_also_checked():
    with pytest.raises(ValidationError, match="verified source key"):
        make_verified_edge(
            evidence_level="data_supported_association",
            evidence_reference="GLDS-473 (never confirmed to exist)",
        )


def test_self_loop_rejected():
    with pytest.raises(ValidationError, match="itself"):
        make_verified_edge(source="radiation_exposure", target="radiation_exposure")


def test_invalid_evidence_level_rejected():
    with pytest.raises(ValidationError):
        make_verified_edge(evidence_level="probably_true")


def test_edge_limitations_required():
    with pytest.raises(ValidationError):
        make_hypothesis_edge(limitations=[])


def test_causal_node_valid():
    node = make_causal_node()
    assert node.category == "exposure"
