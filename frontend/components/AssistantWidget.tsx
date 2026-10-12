"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, askAssistant, getAssistantStatus } from "@/lib/api";
import type { AssistantTurn } from "@/types/api";

type Status = "checking" | "configured" | "unconfigured" | "unreachable";

/**
 * Floating "ask the app" assistant. Answers are grounded only in this
 * project's own mission/crew/evidence-graph data (see
 * backend/app/services/assistant_context.py) and carry the same
 * synthetic-data disclaimers as the rest of the app -- this is not a
 * general-purpose chatbot and the system prompt instructs it to say so if
 * asked something outside that data.
 *
 * Bring-your-own-key: the backend only answers once an operator sets
 * ASSISTANT_API_KEY in its own environment (see
 * backend/app/core/config.py). Until then this widget explains that
 * plainly instead of pretending the feature doesn't exist or failing
 * silently.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAssistantStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s.configured ? "configured" : "unconfigured");
        setStatusNotice(s.notice);
      })
      .catch(() => {
        if (!cancelled) setStatus("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setError(null);
    const nextHistory = [...messages, { role: "user" as const, content: message }];
    setMessages(nextHistory);
    setSending(true);
    try {
      const result = await askAssistant(message, messages);
      setMessages([...nextHistory, { role: "assistant", content: result.answer }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unknown error.");
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="assistant-root">
      {open && (
        <div className="panel assistant-panel enter">
          <div className="assistant-panel-header">
            <div>
              <p className="eyebrow">Ask the app</p>
              <p className="text-sm font-semibold">Beyond Horizons assistant</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="btn-ghost !px-2 !py-1">
              ✕
            </button>
          </div>

          {status === "unconfigured" && (
            <div className="assistant-body">
              <p className="rounded-lg border px-3 py-2.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--background-soft)", color: "var(--muted)" }}>
                {statusNotice}
              </p>
            </div>
          )}

          {status === "unreachable" && (
            <div className="assistant-body">
              <p className="rounded-lg border px-3 py-2.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--background-soft)", color: "var(--muted)" }}>
                Could not reach the Beyond Horizons API, so the assistant can&apos;t be checked right now. Is the backend running?
              </p>
            </div>
          )}

          {status === "checking" && (
            <div className="assistant-body">
              <p className="text-xs" style={{ color: "var(--faint)" }}>
                Checking…
              </p>
            </div>
          )}

          {status === "configured" && (
            <>
              <div ref={scrollRef} className="assistant-body assistant-scroll">
                {messages.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--faint)" }}>
                    Ask about the Ares-180 crew, the simulation, or the evidence behind a risk. Answers are grounded only
                    in this app&apos;s own synthetic scenario and evidence graph -- not real astronaut data or medical
                    advice.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`assistant-bubble assistant-bubble-${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {sending && (
                  <div className="assistant-bubble assistant-bubble-assistant assistant-bubble-pending">Thinking…</div>
                )}
                {error && (
                  <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)", color: "var(--danger)" }}>
                    {error}
                  </p>
                )}
              </div>
              <form
                className="assistant-input-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask a question about this mission…"
                  className="assistant-input"
                  disabled={sending}
                />
                <button type="submit" className="btn-primary !px-3 !py-2" disabled={sending || !draft.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="assistant-fab"
        aria-label={open ? "Close assistant" : "Open assistant"}
        title={open ? "Close assistant" : "Ask the app"}
      >
        {open ? (
          "✕"
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
