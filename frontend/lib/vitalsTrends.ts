/**
 * Personal-baseline trend detection: "Analisa tendências e compara os dados
 * atuais com o histórico do astronauta para detectar alterações
 * potencialmente preocupantes antes que se agravem" -- deliberately built as
 * a deterministic heuristic over the person's OWN saved history
 * (lib/vitalsStore.ts), computed entirely client-side.
 *
 * This is NOT a statistical or clinical claim -- it is a simple "how far is
 * today from your own recent average" comparison, the same honesty
 * discipline as the rest of this project: no model, no LLM, no invented
 * significance test. A metric is flagged only when it both (a) deviates
 * enough from the person's own recent readings AND (b) moved in the
 * direction that the brief/evidence-graph already treats as a concern (e.g.
 * SpO2 trending down, stress trending up) -- so a "better than before"
 * change never gets flagged as a problem.
 *
 * Why this matters on top of the single-entry evaluation
 * (app/domain/vitals_reference.py): a reading can sit fully inside the
 * generic clinical reference range and still represent a real change for
 * THIS person -- e.g. resting heart rate quietly climbing from 62 to 78 bpm
 * over a week is still "normal" by the generic range but is exactly the
 * kind of early pattern the brief asks to catch "before it worsens".
 */
import type { VitalsHistoryRecord } from "@/lib/vitalsStore";
import type { VitalsCategory, VitalsEntry } from "@/types/api";

type NumericField = Exclude<keyof VitalsEntry, "heart_rhythm" | "body_mass_kg">;

interface MetricSpec {
  key: NumericField;
  label: string;
  unit: string;
  category: VitalsCategory;
  /** Which direction away from baseline counts as "worth flagging". */
  concerningDirection: "up" | "down" | "either";
  /** Minimum absolute delta to flag when the person's history has near-zero spread. */
  minAbsDelta: number;
  actions: string[];
}

const METRIC_SPECS: MetricSpec[] = [
  {
    key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", category: "cardiac", concerningDirection: "either", minAbsDelta: 8,
    actions: [
      "Compare against what you were doing differently today (exertion, caffeine, stress, dehydration, poor sleep).",
      "If this keeps climbing (or dropping) entry after entry rather than bouncing back, flag it to a real clinician -- a sustained personal trend is more meaningful than any single reading.",
    ],
  },
  {
    key: "spo2_percent", label: "Blood oxygen (SpO2)", unit: "%", category: "respiratory", concerningDirection: "down", minAbsDelta: 2,
    actions: [
      "A downward trend in your own SpO2, even while still 'normal' on the general scale, is worth rechecking with correct sensor placement.",
      "If it keeps trending down across entries, that pattern deserves medical evaluation, not just a one-off recheck.",
    ],
  },
  {
    key: "respiratory_rate_bpm", label: "Respiratory rate", unit: "breaths/min", category: "respiratory", concerningDirection: "either", minAbsDelta: 4,
    actions: ["Recheck at rest, and note anything that changed (illness, stress, exertion, cabin/room conditions)."],
  },
  {
    key: "body_temp_c", label: "Body temperature", unit: "°C", category: "temperature", concerningDirection: "up", minAbsDelta: 0.4,
    actions: [
      "A rising trend from your own baseline is more informative than one reading -- note any other symptoms.",
      "If it keeps rising across entries, treat it as worth a real check, not just something to watch here.",
    ],
  },
  {
    key: "sleep_hours", label: "Sleep duration", unit: "h", category: "sleep_fatigue", concerningDirection: "down", minAbsDelta: 1.5,
    actions: ["A downward trend in sleep compounds -- prioritize recovery sleep over the next few nights, not just tonight."],
  },
  {
    key: "sleep_quality", label: "Sleep quality", unit: "/5", category: "sleep_fatigue", concerningDirection: "down", minAbsDelta: 1,
    actions: ["If your self-rated quality keeps dropping even with similar hours, look at what changed in your sleep environment or routine."],
  },
  {
    key: "stress_level", label: "Stress level", unit: "/10", category: "sleep_fatigue", concerningDirection: "up", minAbsDelta: 2,
    actions: ["A rising personal stress trend, more than any single high reading, is worth raising with whoever supports crew/team wellbeing."],
  },
  {
    key: "activity_minutes", label: "Physical activity", unit: "min", category: "activity_muscle", concerningDirection: "down", minAbsDelta: 15,
    actions: ["A sustained drop in activity compounds the microgravity-linked muscle/bone effects covered on the Genetics page -- worth rebuilding gradually."],
  },
  {
    key: "hydration_level", label: "Hydration", unit: "/10", category: "hydration_other", concerningDirection: "down", minAbsDelta: 2,
    actions: ["A downward hydration trend across several entries is worth acting on even though no single reading here is a measurement."],
  },
];

export interface TrendFlag {
  metricId: NumericField;
  label: string;
  unit: string;
  category: VitalsCategory;
  current: number;
  baselineMean: number;
  baselineCount: number;
  deltaAbs: number;
  direction: "up" | "down";
  severity: "notable" | "significant";
  why: string;
  actions: string[];
}

const MIN_BASELINE_ENTRIES = 3;
const MAX_BASELINE_ENTRIES = 14;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * priorRecords: the person's saved history BEFORE the entry being evaluated
 * (oldest first or any order -- this function sorts internally).
 */
export function computeTrendFlags(priorRecords: VitalsHistoryRecord[], latest: VitalsEntry): TrendFlag[] {
  const chronological = [...priorRecords].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const recent = chronological.slice(-MAX_BASELINE_ENTRIES);
  if (recent.length < MIN_BASELINE_ENTRIES) return [];

  const flags: TrendFlag[] = [];

  for (const spec of METRIC_SPECS) {
    const priorValues = recent.map((r) => r.entry[spec.key]);
    const avg = mean(priorValues);
    const sd = stddev(priorValues, avg);
    const current = latest[spec.key];
    const deltaAbs = current - avg;
    const direction: "up" | "down" = deltaAbs >= 0 ? "up" : "down";

    if (spec.concerningDirection !== "either" && spec.concerningDirection !== direction) continue;

    const threshold = Math.max(spec.minAbsDelta, sd * 1.5);
    const strongThreshold = Math.max(spec.minAbsDelta * 1.75, sd * 2.5);
    if (Math.abs(deltaAbs) < threshold) continue;

    const severity: "notable" | "significant" = Math.abs(deltaAbs) >= strongThreshold ? "significant" : "notable";
    const verb = direction === "up" ? "risen" : "dropped";
    const why =
      `${spec.label} has ${verb} to ${current.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${spec.unit}, ` +
      `${Math.abs(deltaAbs).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${spec.unit} away from your own recent average of ` +
      `${avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${spec.unit} (last ${recent.length} entries). ` +
      `Even inside a generically 'normal' range, a change this size from your own pattern is the kind of early signal worth watching before it becomes a bigger problem.`;

    flags.push({
      metricId: spec.key, label: spec.label, unit: spec.unit, category: spec.category,
      current, baselineMean: avg, baselineCount: recent.length, deltaAbs, direction, severity,
      why, actions: spec.actions,
    });
  }

  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "significant" ? -1 : 1));
}
