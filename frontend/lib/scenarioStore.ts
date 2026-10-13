/**
 * Lets a customized scenario (crew/mission overrides applied on the
 * Simulation page) be reflected on other pages (Mission overview,
 * Genetics) without re-fetching or re-deriving anything -- the Simulation
 * page saves exactly the resolved `mission`/`crew_profiles` that
 * POST /api/v1/simulations/run actually simulated (see SimulationRunResponse
 * in backend/app/schemas/api.py), and this module just stores/retrieves
 * that same data.
 *
 * Deliberately NOT a global state library: this is one small
 * browser-localStorage value plus a same-tab CustomEvent so any mounted
 * page re-renders immediately when the Simulation page saves or clears it.
 * Per-viewer, client-only, best-effort -- never used as a source of truth
 * for anything the backend itself computes.
 */
import type { CrewProfile, MissionConfig } from "@/types/api";

const STORAGE_KEY = "beyond-horizons:custom-scenario";
const CHANGE_EVENT = "beyond-horizons:scenario-changed";

export interface CustomScenario {
  mission: MissionConfig;
  crew_profiles: CrewProfile[];
  saved_at: string;
}

export function saveCustomScenario(mission: MissionConfig, crew_profiles: CrewProfile[]): void {
  const value: CustomScenario = { mission, crew_profiles, saved_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Best-effort only (private browsing, storage full, etc.) -- the
    // Simulation page itself still has its own results regardless.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function clearCustomScenario(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function loadCustomScenario(): CustomScenario | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomScenario;
  } catch {
    return null;
  }
}

export function onCustomScenarioChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
