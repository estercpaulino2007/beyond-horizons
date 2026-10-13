"use client";

import { useState } from "react";
import type { HeartRhythm, VitalsEntry } from "@/types/api";

const DEFAULT_ENTRY: VitalsEntry = {
  heart_rate_bpm: 72,
  heart_rhythm: "regular",
  spo2_percent: 98,
  body_temp_c: 36.6,
  respiratory_rate_bpm: 14,
  sleep_hours: 7.5,
  sleep_quality: 4,
  stress_level: 3,
  activity_minutes: 30,
  hydration_level: 7,
  body_mass_kg: null,
};

interface FieldSpec {
  key: Exclude<keyof VitalsEntry, "heart_rhythm" | "body_mass_kg">;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const FIELDS: FieldSpec[] = [
  { key: "heart_rate_bpm", label: "Heart rate", unit: "bpm", min: 20, max: 220, step: 1 },
  { key: "spo2_percent", label: "Blood oxygen (SpO2)", unit: "%", min: 50, max: 100, step: 1 },
  { key: "body_temp_c", label: "Body temperature", unit: "°C", min: 33, max: 41, step: 0.1 },
  { key: "respiratory_rate_bpm", label: "Respiratory rate", unit: "breaths/min", min: 4, max: 50, step: 1 },
  { key: "sleep_hours", label: "Sleep duration (last 24h)", unit: "h", min: 0, max: 14, step: 0.5 },
  { key: "sleep_quality", label: "Sleep quality (self-rated)", unit: "/5", min: 1, max: 5, step: 1 },
  { key: "stress_level", label: "Stress level", unit: "/10", min: 0, max: 10, step: 1 },
  { key: "activity_minutes", label: "Activity (last 24h)", unit: "min", min: 0, max: 300, step: 5 },
  { key: "hydration_level", label: "Hydration (self-estimated)", unit: "/10", min: 0, max: 10, step: 1 },
];

/**
 * Lets the person type in -- or slide -- one snapshot of their own current
 * vitals, now covering all six brief categories: cardiac (rate + rhythm),
 * respiratory, temperature, sleep & fatigue, activity & muscle, and
 * hydration/other (+ optional body mass, tracked for trend only). No field
 * here pretends to come from a sensor this app doesn't have -- heart_rhythm
 * is explicitly "how it felt", not an ECG reading.
 */
export default function VitalsForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (entry: VitalsEntry) => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<VitalsEntry>(DEFAULT_ENTRY);
  const [massInput, setMassInput] = useState("");

  function update(key: FieldSpec["key"], raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setValues((v) => ({ ...v, [key]: n }));
  }

  function setRhythm(rhythm: HeartRhythm) {
    setValues((v) => ({ ...v, heart_rhythm: rhythm }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const massKg = massInput.trim() === "" ? null : Number(massInput);
        onSubmit({ ...values, body_mass_kg: massKg != null && !Number.isNaN(massKg) ? massKg : null });
      }}
      className="vitals-card rounded-xl p-6"
      style={{ ["--vitals-tone" as string]: "#7cc8ff" }}
    >
      <h2 className="mb-1 font-mono text-sm uppercase tracking-wide text-[#7cc8ff]">Crew self-report input</h2>
      <p className="mb-5 text-xs text-[#7e93b3]">
        Enter your own current readings -- a real wearable, a thermometer, or your own best estimate. This
        stays on your device: nothing is sent anywhere except this one evaluation request.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-[#d7e6ff]">Heart rhythm (how it felt)</span>
          </div>
          <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "rgba(124,200,255,0.3)" }}>
            {(["regular", "irregular"] as HeartRhythm[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRhythm(r)}
                className="flex-1 px-3 py-1.5 font-mono text-xs uppercase tracking-wide"
                style={
                  values.heart_rhythm === r
                    ? { background: "rgba(124,200,255,0.18)", color: "#7cc8ff" }
                    : { color: "#7e93b3" }
                }
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#7e93b3]">
            This app has no ECG sensor -- this is only whether it felt regular, not an electrical reading.
          </p>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={f.key} className="font-mono text-[#d7e6ff]">
                {f.label}
              </label>
              <span className="mono-tag" style={{ color: "#7cc8ff" }}>
                {values[f.key]} {f.unit}
              </span>
            </div>
            <input
              id={f.key}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={values[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="hz-range"
            />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="body_mass_kg" className="font-mono text-sm text-[#d7e6ff]">
            Body mass (optional, trend only)
          </label>
          <input
            id="body_mass_kg"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 78.5"
            value={massInput}
            onChange={(e) => setMassInput(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
            style={{ borderColor: "rgba(124,200,255,0.3)", color: "#d7e6ff" }}
          />
          <p className="text-[10px] text-[#7e93b3]">No universal &quot;normal&quot; exists -- only used for your own evolution chart.</p>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary mt-6">
        {submitting ? "Evaluating…" : "Evaluate my vitals"}
      </button>
    </form>
  );
}
