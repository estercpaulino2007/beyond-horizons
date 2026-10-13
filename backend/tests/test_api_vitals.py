from fastapi.testclient import TestClient

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)

NORMAL_ENTRY = {
    "heart_rate_bpm": 72,
    "spo2_percent": 98,
    "body_temp_c": 36.6,
    "respiratory_rate_bpm": 14,
    "sleep_hours": 8,
    "stress_level": 2,
    "activity_minutes": 45,
}


def test_vitals_evaluate_all_normal():
    response = client.post("/api/v1/vitals/evaluate", json=NORMAL_ENTRY)
    assert response.status_code == 200
    data = response.json()

    assert data["overall_status"] == "normal"
    assert len(data["metrics"]) == 7
    assert all(m["status"] == "normal" for m in data["metrics"])
    assert data["reference_source"] == "CLINICAL-VITALS-REFERENCE"
    assert len(data["limitations"]) > 0
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN


def test_vitals_evaluate_flags_low_spo2_as_alert():
    entry = {**NORMAL_ENTRY, "spo2_percent": 85}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    assert data["overall_status"] == "alert"
    spo2 = next(m for m in data["metrics"] if m["metric_id"] == "spo2")
    assert spo2["status"] == "alert"
    assert any("check in with a real clinician" in i for i in data["insights"])


def test_vitals_evaluate_flags_mild_fever_as_attention_not_alert():
    entry = {**NORMAL_ENTRY, "body_temp_c": 37.6}
    response = client.post("/api/v1/vitals/evaluate", json=entry)
    data = response.json()

    temp = next(m for m in data["metrics"] if m["metric_id"] == "body_temp")
    assert temp["status"] == "attention"
    assert data["overall_status"] == "attention"


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
