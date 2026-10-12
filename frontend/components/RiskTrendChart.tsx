/**
 * A plain inline-SVG line chart -- no charting library dependency. Every
 * point plotted comes directly from a CrewTrajectory's real risk_results
 * (backend/app/services/simulation_engine.py output); nothing here is
 * interpolated beyond straight lines between the actual simulated days.
 */
const COLORS = ["#3B6EA5", "#C2642B", "#4F8A58", "#9D4E9E"];
const colorFor = (idx: number): string => COLORS[idx % COLORS.length] ?? "#3B6EA5";
const WIDTH = 880;
const HEIGHT = 320;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;

export interface TrendSeries {
  id: string;
  label: string;
  points: { day: number; value: number }[];
}

export default function RiskTrendChart({
  series,
  maxDay,
  yLabel,
}: {
  series: TrendSeries[];
  maxDay: number;
  yLabel: string;
}) {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (day: number) => PAD_LEFT + (day / Math.max(maxDay, 1)) * plotWidth;
  const yFor = (value: number) => PAD_TOP + (1 - Math.min(Math.max(value, 0), 1)) * plotHeight;

  const gridValues = [0, 0.25, 0.5, 0.75, 1];
  const dayTicks = Array.from({ length: 7 }, (_, i) => Math.round((maxDay / 6) * i));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[640px] w-full" role="img" aria-label={`${yLabel} over mission days`}>
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text x={PAD_LEFT - 8} y={yFor(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {dayTicks.map((d) => (
          <text key={d} x={xFor(d)} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
            day {d}
          </text>
        ))}
        <text x={-PAD_TOP} y={12} fontSize={10} fill="currentColor" opacity={0.6} transform={`rotate(-90) translate(${-HEIGHT / 2}, 0)`}>
          {yLabel}
        </text>

        {series.map((s, idx) => {
          const color = colorFor(idx);
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.day).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
            .join(" ");
          return <path key={s.id} d={path} fill="none" stroke={color} strokeWidth={2} />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((s, idx) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorFor(idx) }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
