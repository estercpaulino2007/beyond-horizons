import type { MetricStatus, VitalsCategory } from "@/types/api";

/**
 * Illustrative holographic body-scan silhouette -- a stylized wireframe, not
 * a rendering of any real imaging modality (no MRI/CT/ultrasound data exists
 * anywhere in this app). Six glowing nodes map onto the six brief
 * categories (cardiac, respiratory, temperature, sleep/fatigue, activity &
 * muscle, hydration/other), each colored by that category's worst metric
 * status for the latest evaluated entry. Purely decorative/wayfinding: the
 * actual numbers and evidence live in the category cards below it.
 */
const TONE: Record<MetricStatus | "idle", string> = {
  normal: "#6fe3a3",
  attention: "#f5c26b",
  alert: "#ff8a8a",
  idle: "#3a4a63",
};

interface NodeSpec {
  category: VitalsCategory;
  cx: number;
  cy: number;
  label: string;
}

const NODES: NodeSpec[] = [
  { category: "sleep_fatigue", cx: 150, cy: 56, label: "Sleep & fatigue" },
  { category: "cardiac", cx: 138, cy: 168, label: "Cardiac" },
  { category: "respiratory", cx: 170, cy: 158, label: "Respiratory" },
  { category: "temperature", cx: 150, cy: 228, label: "Temperature" },
  { category: "hydration_other", cx: 150, cy: 272, label: "Hydration & other" },
  { category: "activity_muscle", cx: 150, cy: 400, label: "Activity & muscle" },
];

export default function VitalsBodyScan({
  statusByCategory,
}: {
  statusByCategory: Partial<Record<VitalsCategory, MetricStatus>>;
}) {
  const overallTone = (() => {
    const statuses = Object.values(statusByCategory);
    if (statuses.length === 0) return TONE.idle;
    if (statuses.includes("alert")) return TONE.alert;
    if (statuses.includes("attention")) return TONE.attention;
    return TONE.normal;
  })();

  return (
    <div className="vitals-card relative overflow-hidden rounded-xl p-4" style={{ ["--vitals-tone" as string]: overallTone }}>
      <svg viewBox="0 0 300 460" className="mx-auto w-full max-w-[220px]" role="img" aria-label="Illustrative body-scan status overview">
        <defs>
          <clipPath id="vitals-scan-clip">
            <rect x="60" y="10" width="180" height="440" rx="90" />
          </clipPath>
        </defs>

        {/* wireframe silhouette */}
        <g stroke="rgba(124,200,255,0.55)" strokeWidth={1.4} fill="none">
          <circle cx="150" cy="56" r="30" />
          <path d="M150 86 L150 120" />
          <path d="M110 120 Q150 104 190 120 L196 270 Q150 290 104 270 Z" />
          <path d="M110 128 L58 220 L66 232" />
          <path d="M190 128 L242 220 L234 232" />
          <path d="M122 288 L112 440" />
          <path d="M178 288 L188 440" />
        </g>

        {/* scanning sweep, clipped to the body silhouette */}
        <g clipPath="url(#vitals-scan-clip)">
          <rect x="60" y="0" width="180" height="60" fill={overallTone} opacity={0.12} className="vitals-scan-sweep" />
        </g>

        {NODES.map((n) => {
          const status = statusByCategory[n.category];
          const tone = status ? TONE[status] : TONE.idle;
          return (
            <g key={n.category}>
              <circle
                cx={n.cx}
                cy={n.cy}
                r={status ? 7 : 4}
                fill={tone}
                opacity={status ? 0.9 : 0.4}
                className={status ? "vitals-pulse" : undefined}
                style={{ ["--pulse-r-min" as string]: status ? 6 : 4, ["--pulse-r-max" as string]: status ? 10 : 4 }}
              />
              <circle cx={n.cx} cy={n.cy} r={status ? 14 : 8} fill={tone} opacity={0.18} />
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-[var(--faint)]">
        Illustrative scan overview — not real imaging data
      </p>
    </div>
  );
}
