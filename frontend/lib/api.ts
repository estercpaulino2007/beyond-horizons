/**
 * Thin fetch wrappers around the backend API. Every function here hits a
 * real endpoint documented in backend/app/api/*.py -- nothing here
 * fabricates or falls back to placeholder data. If the backend is down or
 * returns an error, callers surface that error; they never substitute
 * invented numbers.
 */
import { API_BASE_URL } from "@/lib/config";
import type {
  AssistantAskResponse,
  AssistantStatusResponse,
  AssistantTurn,
  CounterfactualCompareResponse,
  CountermeasurePlan,
  DebateResult,
  EvidenceGraphResponse,
  MissionResponse,
  ResearchNavigatorRankingsResponse,
  SimulationRunRequestBody,
  SimulationRunResponse,
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Could not reach the Beyond Horizons API at ${API_BASE_URL}${path}. Is the backend running (./run.sh)?`,
      0,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(`${response.status} ${response.statusText}: ${body}`.trim(), response.status);
  }
  return (await response.json()) as T;
}

export const DEFAULT_MISSION_ID = "ares-180";

export function getMission(missionId: string = DEFAULT_MISSION_ID): Promise<MissionResponse> {
  return request<MissionResponse>(`/api/v1/missions/${missionId}`);
}

export function runSimulation(body: SimulationRunRequestBody = {}): Promise<SimulationRunResponse> {
  return request<SimulationRunResponse>("/api/v1/simulations/run", {
    method: "POST",
    body: JSON.stringify({
      mission_id: DEFAULT_MISSION_ID,
      countermeasures: [],
      ...body,
    }),
  });
}

export function getCountermeasureCatalog(): Promise<CountermeasurePlan[]> {
  return request<CountermeasurePlan[]>("/api/v1/countermeasures/catalog");
}

export function compareCounterfactuals(
  missionId: string = DEFAULT_MISSION_ID,
): Promise<CounterfactualCompareResponse> {
  return request<CounterfactualCompareResponse>("/api/v1/counterfactual/compare", {
    method: "POST",
    body: JSON.stringify({ mission_id: missionId }),
  });
}

export function getEvidenceGraph(): Promise<EvidenceGraphResponse> {
  return request<EvidenceGraphResponse>("/api/v1/evidence/graph");
}

export function getResearchNavigatorRankings(): Promise<ResearchNavigatorRankingsResponse> {
  return request<ResearchNavigatorRankingsResponse>("/api/v1/research-navigator/rankings");
}

export function getDebate(): Promise<DebateResult> {
  return request<DebateResult>("/api/v1/debate/ares-180");
}

export function getAssistantStatus(): Promise<AssistantStatusResponse> {
  return request<AssistantStatusResponse>("/api/v1/assistant/status");
}

// Separate from request(): on a 503/502 the backend sends a human-readable
// {"detail": "..."} explaining *why* (e.g. "not configured"), which the chat
// widget shows verbatim rather than a generic "503 Service Unavailable".
export async function askAssistant(message: string, history: AssistantTurn[]): Promise<AssistantAskResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/assistant/ask`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
  } catch {
    throw new ApiError(`Could not reach the Beyond Horizons API at ${API_BASE_URL}. Is the backend running (./run.sh)?`, 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.detail ?? `${response.status} ${response.statusText}`, response.status);
  }
  return (await response.json()) as AssistantAskResponse;
}
