import type { MetricStatus } from "@/types/api";
import { STATUS_TONE } from "@/components/VitalsStatusCards";

/**
 * Every sentence here is one of the deterministic notes produced by
 * app/domain/vitals_reference.py -- nothing is phrased by an LLM, so the
 * same input always reads back the same insights (see that module's own
 * docstring for why).
 */
export default function VitalsInsightsPanel({
  overallStatus,
  insights,
  limitations,
  referenceSource,
}: {
  overallStatus: MetricStatus;
  insights: string[];
  limitations: string[];
  referenceSource: string;
}) {
  const tone = STATUS_TONE[overallStatus];
  return (
    <section className="panel p-6">
      <div className="mb-3 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: tone, boxShadow: `0 0 8px 1px color-mix(in srgb, ${tone} 70%, transparent)` }}
        />
        <h2 className="text-lg font-semibold">What this reading suggests</h2>
      </div>
      <ul className="mb-4 space-y-2 text-sm text-[var(--muted)]">
        {insights.map((text, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-[var(--faint)]">
              •
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border px-3 py-2.5 text-xs text-[var(--faint)]" style={{ borderColor: "var(--border)" }}>
        <p className="mb-1">
          Compared against: <span className="font-mono">{referenceSource}</span> -- general adult resting
          reference ranges.
        </p>
        <ul className="list-inside list-disc">
          {limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
