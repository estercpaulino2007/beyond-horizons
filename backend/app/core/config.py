"""Application settings, read from environment variables (see ../.env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    # Comma-separated list, e.g. "http://localhost:3000,http://127.0.0.1:3000".
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Not used yet: persistence arrives in a later step.
    database_url: str | None = None

    # In-app AI assistant (app/services/assistant.py). Bring-your-own-key: this
    # project has no budget to spend on the operator's behalf, so the chat
    # feature stays off (GET /api/v1/assistant/status reports configured=false,
    # and the frontend widget explains this) until an operator sets
    # ASSISTANT_API_KEY in their own environment. No key is bundled or
    # defaulted anywhere in this codebase.
    assistant_api_key: str | None = None
    assistant_model: str = "claude-3-5-haiku-latest"
    # Anthropic Messages API, overridable for a compatible self-hosted proxy.
    assistant_api_base_url: str = "https://api.anthropic.com"
    # Which wire format assistant_api_base_url speaks. "anthropic" (default)
    # is the Messages API (api.anthropic.com). "openai" is the OpenAI-style
    # chat-completions format that free-tier providers such as Groq
    # (https://api.groq.com/openai) also implement, so an operator with no
    # budget can run the assistant on a provider's free tier instead of a
    # paid Anthropic key -- see app/services/assistant.py.
    assistant_api_format: str = "anthropic"

    @property
    def assistant_configured(self) -> bool:
        return bool(self.assistant_api_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
