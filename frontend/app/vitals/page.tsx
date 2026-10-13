"use client";

import { useMemo, useState } from "react";
import { ApiError, evaluateVitals } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, SyntheticDataBanner } from "@/components/Banner";
import VitalsForm from "@/components/VitalsForm";
import VitalsStatusCards from "@/components/VitalsStatusCards";
import VitalsInsightsPanel from "@/components/VitalsInsightsPanel";
import VitalsTrendChart from "@/components/VitalsTrendChart";
import VitalsHistoryTable from "@/components/VitalsHistoryTable";
import { useVitalsHistory } from "@/lib/useVitalsHistory";
import { clearVitalsHistory, deleteVitalsRecord, saveVitalsRecord } from "@/lib/vitalsStore";
import type { VitalsEntry, VitalsEvaluationResponse } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";
import { ScenarioCaption } from "@/components/Banner";

type RangeDays = 7 | 30 | 90;

const TREND_METRICS: { key: keyof VitalsEntry; label: string; unit: string; color: string }[] = [
  { key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", color: "#5fb4ff" },
  { key: "spo2_percent", label: "SpO2", unit: "%", color: "#6fe3a3" },
  { key: "body_temp_c", label: "Body temperature", unit: "°C", color: "#f5a35e" },
  { key: "respiratory_rate_bpm", label: "Respiratory rate", unit: "breaths/min", color: "#c3a6ff" },
  { key: "sleep_hours", label: "Sleep", unit: "h", color: "#6fd9c9" },
  { key: "stress_level", label: "Stress level", unit: "/10", color: "#ff8a8a" },
  { key: "activity_minutes", label: "Activity", unit: "min", color: "#f5c26b" },
];

export default function VitalsPage() {
  const history = useVitalsHistory();
  const [latest, setLatest] = useState<VitalsEvaluationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<keyof VitalsEntry>("heart_rate_bpm");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  async function handleSubmit(entry: VitalsEntry) {
    setSubmitting(true);
    setError(null);
    try {
      const evaluation = await evaluateVitals(entry);
      setLatest(evaluation);
      saveVitalsRecord(entry, evaluation);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unknown error.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeMetric = TREND_METRICS.find((m) => m.key === trendMetric)!;

  const trendPoints = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return [...history]
      .filter((r) => new Date(r.recorded_at).getTime() >= cutoff)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((r) => ({ recordedAt: r.recorded_at, value: r.entry[trendMetric] }));
  }, [history, rangeDays, trendMetric]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[200px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.sleepQuarters})` }}
      >
        <HudFrame />
        <ScenarioCaption text="Synthetic illustration — AI-generated concept art, not a real crew member" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Personal check-in</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">My vitals</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter your own current readings and see how they compare to standard resting reference
            ranges, plus how they&apos;ve been trending — this is the one page in Beyond Horizons about
            you, not the synthetic Ares-180 crew.
          </p>
        </div>
      </section>

      <div className="mb-8 flex flex-col gap-3">
        <DisclaimerBanner text="This evaluates your own typed-in numbers against general adult resting reference ranges. It is not a diagnosis, not spaceflight-specific, and not a substitute for a real clinician." />
        <SyntheticDataBanner text="The reference ranges are standard terrestrial clinical guidance (AHA/CDC/WHO), not astronaut-specific data — see docs/data-sources.md (CLINICAL-VITALS-REFERENCE) for exactly where they come from." />
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      <div className="space-y-8">
        <VitalsForm onSubmit={handleSubmit} submitting={submitting} />

        {latest && (
          <>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Your current readings</h2>
              <VitalsStatusCards metrics={latest.metrics} />
            </section>

            <VitalsInsightsPanel
              overallStatus={latest.overall_status}
              insights={latest.insights}
              limitations={latest.limitations}
              referenceSource={latest.reference_source}
            />
          </>
        )}

        {history.length > 0 && (
          <>
            <section className="panel p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Evolution of your data</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value as keyof VitalsEntry)}
                    className="rounded-md border bg-transparent px-2 py-1 text-xs"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {TREND_METRICS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "var(--border)" }}>
                    {([7, 30, 90] as RangeDays[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRangeDays(d)}
                        className="px-3 py-1 text-xs"
                        style={
                          rangeDays === d
                            ? { background: "var(--accent-soft)", color: "var(--accent-strong)", fontWeight: 500 }
                            : { color: "var(--muted)" }
                        }
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <VitalsTrendChart points={trendPoints} unit={activeMetric.unit} color={activeMetric.color} />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Day-by-day history</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Clear all saved vitals history on this device?")) clearVitalsHistory();
                  }}
                  className="btn-ghost !px-3 !py-1 text-xs"
                >
                  Clear history
                </button>
              </div>
              <div className="panel p-4">
                <VitalsHistoryTable records={history} onDelete={deleteVitalsRecord} />
              </div>
              <p className="mt-2 text-xs text-[var(--faint)]">
                Saved only in this browser (localStorage) — nothing here is sent to or stored on the
                Beyond Horizons backend.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
