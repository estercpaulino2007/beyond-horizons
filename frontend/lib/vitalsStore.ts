/**
 * Local history of self-reported vitals snapshots, one evaluated entry per
 * submission (see POST /api/v1/vitals/evaluate in lib/api.ts). Same pattern
 * as lib/scenarioStore.ts: browser localStorage + a same-tab CustomEvent so
 * the Vitals page re-renders immediately after a save, no backend
 * persistence, per-viewer and best-effort only.
 *
 * The backend never sees or stores this history -- it only evaluates one
 * snapshot at a time, stateless. All "evolution over time" charting reads
 * straight from what was already returned and saved here; nothing is
 * recomputed or re-interpreted by the server.
 */
import type { VitalsEntry, VitalsEvaluationResponse } from "@/types/api";

const STORAGE_KEY = "beyond-horizons:vitals-history";
const CHANGE_EVENT = "beyond-horizons:vitals-changed";
const MAX_ENTRIES = 180; // ~6 months of daily entries, plenty for a demo

export interface VitalsHistoryRecord {
  id: string;
  recorded_at: string; // ISO timestamp
  entry: VitalsEntry;
  evaluation: VitalsEvaluationResponse;
}

export function saveVitalsRecord(entry: VitalsEntry, evaluation: VitalsEvaluationResponse): VitalsHistoryRecord {
  const record: VitalsHistoryRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recorded_at: new Date().toISOString(),
    entry,
    evaluation,
  };
  const history = loadVitalsHistory();
  history.push(record);
  history.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const trimmed = history.slice(-MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort only (private browsing, storage full, etc.)
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return record;
}

export function loadVitalsHistory(): VitalsHistoryRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VitalsHistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearVitalsHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function deleteVitalsRecord(id: string): void {
  const history = loadVitalsHistory().filter((r) => r.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onVitalsHistoryChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
