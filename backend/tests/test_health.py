from fastapi.testclient import TestClient

from app.core.notices import PLATFORM_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "beyond-horizons-api"


def test_cors_allows_local_frontend():
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_blocks_unknown_origin():
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers


def test_openapi_carries_mandatory_notices():
    description = client.get("/openapi.json").json()["info"]["description"]
    assert PLATFORM_DISCLAIMER in description
    assert SYNTHETIC_DATA_NOTICE_EN in description


def test_unknown_route_returns_json_404():
    response = client.get("/nope")
    assert response.status_code == 404
    assert "detail" in response.json()
