import type { MetricStatus, VitalMetricEvaluation, VitalsCategory } from "@/types/api";
import { STATUS_TONE } from "@/components/VitalsStatusCards";

/** Category order and labels match the challenge brief's own six groupings. */
const CATEGORY_ORDER: { key: VitalsCategory; label: string; blurb: string }[] = [
  { key: "cardiac", label: "Heart rate & cardiac activity", blurb: "BPM, rhythm, and anything that may need medical evaluation." },
  { key: "respiratory", label: "Blood oxygenation & respiration", blurb: "SpO2 and respiratory rate, including early signs of a breathing problem." },
  { key: "temperature", label: "Body temperature", blurb: "Tracked against general ranges and, below, your own personal pattern." },
  { key: "sleep_fatigue", label: "Sleep & fatigue", blurb: "Duration, self-rated quality, and stress as a fatigue indicator." },
  { key: "activity_muscle", label: "Activity & muscle condition", blurb: "Movement and exercise -- relevant to offsetting microgravity's effect on muscle/bone." },
  { key: "hydration_other", label: "Hydration & other indicators", blurb: "Self-estimated only -- no consumer device (including this app) measures hydration precisely." },
];

function statusBracket(status: MetricStatus) {
  const tone = STATUS_TONE[status];
  const label = status === "normal" ? "NORMAL" : status === "attention" ? "ATTENTION" : "ALERT";
  return (
    <span className="vitals-bracket" style={{ ["--vitals-tone" as string]: tone }}>
      {label}
    </span>
  );
}

/** heart_rhythm is encoded as 1.0/0.0 for schema uniformity (see
 * backend/app/domain/vitals_reference.py's _evaluate_heart_rhythm) -- shown
 * as text here rather than a bare "1"/"0" that would read like a real unit.
 */
function displayValue(metric: VitalMetricEvaluation): string {
  if (metric.metric_id === "heart_rhythm") return metric.value >= 1 ? "REGULAR" : "IRREGULAR";
  return `${metric.value}`;
}

function MetricRow({ metric }: { metric: VitalMetricEvaluation }) {
  return (
    <div className="border-t py-3 first:border-t-0" style={{ borderColor: "rgba(124,200,255,0.12)" }}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm text-[#d7e6ff]">{metric.label}</span>
        {statusBracket(metric.status)}
      </div>
      <div className="font-mono text-lg text-[#eef6ff]">
        {displayValue(metric)}
        {metric.unit && <span className="ml-1 text-xs text-[var(--faint)]">{metric.unit}</span>}
      </div>
      <p className="mt-1 text-xs text-[#9fb3cf]">{metric.note}</p>
      {metric.recommendations.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 pl-3 text-xs text-[#9fb3cf]" style={{ borderColor: STATUS_TONE[metric.status] }}>
          {metric.recommendations.map((r) => (
            <li key={r}>→ {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Groups the flat metrics list into the brief's six categories, each its own HUD panel. */
export default function VitalsCategoryGrid({ metrics }: { metrics: VitalMetricEvaluation[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CATEGORY_ORDER.map((cat) => {
        const items = metrics.filter((m) => m.category === cat.key);
        if (items.length === 0) return null;
        const worst = items.reduce<MetricStatus>((acc, m) => {
          const rank = { normal: 0, attention: 1, alert: 2 } as const;
          return rank[m.status] > rank[acc] ? m.status : acc;
        }, "normal");
        return (
          <section key={cat.key} className="vitals-card rounded-xl p-4" style={{ ["--vitals-tone" as string]: STATUS_TONE[worst] }}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#eef6ff]">{cat.label}</h3>
              {statusBracket(worst)}
            </div>
            <p className="mb-2 text-xs text-[#7e93b3]">{cat.blurb}</p>
            <div>
              {items.map((m) => (
                <MetricRow key={m.metric_id} metric={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
