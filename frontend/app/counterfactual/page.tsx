"use client";

import { useState } from "react";
import { ApiError, compareCounterfactuals } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, LanguageNoteBanner, ScenarioCaption } from "@/components/Banner";
import type { CounterfactualAlternativeResult, CounterfactualCompareResponse } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";

const ALTERNATIVE_LABELS: Record<string, string> = {
  A: "A — Maintain",
  B: "B — Delay 10 days",
  C: "C — Reassign + sleep recovery",
};

const METRICS: { key: keyof CounterfactualAlternativeResult; label: string }[] = [
  { key: "peak_operational_risk", label: "Peak operational risk" },
  { key: "peak_cognitive_risk", label: "Peak cognitive risk" },
  { key: "peak_musculoskeletal_risk", label: "Peak musculoskeletal risk" },
  { key: "mean_uncertainty", label: "Mean uncertainty" },
  { key: "eva_completion_probability", label: "EVA completion probability" },
];

export default function CounterfactualPage() {
  const [data, setData] = useState<CounterfactualCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      setData(await compareCounterfactuals());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  const bestPeakRisk = data
    ? Math.min(...data.alternatives.map((a) => a.peak_operational_risk))
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[260px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.evaSpacewalk})` }}
      >
        <HudFrame />
        <ScenarioCaption text="Scripted mission event · day 145 EVA · synthetic illustration, not a real mission photo" />
        <div className="hero-content flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Day 145 · EVA counterfactual</p>
            <h1 className="display-title mt-1 text-2xl sm:text-3xl">Day-145 EVA decision</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Compares three alternatives for the Ares-180 EVA decision. Each is a full,
              independent re-run of the simulation engine over days 143–160 — not a
              hand-adjusted estimate.
            </p>
          </div>
          <button onClick={handleRun} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? "Comparing..." : data ? "Run again" : "Compare alternatives"}
          </button>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && (
        <div className="space-y-8">
          <div className="flex flex-col gap-3">
            <DisclaimerBanner text={data.disclaimer} />
            <LanguageNoteBanner text={data.language_note} />
          </div>

          <section className="panel overflow-x-auto p-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--faint)]">
                  <th className="pb-3 pr-4">Metric</th>
                  {data.alternatives.map((alt) => (
                    <th key={alt.alternative} className="pb-3 pr-4">
                      {ALTERNATIVE_LABELS[alt.alternative] ?? alt.alternative}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="py-2.5 pr-4 text-[var(--muted)]">EVA day / crew</td>
                  {data.alternatives.map((alt) => (
                    <td key={alt.alternative} className="py-2.5 pr-4 font-mono text-xs">
                      day {alt.eva_day} · {alt.eva_crew_id}
                    </td>
                  ))}
                </tr>
                {METRICS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="py-2.5 pr-4 text-[var(--muted)]">{label}</td>
                    {data.alternatives.map((alt) => {
                      const value = alt[key] as number;
                      const isBestRisk = key === "peak_operational_risk" && value === bestPeakRisk;
                      return (
                        <td
                          key={alt.alternative}
                          className={`py-2.5 pr-4 font-mono ${isBestRisk ? "font-semibold text-emerald-300" : ""}`}
                        >
                          {value.toFixed(3)}
                          {isBestRisk ? " (lowest)" : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-4 text-[var(--muted)]">Top drivers</td>
                  {data.alternatives.map((alt) => (
                    <td key={alt.alternative} className="py-2.5 pr-4 text-xs">
                      {alt.top_drivers.join(", ")}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.alternatives.map((alt) => (
              <div key={alt.alternative} className="panel panel-interactive p-5">
                <p className="mb-1 font-semibold">{ALTERNATIVE_LABELS[alt.alternative] ?? alt.alternative}</p>
                <p className="text-sm text-[var(--muted)]">{alt.description}</p>
              </div>
            ))}
          </section>

          <p className="text-xs text-[var(--faint)]">
            Note: alternative B (delay) does not reduce peak risk relative to A in this
            model — see docs/methodology.md, reconciliation issue #12, for why. This project
            reports the computed result rather than adjusting the model to match an assumption.
          </p>
        </div>
      )}

      {!data && !error && (
        <p className="text-sm text-[var(--muted)]">
          Click &quot;Compare alternatives&quot; to run the engine three times and see the real,
          computed comparison.
        </p>
      )}
    </main>
  );
}
