import type { CausalEdgeData, CausalNodeData } from "@/types/api";

/**
 * A static, deterministic SVG rendering of the evidence causal graph.
 * Node/column positions are derived purely from each node's `category`
 * (grouped left-to-right along the causal flow: exposure -> molecular ->
 * physiological -> behavioral -> countermeasure -> operational) and the
 * real node/edge data returned by GET /api/v1/evidence/graph -- nothing
 * here is a hand-placed diagram of a specific graph shape, so it stays
 * correct if the backend graph changes.
 */
const CATEGORY_ORDER = ["exposure", "molecular", "physiological", "behavioral", "countermeasure", "operational"];
const CATEGORY_LABELS: Record<string, string> = {
  exposure: "Exposure",
  molecular: "Molecular",
  physiological: "Physiological",
  behavioral: "Behavioral",
  countermeasure: "Countermeasure",
  operational: "Operational",
};

// Same tones as EvidenceBadge, which are tuned per theme in globals.css so
// the graph's edge colors stay legible on both the dark and light surface.
const EVIDENCE_COLORS: Record<string, string> = {
  supported_evidence: "var(--tone-emerald)",
  data_supported_association: "var(--tone-teal)",
  exploratory_hypothesis: "var(--tone-amber)",
  synthetic_parameter: "var(--tone-slate)",
};

const COL_WIDTH = 190;
const ROW_HEIGHT = 86;
const NODE_W = 160;
const NODE_H = 48;
const PAD_TOP = 30;
const PAD_LEFT = 20;

export default function EvidenceGraphDiagram({
  nodes,
  edges,
}: {
  nodes: CausalNodeData[];
  edges: CausalEdgeData[];
}) {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const columnOf = (category: string) => {
    const idx = CATEGORY_ORDER.indexOf(category);
    return idx === -1 ? CATEGORY_ORDER.length : idx;
  };

  const rowCounters = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number; node: CausalNodeData }>();
  for (const node of sortedNodes) {
    const col = columnOf(node.category);
    const row = rowCounters.get(col) ?? 0;
    rowCounters.set(col, row + 1);
    positions.set(node.id, {
      x: PAD_LEFT + col * COL_WIDTH,
      y: PAD_TOP + row * ROW_HEIGHT,
      node,
    });
  }

  const maxRows = Math.max(1, ...Array.from(rowCounters.values()));
  const numCols = Math.max(1, ...Array.from(rowCounters.keys())) + 1;
  const width = PAD_LEFT * 2 + numCols * COL_WIDTH;
  const height = PAD_TOP * 2 + maxRows * ROW_HEIGHT;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full" role="img" aria-label="Evidence causal graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity={0.5} />
          </marker>
        </defs>

        {CATEGORY_ORDER.map((cat, idx) =>
          rowCounters.has(idx) ? (
            <text key={cat} x={PAD_LEFT + idx * COL_WIDTH + NODE_W / 2} y={16} textAnchor="middle" fontSize={11} fontWeight={600} fill="currentColor" opacity={0.6}>
              {CATEGORY_LABELS[cat] ?? cat}
            </text>
          ) : null,
        )}

        {edges.map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          const x1 = source.x + NODE_W;
          const y1 = source.y + NODE_H / 2;
          const x2 = target.x;
          const y2 = target.y + NODE_H / 2;
          const color = EVIDENCE_COLORS[edge.evidence_level] ?? "var(--tone-slate)";
          const midX = (x1 + x2) / 2;
          return (
            <g key={edge.id}>
              <path
                d={target.x >= source.x + NODE_W ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={1.75}
                strokeOpacity={0.7}
                markerEnd="url(#arrow)"
              />
              <title>{`${edge.source} ${edge.relation} ${edge.target} (${edge.evidence_level})`}</title>
              <text x={midX} y={(y1 + y2) / 2 - 4} textAnchor="middle" fontSize={9} fill={color}>
                {edge.relation}
              </text>
            </g>
          );
        })}

        {Array.from(positions.values()).map(({ x, y, node }) => (
          <g key={node.id}>
            <rect
              x={x}
              y={y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              className="fill-[var(--surface)] stroke-[var(--border)]"
              strokeWidth={1}
            />
            <title>{node.description}</title>
            <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 4} textAnchor="middle" fontSize={11.5} fill="currentColor">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
