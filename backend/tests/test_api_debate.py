from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_debate_returns_all_four_roles():
    response = client.get("/api/v1/debate/ares-180")
    assert response.status_code == 200
    data = response.json()
    roles = {r["role"] for r in data["recommendations"]}
    assert roles == {"mission_commander", "flight_surgeon", "science_officer", "skeptic"}


def test_skeptic_has_no_recommendation_in_the_response():
    response = client.get("/api/v1/debate/ares-180")
    data = response.json()
    skeptic = next(r for r in data["recommendations"] if r["role"] == "skeptic")
    assert skeptic["recommendation"] is None
    assert skeptic["utility"] is None


def test_response_has_mission_day_and_disclaimer():
    response = client.get("/api/v1/debate/ares-180")
    data = response.json()
    assert data["mission_id"] == "ares-180"
    assert data["day"] == 145
    assert data["disclaimer"]
    assert data["alternatives"] == ["A", "B", "C"]


def test_openapi_documents_the_debate_endpoint():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/debate/ares-180" in schema["paths"]
