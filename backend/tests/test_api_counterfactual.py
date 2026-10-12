from fastapi.testclient import TestClient
import pytest

from app.core.notices import SIMULATION_DISCLAIMER
from app.main import app

client = TestClient(app)


def test_compare_with_empty_body_defaults_to_ares180():
    response = client.post("/api/v1/counterfactual/compare", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["mission_id"] == "ares-180"
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert {a["alternative"] for a in data["alternatives"]} == {"A", "B", "C"}


def test_compare_unknown_mission_returns_404():
    response = client.post("/api/v1/counterfactual/compare", json={"mission_id": "iss"})
    assert response.status_code == 404
    assert "ares-180" in response.json()["detail"]


def test_compare_response_matches_the_engine_directly():
    from app.services.counterfactual import compare_counterfactuals

    expected = {c.alternative: c for c in compare_counterfactuals()}
    response = client.post("/api/v1/counterfactual/compare", json={})
    data = response.json()

    for alt_payload in data["alternatives"]:
        expected_alt = expected[alt_payload["alternative"]]
        assert alt_payload["eva_crew_id"] == expected_alt.eva_crew_id
        assert alt_payload["eva_day"] == expected_alt.eva_day
        assert alt_payload["peak_operational_risk"] == pytest.approx(expected_alt.peak_operational_risk)
        assert alt_payload["eva_completion_probability"] == pytest.approx(
            expected_alt.eva_completion_probability
        )


def test_openapi_documents_the_counterfactual_endpoint():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/counterfactual/compare" in schema["paths"]
