import type { TrendFlag } from "@/lib/vitalsTrends";

const SEVERITY_TONE: Record<TrendFlag["severity"], string> = {
  notable: "#f5c26b",
  significant: "#ff8a8a",
};

/**
 * "Analisa tendências e compara os dados atuais com o histórico do
 * astronauta para detectar alterações potencialmente preocupantes antes que
 * se agravem" -- this is that feature. Every flag here comes from
 * lib/vitalsTrends.ts comparing the latest entry to the person's own recent
 * average; nothing is clinical or predictive, which the panel says plainly.
 */
export default function VitalsTrendFlagsPanel({ flags, minEntriesNeeded }: { flags: TrendFlag[]; minEntriesNeeded: number }) {
  if (flags.length === 0) {
    return (
      <section className="vitals-card rounded-xl p-5" style={{ ["--vitals-tone" as string]: "#6fe3a3" }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="vitals-bracket">TREND: STABLE</span>
        </div>
        <p className="text-xs text-[#9fb3cf]">
          Nothing in this entry deviates meaningfully from your own recent average
          {minEntriesNeeded > 0 ? ` (once you have ${minEntriesNeeded}+ saved entries, this compares against your personal history, not just the general reference range)` : ""}.
        </p>
      </section>
    );
  }

  return (
    <section className="vitals-card rounded-xl p-5" style={{ ["--vitals-tone" as string]: flags.some((f) => f.severity === "significant") ? "#ff8a8a" : "#f5c26b" }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="vitals-bracket">TREND: {flags.some((f) => f.severity === "significant") ? "SIGNIFICANT CHANGE" : "WATCH"}</span>
      </div>
      <p className="mb-4 text-xs text-[#9fb3cf]">
        These compare your latest entry to <em>your own</em> recent average, not just the general reference
        range -- the goal is catching a pattern before it becomes an out-of-range reading on its own.
      </p>
      <div className="space-y-4">
        {flags.map((f) => (
          <div key={f.metricId} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: "rgba(124,200,255,0.12)" }}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-[#d7e6ff]">{f.label}</span>
              <span className="vitals-bracket" style={{ ["--vitals-tone" as string]: SEVERITY_TONE[f.severity] }}>
                {f.severity === "significant" ? "SIGNIFICANT" : "NOTABLE"}
              </span>
            </div>
            <p className="text-xs text-[#9fb3cf]">{f.why}</p>
            <ul className="mt-2 space-y-1 border-l-2 pl-3 text-xs text-[#9fb3cf]" style={{ borderColor: SEVERITY_TONE[f.severity] }}>
              {f.actions.map((a) => (
                <li key={a}>→ {a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
