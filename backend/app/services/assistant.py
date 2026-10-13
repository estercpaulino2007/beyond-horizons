"""In-app assistant: a thin, grounded wrapper around an LLM provider's chat
API -- either the Anthropic Messages API or an OpenAI-compatible
chat-completions endpoint (ASSISTANT_API_FORMAT, app/core/config.py).

Bring-your-own-key by design: this project has no budget to spend on an
operator's behalf, so `ask()` raises AssistantNotConfiguredError whenever
ASSISTANT_API_KEY isn't set, rather than silently failing or fabricating an
answer. The OpenAI-compatible format exists specifically so an operator can
point this at a free-tier provider (e.g. Groq, https://api.groq.com/openai)
instead of a paid Anthropic key. When configured, every call is grounded in
app/services/assistant_context.py -- the model is instructed to answer only
from that context and to keep this project's synthetic/evidence-level
labelling honest (app/core/notices.py).
"""

from __future__ import annotations

import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.notices import ASSISTANT_SYSTEM_PROMPT
from app.services.assistant_context import build_assistant_context

MAX_HISTORY_TURNS = 8
MAX_MESSAGE_LENGTH = 2000
REQUEST_TIMEOUT_SECONDS = 30.0


class AssistantNotConfiguredError(RuntimeError):
    """Raised when no operator has set ASSISTANT_API_KEY."""


class AssistantUpstreamError(RuntimeError):
    """Raised when the configured LLM provider errors or times out."""


class AssistantTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


def is_configured() -> bool:
    return get_settings().assistant_configured


async def ask(
    message: str,
    history: list[AssistantTurn] | None = None,
    vitals_summary: str | None = None,
) -> str:
    """Answers one question, grounded in the app's current data.

    `vitals_summary` is an optional, already-formatted plain-text summary of
    the person's own latest My Vitals entry (see frontend/lib/vitalsStore.ts
    and components/AssistantWidget.tsx, which builds this string client-side
    from whatever is in that browser's localStorage -- nothing is persisted
    server-side). It is appended to the grounding context verbatim, under its
    own clearly-labelled section, so the assistant can answer questions about
    the person themselves without ever being told their vitals are anything
    but a self-reported snapshot from this one session.

    Raises AssistantNotConfiguredError if no API key is set, or
    AssistantUpstreamError if the provider call fails. Callers (app/api/
    assistant.py) turn both into honest HTTP responses rather than a generic
    500 or a guessed answer.
    """
    settings = get_settings()
    if not settings.assistant_configured:
        raise AssistantNotConfiguredError

    system_prompt = ASSISTANT_SYSTEM_PROMPT + build_assistant_context()
    if vitals_summary:
        # Truncated defensively -- this travels from the client, so it is
        # untrusted length-wise even though it's just numbers/labels this
        # app itself produced (see AssistantWidget.tsx).
        system_prompt += "\n\n## Person's own vitals (self-reported this session, not clinical data)\n" + vitals_summary[:2000]

    turns = (history or [])[-MAX_HISTORY_TURNS:]
    messages = [{"role": t.role, "content": t.content} for t in turns]
    messages.append({"role": "user", "content": message[:MAX_MESSAGE_LENGTH]})

    is_openai_format = settings.assistant_api_format.strip().lower() == "openai"

    if is_openai_format:
        url = f"{settings.assistant_api_base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.assistant_api_key or ''}",
            "content-type": "application/json",
        }
        payload = {
            "model": settings.assistant_model,
            "max_tokens": 800,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
        }
    else:
        url = f"{settings.assistant_api_base_url}/v1/messages"
        headers = {
            "x-api-key": settings.assistant_api_key or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": settings.assistant_model,
            "max_tokens": 800,
            "system": system_prompt,
            "messages": messages,
        }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise AssistantUpstreamError("The assistant took too long to respond.") from exc
    except httpx.HTTPError as exc:
        raise AssistantUpstreamError(f"Could not reach the assistant provider: {exc}") from exc

    if response.status_code != 200:
        detail = response.text[:300]
        raise AssistantUpstreamError(f"Assistant provider returned {response.status_code}: {detail}")

    data = response.json()
    try:
        if is_openai_format:
            text = data["choices"][0]["message"]["content"] or ""
        else:
            blocks = data["content"]
            text = "".join(block["text"] for block in blocks if block.get("type") == "text")
    except (KeyError, IndexError, TypeError) as exc:
        raise AssistantUpstreamError("Assistant provider returned an unexpected response shape.") from exc

    if not text.strip():
        raise AssistantUpstreamError("Assistant provider returned an empty response.")

    return text.strip()
