from fastapi.testclient import TestClient

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)


def test_run_simulation_with_empty_body_defaults_to_ares180():
    response = client.post("/api/v1/simulations/run", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["mission_id"] == "ares-180"
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN
    assert {t["crew_id"] for t in data["trajectories"]} == {"atlas", "nova", "lyra", "orion"}


def test_run_simulation_returns_180_days_per_crew_member():
    response = client.post("/api/v1/simulations/run", json={})
    data = response.json()
    for trajectory in data["trajectories"]:
        assert len(trajectory["risk_results"]) == 180
        assert [r["day"] for r in trajectory["risk_results"]] == list(range(1, 181))


def test_run_simulation_detects_the_eva_vulnerability_window_for_atlas():
    response = client.post("/api/v1/simulations/run", json={})
    data = response.json()
    atlas = next(t for t in data["trajectories"] if t["crew_id"] == "atlas")
    day_145_windows = [
        w for w in atlas["vulnerability_windows"] if w["day_start"] <= 145 <= w["day_end"]
    ]
    assert len(day_145_windows) == 1
    assert day_145_windows[0]["severity"] in ("high", "critical")
    assert day_145_windows[0]["primary_drivers"]  # non-empty, explained


def test_run_simulation_unknown_mission_returns_404():
    response = client.post("/api/v1/simulations/run", json={"mission_id": "apollo-11"})
    assert response.status_code == 404
    assert "ares-180" in response.json()["detail"]


def test_run_simulation_accepts_a_countermeasure_and_changes_the_result():
    baseline = client.post("/api/v1/simulations/run", json={}).json()
    shielded = client.post(
        "/api/v1/simulations/run",
        json={
            "countermeasures": [
                {
                    "id": "cm_shielding",
                    "name": "Additional radiation shielding",
                    "target_risk": "radiation",
                    "description": "Extra mass added around crew quarters to reduce radiation exposure.",
                    "limitations": ["Reduces but does not eliminate dose (NASA HRP Rad)."],
                }
            ]
        },
    ).json()

    def final_radiation_burden(payload, crew_id):
        trajectory = next(t for t in payload["trajectories"] if t["crew_id"] == crew_id)
        return trajectory["risk_results"][-1]["scores"]["radiation_burden"]

    for crew_id in ("atlas", "nova", "lyra", "orion"):
        assert final_radiation_burden(shielded, crew_id) < final_radiation_burden(baseline, crew_id)


def test_run_simulation_rejects_malformed_countermeasure():
    response = client.post(
        "/api/v1/simulations/run",
        json={"countermeasures": [{"id": "x", "name": "y", "target_risk": "not_a_real_category"}]},
    )
    assert response.status_code == 422


def test_openapi_documents_the_new_endpoints():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/missions/{mission_id}" in schema["paths"]
    assert "/api/v1/simulations/run" in schema["paths"]
