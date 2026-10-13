"use client";

import { useState } from "react";
import type { VitalsEntry } from "@/types/api";

const DEFAULT_ENTRY: VitalsEntry = {
  heart_rate_bpm: 72,
  spo2_percent: 98,
  body_temp_c: 36.6,
  respiratory_rate_bpm: 14,
  sleep_hours: 7.5,
  stress_level: 3,
  activity_minutes: 30,
};

interface FieldSpec {
  key: keyof VitalsEntry;
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
  { key: "sleep_hours", label: "Sleep (last 24h)", unit: "h", min: 0, max: 14, step: 0.5 },
  { key: "stress_level", label: "Stress level", unit: "/10", min: 0, max: 10, step: 1 },
  { key: "activity_minutes", label: "Activity (last 24h)", unit: "min", min: 0, max: 300, step: 5 },
];

/**
 * Lets the person type in -- or, as a shortcut, slide -- one snapshot of
 * their own current vitals. Deliberately plain number inputs, not device
 * integration: this app has no sensor to read from, and pretending
 * otherwise would contradict its own "nothing invented" rule. See
 * app/domain/vitals_reference.py for how these seven numbers get evaluated.
 */
export default function VitalsForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (entry: VitalsEntry) => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<VitalsEntry>(DEFAULT_ENTRY);

  function update(key: keyof VitalsEntry, raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setValues((v) => ({ ...v, [key]: n }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="panel p-6"
    >
      <h2 className="mb-1 text-lg font-semibold">How are you feeling right now?</h2>
      <p className="mb-5 text-xs text-[var(--faint)]">
        Enter your own current readings -- a real wearable, a thermometer, or your own best estimate.
        This stays on your device: nothing is sent anywhere except this one evaluation request.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={f.key} className="font-medium">
                {f.label}
              </label>
              <span className="mono-tag">
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
      </div>

      <button type="submit" disabled={submitting} className="btn-primary mt-6">
        {submitting ? "Evaluating…" : "Evaluate my vitals"}
      </button>
    </form>
  );
}
