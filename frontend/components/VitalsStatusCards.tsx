import type { MetricStatus, VitalMetricEvaluation } from "@/types/api";

const STATUS_TONE: Record<MetricStatus, string> = {
  normal: "var(--tone-emerald)",
  attention: "var(--tone-amber)",
  alert: "var(--tone-red)",
};

const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: "Normal",
  attention: "Attention",
  alert: "Alert",
};

function MetricCard({ metric }: { metric: VitalMetricEvaluation }) {
  const tone = STATUS_TONE[metric.status];
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        background: `color-mix(in srgb, ${tone} 8%, transparent)`,
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--faint)]">{metric.label}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}
        >
          {STATUS_LABEL[metric.status]}
        </span>
      </div>
      <div className="text-xl font-semibold">
        {metric.value}
        <span className="ml-1 text-sm font-normal text-[var(--faint)]">{metric.unit}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--faint)]">Reference: {metric.reference_range}</p>
    </div>
  );
}

export default function VitalsStatusCards({ metrics }: { metrics: VitalMetricEvaluation[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.metric_id} metric={m} />
      ))}
    </div>
  );
}

export { STATUS_TONE, STATUS_LABEL };
