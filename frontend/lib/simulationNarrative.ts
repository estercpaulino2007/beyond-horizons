/**
 * Turns a SimulationRunResponse into plain-language sentences about what
 * happened during the run -- entirely computed from numbers the backend
 * already returned (top_drivers, vulnerability_windows, band_day_counts,
 * scripted events). No LLM call and no new claim: every sentence just
 * narrates a value that is also visible in the chart/table above it, so it
 * can never say something the data doesn't already show.
 */
import type { CrewTrajectory, RiskBand, SimulationEvent } from "@/types/api";

const BAND_RANK: Record<RiskBand, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
const BAND_LABEL: Record<RiskBand, string> = {
  low: "low",
  moderate: "moderate",
  high: "high",
  critical: "critical",
};

export interface NarrativeEntry {
  crew_id: string;
  display_name: string;
  lines: string[];
}

export interface MissionNarrative {
  headline: string | null;
  perCrew: NarrativeEntry[];
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function eventsOverlapping(events: SimulationEvent[], day: number): SimulationEvent[] {
  return events.filter((e) => day >= e.day_start && day <= e.day_end);
}

function buildCrewLines(trajectory: CrewTrajectory, events: SimulationEvent[]): string[] {
  const lines: string[] = [];
  const results = trajectory.risk_results;
  if (results.length === 0) return lines;

  // Peak day: the single highest operational_risk day.
  let peak = results[0]!;
  for (const r of results) {
    if (r.scores.operational_risk > peak.scores.operational_risk) peak = r;
  }
  const topDriver = peak.top_drivers[0];
  const peakEvents = eventsOverlapping(events, peak.day);
  const eventClause = peakEvents.length > 0 ? `, during "${peakEvents[0]!.description}"` : "";
  lines.push(
    `Peak risk was on day ${peak.day} (${BAND_LABEL[peak.band]} band, operational risk ${pct(
      peak.scores.operational_risk,
    )}${eventClause})${topDriver ? `, led mainly by ${topDriver.name.replace(/_/g, " ")} (${pct(topDriver.contribution)} of the day's score)` : ""}.`,
  );

  // Vulnerability windows: sustained high/critical stretches.
  if (trajectory.vulnerability_windows.length > 0) {
    const w = trajectory.vulnerability_windows[0]!;
    const span = w.day_end !== w.day_start ? `days ${w.day_start}–${w.day_end}` : `day ${w.day_start}`;
    lines.push(
      `Spent a sustained stretch in the ${w.severity} band on ${span}, driven mainly by ${w.primary_drivers
        .map((d) => d.replace(/_/g, " "))
        .join(" and ")}.`,
    );
    if (trajectory.vulnerability_windows.length > 1) {
      lines.push(`${trajectory.vulnerability_windows.length - 1} other high/critical window(s) also occurred later in the mission.`);
    }
  } else {
    lines.push("Never sustained a high or critical risk band for more than a single day.");
  }

  // Trend: first day vs. last day band.
  const first = results[0]!;
  const last = results[results.length - 1]!;
  if (BAND_RANK[last.band] > BAND_RANK[first.band]) {
    lines.push(`Risk band trended upward over the mission: ${BAND_LABEL[first.band]} on day ${first.day} → ${BAND_LABEL[last.band]} on day ${last.day}.`);
  } else if (BAND_RANK[last.band] < BAND_RANK[first.band]) {
    lines.push(`Risk band trended downward over the mission: ${BAND_LABEL[first.band]} on day ${first.day} → ${BAND_LABEL[last.band]} on day ${last.day}.`);
  }

  return lines;
}

export function buildMissionNarrative(
  trajectories: CrewTrajectory[],
  bandDayCounts: Record<string, Record<string, number>>,
  events: SimulationEvent[],
): MissionNarrative {
  const perCrew = trajectories.map((t) => ({
    crew_id: t.crew_id,
    display_name: t.display_name,
    lines: buildCrewLines(t, events),
  }));

  // Mission-level headline: who carried the most high+critical days.
  let headline: string | null = null;
  let worst: { name: string; days: number } | null = null;
  for (const t of trajectories) {
    const counts = bandDayCounts[t.crew_id];
    if (!counts) continue;
    const days = (counts.high ?? 0) + (counts.critical ?? 0);
    if (!worst || days > worst.days) worst = { name: t.display_name, days };
  }
  if (worst && worst.days > 0) {
    headline = `${worst.name} spent the most time in high/critical risk across the mission (${worst.days} day${worst.days === 1 ? "" : "s"}).`;
  } else if (trajectories.length > 0) {
    headline = "No crew member spent any simulated day in the high or critical risk band.";
  }

  return { headline, perCrew };
}
