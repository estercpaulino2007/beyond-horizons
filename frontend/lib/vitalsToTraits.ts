/**
 * Turns the person's own latest My Vitals snapshot into the two other shapes
 * this app needs it in:
 *
 *  - `buildVitalsSummaryText()` -- a short plain-text summary sent to the
 *    in-app assistant as `vitals_summary` (see components/AssistantWidget.tsx
 *    and backend/app/services/assistant.py), so it can answer "how am I
 *    doing" questions about the person themselves instead of only the
 *    synthetic Ares-180 crew.
 *
 *  - `vitalsToCrewBaseline()` -- a seed for the "Simulate as yourself" crew
 *    slot in components/SimulationCustomizer.tsx. This lets the person start
 *    the simulation's 6-trait baseline from something real (per their own
 *    choice: My Vitals seeds it, then every slider stays manually
 *    adjustable), rather than being stuck with one of the four fixed
 *    Atlas/Nova/Lyra/Orion archetypes.
 *
 * Both are deliberately simple, documented, one-way mappings -- not a
 * medical model. Vitals are evaluated against general adult resting
 * reference ranges (see backend/app/schemas/vitals.py), not spaceflight
 * physiology, so this mapping is a readable, honest proxy, not a prediction.
 * Two of the six simulation traits (radiation_sensitivity,
 * bone_loss_susceptibility) have NO reasonable proxy in resting vitals --
 * this file leaves them at the neutral 0.5 default rather than inventing a
 * number, and says so in the UI copy that calls vitalsToCrewBaseline().
 */
import type { CrewBaselineOverride, VitalsEntry, VitalsEvaluationResponse } from "@/types/api";
import type { VitalsHistoryRecord } from "@/lib/vitalsStore";

const NEUTRAL = 0.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * sleep_resilience: higher = more resilient to sleep debt (see
 * backend/app/services/simulation_engine.py). Built from how close
 * sleep_hours is to a healthy ~8h, blended with the person's own
 * self-rated sleep_quality (1-5).
 */
function sleepResilienceFrom(entry: VitalsEntry): number {
  const hoursScore = clamp01(1 - Math.abs(entry.sleep_hours - 8) / 8);
  const qualityScore = clamp01((entry.sleep_quality - 1) / 4);
  return clamp01(0.45 * hoursScore + 0.55 * qualityScore);
}

/**
 * cognitive_resilience: higher = better (see simulation_engine.py). Mainly
 * the inverse of self-reported stress_level (0-10), with sleep quality as a
 * secondary factor since fatigue also affects cognition.
 */
function cognitiveResilienceFrom(entry: VitalsEntry): number {
  const stressScore = clamp01(1 - entry.stress_level / 10);
  const sleepAssist = clamp01((entry.sleep_quality - 1) / 4);
  return clamp01(0.7 * stressScore + 0.3 * sleepAssist);
}

/**
 * muscle_recovery: higher = better (see simulation_engine.py, where it rises
 * with exercise and decays without it). Built from activity_minutes in the
 * last 24h (diminishing returns past ~60min) and hydration_level, since poor
 * hydration also slows recovery.
 */
function muscleRecoveryFrom(entry: VitalsEntry): number {
  const activityScore = clamp01(entry.activity_minutes / 60);
  const hydrationScore = clamp01(entry.hydration_level / 10);
  return clamp01(0.65 * activityScore + 0.35 * hydrationScore);
}

/**
 * inflammatory_baseline: higher = more baseline inflammatory load (not yet
 * wired into the simulation engine's day-by-day math -- see
 * simulation_engine.py -- but still part of the crew schema). This is the
 * weakest proxy of the four: a rough signal from stress and sleep debt, both
 * loosely associated with inflammation in general physiology, not a measured
 * marker.
 */
function inflammatoryBaselineFrom(entry: VitalsEntry): number {
  const stressLoad = clamp01(entry.stress_level / 10);
  const sleepDebtLoad = clamp01(1 - (entry.sleep_quality - 1) / 4);
  return clamp01(0.5 * stressLoad + 0.5 * sleepDebtLoad);
}

/**
 * Maps the person's latest vitals entry to a 6-trait crew baseline override.
 * radiation_sensitivity and bone_loss_susceptibility are left at the neutral
 * 0.5 default -- resting vitals give no honest signal for either, so this
 * does not guess.
 */
export function vitalsToCrewBaseline(entry: VitalsEntry): CrewBaselineOverride {
  return {
    radiation_sensitivity: NEUTRAL,
    bone_loss_susceptibility: NEUTRAL,
    sleep_resilience: sleepResilienceFrom(entry),
    muscle_recovery: muscleRecoveryFrom(entry),
    cognitive_resilience: cognitiveResilienceFrom(entry),
    inflammatory_baseline: inflammatoryBaselineFrom(entry),
  };
}

/** Trait keys this file actually derives from vitals (for UI labelling). */
export const VITALS_DERIVED_TRAITS: (keyof CrewBaselineOverride)[] = [
  "sleep_resilience",
  "muscle_recovery",
  "cognitive_resilience",
  "inflammatory_baseline",
];

/** Trait keys left at the neutral default because vitals give no proxy. */
export const VITALS_NEUTRAL_TRAITS: (keyof CrewBaselineOverride)[] = [
  "radiation_sensitivity",
  "bone_loss_susceptibility",
];

function formatMetric(m: VitalsEvaluationResponse["metrics"][number]): string {
  return `${m.label}: ${m.value}${m.unit} (${m.status}${m.status !== "normal" ? ", " + m.reference_range : ""})`;
}

/**
 * Builds a short plain-text summary of one vitals history record, meant to
 * travel to the backend as `vitals_summary` on POST /api/v1/assistant/ask
 * (see lib/api.ts askAssistant() and backend/app/services/assistant.py).
 * Kept well under the 2000-char server cap.
 */
export function buildVitalsSummaryText(record: VitalsHistoryRecord): string {
  const { entry, evaluation } = record;
  const when = new Date(record.recorded_at).toLocaleString();
  const lines = [
    `Recorded ${when}. Overall status: ${evaluation.overall_status}.`,
    ...evaluation.metrics.map((m) => `- ${formatMetric(m)}`),
  ];
  if (entry.body_mass_kg) lines.push(`- Body mass: ${entry.body_mass_kg}kg`);
  return lines.join("\n");
}
