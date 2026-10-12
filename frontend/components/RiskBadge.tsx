import type { RiskBand } from "@/types/api";

// Theme-aware: each tone is a CSS variable that's tuned separately for dark
// and light mode in globals.css, so these badges stay legible on both a
// near-black and a near-white surface.
const BAND_TONE: Record<RiskBand, string> = {
  low: "var(--tone-emerald)",
  moderate: "var(--tone-amber)",
  high: "var(--tone-orange)",
  critical: "var(--tone-red)",
};

export default function RiskBadge({ band }: { band: RiskBand }) {
  const tone = BAND_TONE[band];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 45%, transparent)`,
        background: `color-mix(in srgb, ${tone} 15%, transparent)`,
      }}
    >
      {band}
    </span>
  );
}
