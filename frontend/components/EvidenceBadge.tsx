import type { EvidenceLevel } from "@/types/api";

// Theme-aware: each tone is a CSS variable that's tuned separately for dark
// and light mode in globals.css, so these badges stay legible on both a
// near-black and a near-white surface.
const LEVEL_TONE: Record<EvidenceLevel, string> = {
  supported_evidence: "var(--tone-emerald)",
  data_supported_association: "var(--tone-teal)",
  exploratory_hypothesis: "var(--tone-amber)",
  synthetic_parameter: "var(--tone-slate)",
};

const LEVEL_LABELS: Record<EvidenceLevel, string> = {
  supported_evidence: "Supported evidence",
  data_supported_association: "Data-supported association",
  exploratory_hypothesis: "Exploratory hypothesis",
  synthetic_parameter: "Synthetic parameter",
};

export default function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const tone = LEVEL_TONE[level];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 45%, transparent)`,
        background: `color-mix(in srgb, ${tone} 15%, transparent)`,
      }}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}
