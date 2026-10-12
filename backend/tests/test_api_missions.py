from fastapi.testclient import TestClient

from app.core.notices import SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)


def test_get_ares180_mission_returns_full_scenario():
    response = client.get("/api/v1/missions/ares-180")
    assert response.status_code == 200
    data = response.json()

    assert data["mission"]["mission_id"] == "ares-180"
    assert data["mission"]["duration_days"] == 180
    assert {c["display_name"] for c in data["crew_profiles"]} == {"Atlas", "Nova", "Lyra", "Orion"}
    assert {e["id"] for e in data["events"]} == {
        "evt_radiation_storm",
        "evt_exercise_failure",
        "evt_comm_delay",
        "evt_eva_critical",
    }
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN


def test_get_unknown_mission_returns_404_with_helpful_detail():
    response = client.get("/api/v1/missions/apollo-11")
    assert response.status_code == 404
    assert "ares-180" in response.json()["detail"]


def test_mission_response_matches_seed_exactly():
    from app.domain.ares180_seed import build_ares180_dataset

    dataset = build_ares180_dataset()
    response = client.get("/api/v1/missions/ares-180")
    data = response.json()

    assert data["mission"] == dataset.mission.model_dump(mode="json")
    assert data["crew_profiles"] == [c.model_dump(mode="json") for c in dataset.crew_profiles]
