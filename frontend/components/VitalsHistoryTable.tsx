import type { VitalsHistoryRecord } from "@/lib/vitalsStore";
import type { VitalsEntry } from "@/types/api";

const COLUMNS: { key: keyof VitalsEntry; label: string; unit: string }[] = [
  { key: "heart_rate_bpm", label: "HR", unit: "bpm" },
  { key: "spo2_percent", label: "SpO2", unit: "%" },
  { key: "body_temp_c", label: "Temp", unit: "°C" },
  { key: "respiratory_rate_bpm", label: "Resp.", unit: "/min" },
  { key: "sleep_hours", label: "Sleep", unit: "h" },
  { key: "stress_level", label: "Stress", unit: "/10" },
  { key: "activity_minutes", label: "Activity", unit: "min" },
];

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null || current === previous) return <span className="text-[var(--faint)]">–</span>;
  const diff = current - previous;
  const up = diff > 0;
  return (
    <span style={{ color: up ? "var(--tone-sky)" : "var(--tone-orange)" }}>
      {up ? "↑" : "↓"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
    </span>
  );
}

/**
 * Day-by-day view of every saved snapshot (newest first), each value next
 * to how it changed from the entry immediately before it -- purely a
 * rendering of what's already in lib/vitalsStore.ts, no new computation.
 */
export default function VitalsHistoryTable({ records, onDelete }: { records: VitalsHistoryRecord[]; onDelete: (id: string) => void }) {
  const chronological = [...records].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const newestFirst = [...chronological].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-[var(--faint)]" style={{ borderColor: "var(--border)" }}>
            <th className="py-2 pr-3">When</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="py-2 pr-3">
                {c.label} ({c.unit})
              </th>
            ))}
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3" />
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {newestFirst.map((record) => {
            const idx = chronological.findIndex((r) => r.id === record.id);
            const previous = idx > 0 ? chronological[idx - 1]! : null;
            return (
              <tr key={record.id}>
                <td className="py-2.5 pr-3 text-xs text-[var(--faint)]">
                  {new Date(record.recorded_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="py-2.5 pr-3">
                    <div>{record.entry[c.key]}</div>
                    <div className="text-xs">
                      <Delta current={record.entry[c.key]} previous={previous ? previous.entry[c.key] : null} />
                    </div>
                  </td>
                ))}
                <td className="py-2.5 pr-3 text-xs capitalize" style={{ color: `var(--tone-${record.evaluation.overall_status === "normal" ? "emerald" : record.evaluation.overall_status === "attention" ? "amber" : "red"})` }}>
                  {record.evaluation.overall_status}
                </td>
                <td className="py-2.5 pr-3">
                  <button type="button" onClick={() => onDelete(record.id)} className="text-xs text-[var(--faint)] hover:text-[var(--danger)]">
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
