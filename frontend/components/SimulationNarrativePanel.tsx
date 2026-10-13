import type { MissionNarrative } from "@/lib/simulationNarrative";

/**
 * "What happened" narration for a simulation run -- plain-language sentences
 * generated entirely from the same numbers shown in the chart/table above
 * (see lib/simulationNarrative.ts). Exists because raw charts don't explain
 * themselves; every sentence here traces back to a value already in
 * SimulationRunResponse, nothing is invented.
 */
export default function SimulationNarrativePanel({ narrative }: { narrative: MissionNarrative }) {
  return (
    <section className="panel p-6">
      <h2 className="mb-1 text-lg font-semibold">What happened in this run</h2>
      <p className="mb-4 text-xs text-[var(--faint)]">
        Generated directly from this run&apos;s own numbers (peak days, sustained high/critical windows,
        top risk drivers) -- not a separate prediction or an AI summary.
      </p>

      {narrative.headline && (
        <p className="mb-4 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--background-soft)" }}>
          {narrative.headline}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {narrative.perCrew.map((entry) => (
          <div key={entry.crew_id} className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)" }}>
            <p className="mb-2 font-semibold">{entry.display_name}</p>
            <ul className="space-y-1.5 text-[var(--muted)]">
              {entry.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
