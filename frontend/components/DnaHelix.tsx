const STEPS = 28;
const WIDTH = 140;
const HEIGHT = 420;
const AMPLITUDE = 34;

/** Precomputed once at module load -- this is a static decorative shape, no
 * need to recompute per render. */
function buildPoints() {
  const strandA: { x: number; y: number }[] = [];
  const strandB: { x: number; y: number }[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const y = t * HEIGHT;
    const phase = t * Math.PI * 4;
    strandA.push({ x: WIDTH / 2 + Math.sin(phase) * AMPLITUDE, y });
    strandB.push({ x: WIDTH / 2 + Math.sin(phase + Math.PI) * AMPLITUDE, y });
  }
  return { strandA, strandB };
}

const { strandA, strandB } = buildPoints();

function pathFor(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/**
 * A decorative animated DNA double-helix, for the Genetics page hero --
 * pure SVG, no external asset, themed with CSS variables so it follows
 * light/dark mode. Purely illustrative (aria-hidden): it does not represent
 * any specific gene or sequence from the evidence graph.
 */
export default function DnaHelix({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
      className={`dna-helix ${className}`}
    >
      {strandA.map((p, i) => {
        const q = strandB[i];
        if (i % 2 !== 0 || !q) return null;
        return (
          <line
            key={`rung-${i}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="var(--border-strong)"
            strokeWidth={1}
            opacity={0.55}
          />
        );
      })}
      <path d={pathFor(strandA)} fill="none" stroke="var(--accent-strong)" strokeWidth={2.5} opacity={0.85} />
      <path d={pathFor(strandB)} fill="none" stroke="var(--amber)" strokeWidth={2.5} opacity={0.85} />
      {strandA.map((p, i) => (
        <circle key={`a-${i}`} cx={p.x} cy={p.y} r={2.4} fill="var(--accent-strong)" />
      ))}
      {strandB.map((p, i) => (
        <circle key={`b-${i}`} cx={p.x} cy={p.y} r={2.4} fill="var(--amber)" />
      ))}
    </svg>
  );
}
