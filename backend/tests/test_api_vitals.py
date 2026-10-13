from fastapi.testclient import TestClient

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)

NORMAL_ENTRY = {
    "heart_rate_bpm": 72,
    "heart_rhythm": "regular",
    "spo2_percent": 98,
    "body_temp_c": 36.6,
    "respiratory_rate_bpm": 14,
    "sleep_hours": 8,
    "sleep_quality": 4,
    "stress_level": 2,
    "activity_minutes": 45,
    "hydration_level": 8,
}


def test_vitals_evaluate_all_normal():
    response = client.post("/api/v1/vitals/evaluate", json=NORMAL_ENTRY)
    assert response.status_code == 200
    data = response.json()

    assert data["overall_status"] == "normal"
    assert len(data["metrics"]) == 10
    assert all(m["status"] == "normal" for m in data["metrics"])
    assert all(m["recommendations"] == [] for m in data["metrics"])
    assert data["reference_source"] == "CLINICAL-VITALS-REFERENCE"
    assert len(data["limitations"]) > 0
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN


def test_vitals_evaluate_every_metric_has_a_category():
    response = client.post("/api/v1/vitals/evaluate", json=NORMAL_ENTRY)
    data = response.json()
    categories = {m["category"] for m in data["metrics"]}
    assert categories <= {"cardiac", "respiratory", "temperature", "sleep_fatigue", "activity_muscle", "hydration_other"}
    assert {"cardiac", "respiratory", "temperature", "sleep_fatigue", "activity_muscle", "hydration_other"} <= categories


def test_vitals_evaluate_optional_body_mass_is_tracked_not_judged():
    entry = {**NORMAL_ENTRY, "body_mass_kg": 81.5}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()
    mass = next(m for m in data["metrics"] if m["metric_id"] == "body_mass")
    assert mass["status"] == "normal"
    assert mass["value"] == 81.5
    assert "no single 'normal' body mass" in mass["note"]


def test_vitals_evaluate_body_mass_omitted_by_default():
    response = client.post("/api/v1/vitals/evaluate", json=NORMAL_ENTRY)
    data = response.json()
    assert not any(m["metric_id"] == "body_mass" for m in data["metrics"])


def test_vitals_evaluate_irregular_rhythm_is_attention_with_recommendations():
    entry = {**NORMAL_ENTRY, "heart_rhythm": "irregular"}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()
    rhythm = next(m for m in data["metrics"] if m["metric_id"] == "heart_rhythm")
    assert rhythm["status"] == "attention"
    assert rhythm["category"] == "cardiac"
    assert len(rhythm["recommendations"]) > 0
    assert "no ECG sensor" in rhythm["note"]


def test_vitals_evaluate_flags_low_spo2_as_alert_with_recommendations():
    entry = {**NORMAL_ENTRY, "spo2_percent": 85}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    assert data["overall_status"] == "alert"
    spo2 = next(m for m in data["metrics"] if m["metric_id"] == "spo2")
    assert spo2["status"] == "alert"
    assert any("evaluation" in r for r in spo2["recommendations"])
    assert any("check in with a real clinician" in i for i in data["insights"])


def test_vitals_evaluate_flags_mild_fever_as_attention_not_alert():
    entry = {**NORMAL_ENTRY, "body_temp_c": 37.6}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    temp = next(m for m in data["metrics"] if m["metric_id"] == "body_temp")
    assert temp["status"] == "attention"
    assert data["overall_status"] == "attention"


def test_vitals_evaluate_low_hydration_is_never_alert_and_has_a_disclaimer_recommendation():
    entry = {**NORMAL_ENTRY, "hydration_level": 2}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    hydration = next(m for m in data["metrics"] if m["metric_id"] == "hydration")
    assert hydration["status"] == "attention"
    assert any("cannot measure hydration precisely" in r for r in hydration["recommendations"])


def test_vitals_evaluate_low_sleep_is_never_alert():
    entry = {**NORMAL_ENTRY, "sleep_hours": 2}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    sleep = next(m for m in data["metrics"] if m["metric_id"] == "sleep")
    assert sleep["status"] == "attention"
    assert data["overall_status"] != "alert" or any(
        m["status"] == "alert" for m in data["metrics"] if m["metric_id"] != "sleep"
    )


def test_vitals_evaluate_rejects_out_of_bound_values():
    entry = {**NORMAL_ENTRY, "spo2_percent": 150}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    assert response.status_code == 422


def test_vitals_evaluate_rejects_unknown_fields():
    entry = {**NORMAL_ENTRY, "unexpected_field": 1}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    assert response.status_code == 422


def test_openapi_documents_the_vitals_endpoint():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/vitals/evaluate" in schema["paths"]


def test_clinical_vitals_reference_is_a_registered_source():
    from app.core.evidence_registry import is_verified_reference

    assert is_verified_reference("CLINICAL-VITALS-REFERENCE")
