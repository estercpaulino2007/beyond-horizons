/**
 * Plain inline-SVG line chart for one vitals metric's history -- same
 * no-dependency approach as components/RiskTrendChart.tsx, but auto-scaled
 * to the metric's own min/max (a risk score is always 0-1; a heart rate or
 * a temperature is not) and plotted against real calendar dates instead of
 * mission days. Every point is a value the person actually submitted and
 * that was saved to their own browser (lib/vitalsStore.ts) -- nothing here
 * interpolates, predicts or smooths beyond straight lines between real
 * entries.
 */
const WIDTH = 880;
const HEIGHT = 260;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;

export interface VitalsTrendPoint {
  recordedAt: string; // ISO timestamp
  value: number;
}

export default function VitalsTrendChart({
  points,
  unit,
  color = "#5fb4ff",
}: {
  points: VitalsTrendPoint[];
  unit: string;
  color?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--faint)]">
        No entries yet in this range -- evaluate a snapshot above to start the trend.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.15;
  const yMax = rawMax + span * 0.15;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const n = points.length;

  const xFor = (i: number) => (n === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (i / (n - 1)) * plotWidth);
  const yFor = (value: number) => PAD_TOP + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (yMax - yMin));
  const dayTickIdx = n <= 7 ? points.map((_, i) => i) : Array.from({ length: 7 }, (_, i) => Math.round((i / 6) * (n - 1)));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[640px] w-full" role="img" aria-label={`Trend in ${unit}`}>
        {gridTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={PAD_LEFT - 8} y={yFor(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {Array.from(new Set(dayTickIdx)).map((i) => (
          <text key={i} x={xFor(i)} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
            {new Date(points[i]!.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.value)} r={3} fill={color} />
        ))}
      </svg>
      <p className="mt-1 text-right text-[11px] text-[var(--faint)]">values in {unit}</p>
    </div>
  );
}
