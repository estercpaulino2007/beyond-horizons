from fastapi.testclient import TestClient

from app.core.notices import ASSISTANT_NOT_CONFIGURED_NOTICE, SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app
from app.services.assistant_context import build_assistant_context

client = TestClient(app)


def test_status_is_unconfigured_without_an_api_key(monkeypatch):
    monkeypatch.delenv("ASSISTANT_API_KEY", raising=False)
    from app.core.config import get_settings

    get_settings.cache_clear()
    response = client.get("/api/v1/assistant/status")
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is False
    assert data["notice"] == ASSISTANT_NOT_CONFIGURED_NOTICE
    get_settings.cache_clear()


def test_ask_returns_503_without_an_api_key(monkeypatch):
    monkeypatch.delenv("ASSISTANT_API_KEY", raising=False)
    from app.core.config import get_settings

    get_settings.cache_clear()
    response = client.post("/api/v1/assistant/ask", json={"message": "What is the crew's radiation risk?"})
    assert response.status_code == 503
    assert response.json()["detail"] == ASSISTANT_NOT_CONFIGURED_NOTICE
    get_settings.cache_clear()


def test_ask_rejects_an_empty_message():
    response = client.post("/api/v1/assistant/ask", json={"message": ""})
    assert response.status_code == 422


def test_ask_succeeds_when_configured_and_the_provider_responds(monkeypatch):
    import app.api.assistant as assistant_api

    async def fake_ask(message, history=None, vitals_summary=None):
        assert message == "What is the crew's radiation risk?"
        return "Based on the evidence graph, radiation exposure has a data-supported link to DNA damage response."

    monkeypatch.setattr(assistant_api, "is_configured", lambda: True)
    monkeypatch.setattr(assistant_api, "ask", fake_ask)

    response = client.post("/api/v1/assistant/ask", json={"message": "What is the crew's radiation risk?"})
    assert response.status_code == 200
    data = response.json()
    assert "radiation" in data["answer"].lower()
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN


def test_ask_returns_502_when_the_provider_errors(monkeypatch):
    import app.api.assistant as assistant_api
    from app.services.assistant import AssistantUpstreamError

    async def failing_ask(message, history=None, vitals_summary=None):
        raise AssistantUpstreamError("Assistant provider returned 500: boom")

    monkeypatch.setattr(assistant_api, "is_configured", lambda: True)
    monkeypatch.setattr(assistant_api, "ask", failing_ask)

    response = client.post("/api/v1/assistant/ask", json={"message": "hi"})
    assert response.status_code == 502
    assert "boom" in response.json()["detail"]


def test_openapi_documents_the_assistant_endpoints():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/assistant/status" in schema["paths"]
    assert "/api/v1/assistant/ask" in schema["paths"]


def test_assistant_context_is_grounded_in_real_mission_data():
    context = build_assistant_context()
    assert "Ares-180" in context
    assert "Atlas" in context and "Nova" in context and "Lyra" in context and "Orion" in context
    assert "evidence_level=" in context
    assert "synthetic" in context.lower()
