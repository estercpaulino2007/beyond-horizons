/**
 * Scales an evidence-graph edge's weight by a user-chosen, illustrative
 * "relative radiation dose" slider (0-100, arbitrary units -- deliberately
 * NOT a claimed mSv figure, since this project has no dose-response curve
 * backed by a verified source; see app/domain/evidence_graph.py).
 *
 * This produces a qualitative severity label, never a specific gene name or
 * mutation: the evidence graph only has pathway-level nodes (DNA damage
 * response, inflammatory signaling, cancer risk), not gene-level data, so
 * naming a specific gene here would be inventing a claim this project
 * cannot back. The number itself is also not hidden -- it's shown next to
 * the label so nothing is dressed up as more precise than it is.
 */

export function doseBandLabel(dose: number): string {
  if (dose <= 20) return "Minimal";
  if (dose <= 40) return "Low";
  if (dose <= 60) return "Moderate";
  if (dose <= 80) return "Elevated";
  return "Severe";
}

export interface ScaledSeverity {
  label: string;
  score: number; // 0..1, illustrative only
}

export function scaledSeverity(edgeWeight: number, dose: number): ScaledSeverity {
  const score = edgeWeight * (dose / 100);
  let label: string;
  if (score < 0.15) label = "Minimal";
  else if (score < 0.3) label = "Low";
  else if (score < 0.45) label = "Moderate";
  else if (score < 0.6) label = "Elevated";
  else label = "Severe";
  return { label, score };
}
