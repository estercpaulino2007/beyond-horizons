from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_rankings_returns_three_sorted_proposals():
    response = client.get("/api/v1/research-navigator/rankings")
    assert response.status_code == 200
    data = response.json()

    assert len(data["proposals"]) == 3
    priorities = [p["priority"] for p in data["proposals"]]
    assert priorities == sorted(priorities, reverse=True)


def test_rankings_response_has_formula_and_language_note():
    response = client.get("/api/v1/research-navigator/rankings")
    data = response.json()
    assert "mission_impact" in data["priority_formula"]
    assert "relative_cost" in data["priority_formula"]
    assert data["language_note"]


def test_every_proposal_has_required_fields_and_limitations():
    response = client.get("/api/v1/research-navigator/rankings")
    data = response.json()
    for proposal in data["proposals"]:
        assert {
            "id",
            "title",
            "gap_description",
            "mission_impact",
            "uncertainty",
            "expected_information_gain",
            "relative_cost",
            "limitations",
            "priority",
        } <= set(proposal)
        assert len(proposal["limitations"]) >= 1


def test_openapi_documents_the_research_navigator_endpoint():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/research-navigator/rankings" in schema["paths"]
