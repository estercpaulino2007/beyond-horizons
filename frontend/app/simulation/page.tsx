"use client";

import { useState } from "react";
import { ApiError, runSimulation } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, SyntheticDataBanner, ScenarioCaption } from "@/components/Banner";
import RiskBadge from "@/components/RiskBadge";
import RiskTrendChart, { type TrendSeries } from "@/components/RiskTrendChart";
import type { SimulationRunResponse } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";

export default function SimulationPage() {
  const [data, setData] = useState<SimulationRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const result = await runSimulation();
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  const series: TrendSeries[] = (data?.trajectories ?? []).map((t) => ({
    id: t.crew_id,
    label: t.display_name,
    points: t.risk_results.map((r) => ({ day: r.day, value: r.scores.operational_risk })),
  }));
  const maxDay = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.day)));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[220px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.sleepQuarters})` }}
      >
        <HudFrame />
        <ScenarioCaption text="Crew quarters · modeled sleep-debt dynamics · synthetic illustration, not a real mission photo" />
        <div className="hero-content flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ares-180 · 180-day mission</p>
            <h1 className="display-title mt-1 text-2xl sm:text-3xl">Daily simulation</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Runs the engine over the full 180-day Ares-180 seed for all four crew members.
            </p>
          </div>
          <button onClick={handleRun} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? "Running simulation..." : data ? "Run again" : "Run simulation"}
          </button>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && (
        <div className="space-y-8">
          <div className="flex flex-col gap-3">
            <DisclaimerBanner text={data.disclaimer} />
            <SyntheticDataBanner text={data.synthetic_data_notice} />
          </div>

          <section className="panel panel-interactive p-6">
            <h2 className="mb-3 text-lg font-semibold">Operational risk over the mission</h2>
            <RiskTrendChart series={series} maxDay={maxDay} yLabel="operational_risk" />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Days by risk band, per crew member</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.trajectories.map((t) => {
                const counts = data.band_day_counts[t.crew_id];
                return (
                  <div key={t.crew_id} className="panel panel-interactive p-5">
                    <p className="mb-3 font-semibold">{t.display_name}</p>
                    <div className="space-y-1.5">
                      {(["low", "moderate", "high", "critical"] as const).map((band) => (
                        <div key={band} className="flex items-center justify-between gap-2">
                          <RiskBadge band={band} />
                          <span className="font-mono text-sm">{counts?.[band] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Vulnerability windows</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Maximal runs of consecutive days where a crew member&apos;s risk band was
              &quot;high&quot; or &quot;critical&quot;, with the risk drivers that appeared most often.
            </p>
            <div className="space-y-4">
              {data.trajectories.map((t) =>
                t.vulnerability_windows.length === 0 ? null : (
                  <div key={t.crew_id} className="panel panel-interactive p-5">
                    <p className="mb-2 font-semibold">{t.display_name}</p>
                    <div className="space-y-2">
                      {t.vulnerability_windows.map((w) => (
                        <div
                          key={`${w.day_start}-${w.day_end}`}
                          className="flex flex-col gap-1 border-l-2 border-[var(--accent-strong)] pl-3 text-sm sm:flex-row sm:items-baseline sm:gap-3"
                        >
                          <span className="font-mono text-xs text-[var(--faint)]">
                            days {w.day_start}–{w.day_end}
                          </span>
                          <RiskBadge band={w.severity} />
                          <span className="text-[var(--muted)]">
                            top drivers: {w.primary_drivers.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
              {data.trajectories.every((t) => t.vulnerability_windows.length === 0) && (
                <p className="text-sm text-[var(--muted)]">
                  No high/critical vulnerability windows were detected for any crew member.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {!data && !error && (
        <p className="text-sm text-[var(--muted)]">
          Click &quot;Run simulation&quot; to execute the engine and see real, computed results —
          nothing here is pre-rendered or guessed.
        </p>
      )}
    </main>
  );
}
