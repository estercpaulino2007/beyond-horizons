"use client";

import { useEffect, useState } from "react";
import { ApiError, getCountermeasureCatalog, getMission, runSimulation } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, SyntheticDataBanner, ScenarioCaption } from "@/components/Banner";
import RiskBadge from "@/components/RiskBadge";
import RiskTrendChart, { type TrendSeries } from "@/components/RiskTrendChart";
import SimulationCustomizer from "@/components/SimulationCustomizer";
import type { CountermeasurePlan, MissionResponse, SimulationRunRequestBody, SimulationRunResponse } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";

export default function SimulationPage() {
  const [mission, setMission] = useState<MissionResponse | null>(null);
  const [catalog, setCatalog] = useState<CountermeasurePlan[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [data, setData] = useState<SimulationRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMission(), getCountermeasureCatalog()])
      .then(([missionResult, catalogResult]) => {
        setMission(missionResult);
        setCatalog(catalogResult);
      })
      .catch((e) => setSetupError(e instanceof ApiError ? e.message : "Unknown error."));
  }, []);

  async function handleRun(payload: SimulationRunRequestBody) {
    setLoading(true);
    setError(null);
    try {
      const result = await runSimulation(payload);
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
        <div className="hero-content">
          <p className="eyebrow">Ares-180 · customizable scenario</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">Daily simulation</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Customize crew traits, mission parameters, active events and countermeasures below, or
            just run the Ares-180 default scenario as-is.
          </p>
        </div>
      </section>

      {setupError && <ErrorBanner message={setupError} />}

      {mission && (
        <div className="mb-8">
          <SimulationCustomizer mission={mission} catalog={catalog} onRun={handleRun} loading={loading} />
        </div>
      )}

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
                const counts = data.band_day_counts[t.crew_id] ?? { low: 0, moderate: 0, high: 0, critical: 0 };
                return (
                  <div key={t.crew_id} className="panel panel-interactive p-5">
                    <p className="mb-3 font-semibold">{t.display_name}</p>
                    <div className="space-y-2 text-sm">
                      {(["low", "moderate", "high", "critical"] as const).map((band) => (
                        <div key={band} className="flex items-center justify-between">
                          <RiskBadge band={band} />
                          <span className="mono-tag">{counts[band]} days</span>
                        </div>
                      ))}
                    </div>
                    {t.vulnerability_windows.length > 0 && (
                      <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                        <p className="mb-1 font-medium">Vulnerability windows</p>
                        {t.vulnerability_windows.map((w, i) => (
                          <p key={i}>
                            Day {w.day_start}
                            {w.day_end !== w.day_start ? `–${w.day_end}` : ""} ({w.severity}) —{" "}
                            {w.primary_drivers.join(", ")}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
