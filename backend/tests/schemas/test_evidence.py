import pytest
from pydantic import ValidationError

from tests.schemas.factories import make_synthetic_evidence, make_verified_evidence


def test_valid_verified_evidence():
    record = make_verified_evidence()
    assert record.dataset_id == "OSD-720"


def test_nasa_dataset_requires_source_url():
    with pytest.raises(ValidationError, match="source_url"):
        make_verified_evidence(source_url=None)


def test_nasa_dataset_with_unverified_id_is_rejected():
    with pytest.raises(ValidationError, match="verified-source registry"):
        make_verified_evidence(dataset_id="GLDS-473")


def test_synthetic_parameter_requires_condition_synthetic():
    with pytest.raises(ValidationError):
        make_synthetic_evidence(condition="spaceflight")


def test_synthetic_evidence_is_not_checked_against_registry():
    # Should not raise, even though there is no dataset_id at all.
    record = make_synthetic_evidence()
    assert record.source_type == "synthetic_parameter"


def test_limitations_required():
    with pytest.raises(ValidationError):
        make_verified_evidence(limitations=[])
