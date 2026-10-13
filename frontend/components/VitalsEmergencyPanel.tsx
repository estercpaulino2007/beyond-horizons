import type { VitalMetricEvaluation } from "@/types/api";
import { STATUS_TONE } from "@/components/VitalsStatusCards";

/**
 * "Monitoramento complementar em situações de emergência" + "Acompanhamento
 * durante falhas de comunicação" from the brief. This app already has no
 * backend dependency for storing an entry (lib/vitalsStore.ts is pure
 * browser localStorage) and the evaluation itself is a local rule-based
 * calculation once the request reaches the backend -- so "keeps working
 * without a live link to Earth" is already how it's built. This panel makes
 * that fact visible and gives a large-print, glanceable view of whatever is
 * NOT normal right now, instead of making someone scan nine small cards.
 */
export default function VitalsEmergencyPanel({ metrics }: { metrics: VitalMetricEvaluation[] }) {
  const nonNormal = metrics.filter((m) => m.status !== "normal").sort((a, b) => (a.status === b.status ? 0 : a.status === "alert" ? -1 : 1));

  return (
    <section className="vitals-card rounded-xl p-6" style={{ ["--vitals-tone" as string]: nonNormal.some((m) => m.status === "alert") ? "#ff8a8a" : "#f5c26b" }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="vitals-bracket" style={{ ["--vitals-tone" as string]: "#ff8a8a" }}>
          EMERGENCY GLANCE
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-[#7e93b3]">Works offline · local storage only</span>
      </div>

      {nonNormal.length === 0 ? (
        <p className="py-6 text-center font-mono text-sm text-[#9fb3cf]">Nothing outside normal in the latest entry.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {nonNormal.map((m) => (
            <div key={m.metric_id} className="rounded-lg border p-4" style={{ borderColor: `color-mix(in srgb, ${STATUS_TONE[m.status]} 45%, transparent)`, background: `color-mix(in srgb, ${STATUS_TONE[m.status]} 10%, transparent)` }}>
              <div className="font-mono text-xs uppercase tracking-wide" style={{ color: STATUS_TONE[m.status] }}>
                {m.label}
              </div>
              <div className="font-mono text-3xl font-bold text-[#eef6ff]">
                {m.metric_id === "heart_rhythm" ? (m.value >= 1 ? "REGULAR" : "IRREGULAR") : m.value}
                <span className="ml-1 text-sm font-normal text-[#7e93b3]">{m.unit}</span>
              </div>
              {m.recommendations[0] && <p className="mt-1 text-xs text-[#9fb3cf]">→ {m.recommendations[0]}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] text-[#7e93b3]">
        This evaluation and your saved history live entirely in this browser and the one request you just
        made -- there is no dependency on a continuous link to the ground, so a communications blackout
        does not stop you from logging and checking your own readings.
      </p>
    </section>
  );
}
