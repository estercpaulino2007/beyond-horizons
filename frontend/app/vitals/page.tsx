"use client";

import { useMemo, useState } from "react";
import { ApiError, evaluateVitals } from "@/lib/api";
import { ErrorBanner } from "@/components/Banner";
import VitalsForm from "@/components/VitalsForm";
import VitalsCategoryGrid from "@/components/VitalsCategoryGrid";
import VitalsBodyScan from "@/components/VitalsBodyScan";
import VitalsECGStrip from "@/components/VitalsECGStrip";
import VitalsTrendFlagsPanel from "@/components/VitalsTrendFlagsPanel";
import VitalsEmergencyPanel from "@/components/VitalsEmergencyPanel";
import VitalsTrendChart from "@/components/VitalsTrendChart";
import VitalsHistoryTable from "@/components/VitalsHistoryTable";
import { useVitalsHistory } from "@/lib/useVitalsHistory";
import { clearVitalsHistory, deleteVitalsRecord, saveVitalsRecord } from "@/lib/vitalsStore";
import { computeTrendFlags } from "@/lib/vitalsTrends";
import type { VitalsCategory, VitalsEntry, VitalsEvaluationResponse } from "@/types/api";

type RangeDays = 7 | 30 | 90;
type NumericVitalsKey = Exclude<keyof VitalsEntry, "heart_rhythm">;

const TREND_METRICS: { key: NumericVitalsKey; label: string; unit: string; color: string }[] = [
  { key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", color: "#5fb4ff" },
  { key: "spo2_percent", label: "SpO2", unit: "%", color: "#6fe3a3" },
  { key: "body_temp_c", label: "Body temperature", unit: "°C", color: "#f5a35e" },
  { key: "respiratory_rate_bpm", label: "Respiratory rate", unit: "breaths/min", color: "#c3a6ff" },
  { key: "sleep_hours", label: "Sleep", unit: "h", color: "#6fd9c9" },
  { key: "sleep_quality", label: "Sleep quality", unit: "/5", color: "#9fd86f" },
  { key: "stress_level", label: "Stress level", unit: "/10", color: "#ff8a8a" },
  { key: "activity_minutes", label: "Activity", unit: "min", color: "#f5c26b" },
  { key: "hydration_level", label: "Hydration", unit: "/10", color: "#5fd4e0" },
  { key: "body_mass_kg", label: "Body mass", unit: "kg", color: "#c9ced9" },
];

export default function VitalsPage() {
  const history = useVitalsHistory();
  const [latest, setLatest] = useState<VitalsEvaluationResponse | null>(null);
  const [latestEntry, setLatestEntry] = useState<VitalsEntry | null>(null);
  const [latestRecordId, setLatestRecordId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<NumericVitalsKey>("heart_rate_bpm");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [emergencyMode, setEmergencyMode] = useState(false);

  async function handleSubmit(entry: VitalsEntry) {
    setSubmitting(true);
    setError(null);
    try {
      const evaluation = await evaluateVitals(entry);
      setLatest(evaluation);
      setLatestEntry(entry);
      const record = saveVitalsRecord(entry, evaluation);
      setLatestRecordId(record.id);
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
      .filter((r) => new Date(r.recorded_at).getTime() >= cutoff && r.entry[trendMetric] != null)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((r) => ({ recordedAt: r.recorded_at, value: r.entry[trendMetric] as number }));
  }, [history, rangeDays, trendMetric]);

  const statusByCategory = useMemo(() => {
    if (!latest) return {};
    const rank = { normal: 0, attention: 1, alert: 2 } as const;
    const acc: Partial<Record<VitalsCategory, "normal" | "attention" | "alert">> = {};
    for (const m of latest.metrics) {
      const current = acc[m.category];
      if (!current || rank[m.status] > rank[current]) acc[m.category] = m.status;
    }
    return acc;
  }, [latest]);

  const trendFlags = useMemo(() => {
    if (!latestEntry) return [];
    // priorRecords = everything saved BEFORE this latest entry (it's already in
    // `history` once saved -- excluded by id, not object identity, since
    // reloading from localStorage always produces fresh object references).
    const priorRecords = history.filter((r) => r.id !== latestRecordId);
    return computeTrendFlags(priorRecords, latestEntry);
  }, [history, latestEntry, latestRecordId]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="vitals-console enter mb-8 p-6 sm:p-8">
        <VitalsECGStrip color={latest ? (latest.overall_status === "normal" ? "#6fe3a3" : latest.overall_status === "attention" ? "#f5c26b" : "#ff8a8a") : "#5fb4ff"} />
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#7cc8ff]">Crew medical console</p>
            <h1 className="mt-1 text-2xl font-bold text-[#eef6ff] sm:text-3xl">My vitals</h1>
            <p className="mt-2 text-sm text-[#9fb3cf]">
              Enter your own current readings and see how they compare to standard resting reference
              ranges <em>and</em> to your own personal history -- this is the one console in Beyond
              Horizons about you, not the synthetic Ares-180 crew.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border px-2.5 py-1" style={{ borderColor: "rgba(124,200,255,0.25)", color: "#9fb3cf" }}>
                Exploratory, not clinical
              </span>
              <span className="rounded-md border px-2.5 py-1" style={{ borderColor: "rgba(124,200,255,0.25)", color: "#9fb3cf" }}>
                General adult reference ranges (AHA/CDC/WHO) -- not spaceflight-specific
              </span>
              <span className="rounded-md border px-2.5 py-1" style={{ borderColor: "rgba(124,200,255,0.25)", color: "#9fb3cf" }}>
                No ECG/hydration sensor -- self-reported only
              </span>
            </div>
          </div>
          <VitalsBodyScan statusByCategory={statusByCategory} />
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="space-y-8">
        <VitalsForm onSubmit={handleSubmit} submitting={submitting} />

        {latest && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-sm uppercase tracking-wide text-[#7cc8ff]">Readouts by system</h2>
              <button
                type="button"
                onClick={() => setEmergencyMode((v) => !v)}
                className="vitals-bracket"
                style={{ ["--vitals-tone" as string]: emergencyMode ? "#ff8a8a" : "#7cc8ff", cursor: "pointer" }}
              >
                {emergencyMode ? "EXIT EMERGENCY VIEW" : "EMERGENCY VIEW"}
              </button>
            </div>

            {emergencyMode ? (
              <VitalsEmergencyPanel metrics={latest.metrics} />
            ) : (
              <>
                <VitalsCategoryGrid metrics={latest.metrics} />
                <VitalsTrendFlagsPanel flags={trendFlags} minEntriesNeeded={Math.max(0, 3 - history.length)} />
              </>
            )}

            <section className="vitals-card rounded-xl p-5" style={{ ["--vitals-tone" as string]: "#7cc8ff" }}>
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[#7cc8ff]">What this reading suggests</h3>
              <ul className="mb-3 space-y-1.5 text-sm text-[#d7e6ff]">
                {latest.insights.map((text, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#7e93b3]">•</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <ul className="list-inside list-disc text-xs text-[#7e93b3]">
                {latest.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        {history.length > 0 && (
          <>
            <section className="vitals-card rounded-xl p-6" style={{ ["--vitals-tone" as string]: "#7cc8ff" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-mono text-sm uppercase tracking-wide text-[#7cc8ff]">Evolution of your data</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={trendMetric}
                    onChange={(e) => setTrendMetric(e.target.value as NumericVitalsKey)}
                    className="rounded-md border bg-transparent px-2 py-1 text-xs text-[#d7e6ff]"
                    style={{ borderColor: "rgba(124,200,255,0.3)" }}
                  >
                    {TREND_METRICS.map((m) => (
                      <option key={m.key} value={m.key} className="bg-[#03050a]">
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "rgba(124,200,255,0.3)" }}>
                    {([7, 30, 90] as RangeDays[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRangeDays(d)}
                        className="px-3 py-1 text-xs"
                        style={rangeDays === d ? { background: "rgba(124,200,255,0.18)", color: "#7cc8ff", fontWeight: 500 } : { color: "#7e93b3" }}
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-[#d7e6ff]">
                <VitalsTrendChart points={trendPoints} unit={activeMetric.unit} color={activeMetric.color} />
              </div>
            </section>

            <section className="vitals-card rounded-xl p-6" style={{ ["--vitals-tone" as string]: "#7cc8ff" }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mono text-sm uppercase tracking-wide text-[#7cc8ff]">Day-by-day history</h2>
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
              <div className="text-[#d7e6ff]">
                <VitalsHistoryTable records={history} onDelete={deleteVitalsRecord} />
              </div>
              <p className="mt-2 text-xs text-[#7e93b3]">
                Saved only in this browser (localStorage) — nothing here is sent to or stored on the Beyond
                Horizons backend.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
