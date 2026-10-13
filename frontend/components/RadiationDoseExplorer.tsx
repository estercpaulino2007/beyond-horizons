"use client";

import { useState } from "react";
import EvidenceBadge from "@/components/EvidenceBadge";
import type { CausalEdgeData, CountermeasurePlan, CrewProfile } from "@/types/api";
import { doseBandLabel, scaledSeverity } from "@/lib/radiationDose";

/**
 * Lets the person set an illustrative relative radiation dose and see how
 * that scales (a) the already-evidenced pathway effects from the evidence
 * graph and (b) which crew members, by their own radiation_sensitivity
 * trait, would be most affected -- and what the simulation models as a
 * countermeasure.
 *
 * Deliberately does NOT name a specific gene or mutation: the evidence
 * graph this reads from only has pathway-level nodes (DNA damage response,
 * inflammatory signaling, cancer risk), backed by real sources at that
 * level. This project has no gene-level data to report, so it doesn't
 * pretend to -- see each edge's own evidence badge/reference/limitations
 * below, unchanged from the registry; only the severity label is new, and
 * it is explicitly scaled/illustrative, not a claimed measurement.
 */
export default function RadiationDoseExplorer({
  edges,
  crewProfiles,
  shieldingCountermeasure,
}: {
  edges: CausalEdgeData[];
  crewProfiles: CrewProfile[];
  shieldingCountermeasure: CountermeasurePlan | null;
}) {
  const [dose, setDose] = useState(50);

  const ranked = [...crewProfiles]
    .map((c) => ({ crew: c, score: c.baseline.radiation_sensitivity * (dose / 100) }))
    .sort((a, b) => b.score - a.score);

  return (
    <section className="panel p-6">
      <h2 className="mb-1 text-lg font-semibold">Radiation dose explorer</h2>
      <p className="mb-4 text-xs text-[var(--faint)]">
        Set an illustrative relative dose (not a measured mSv value -- this project has no verified
        dose-response curve) to see how it scales the pathway effects below and which crew member, by
        their own modeled radiation sensitivity, would be most affected.
      </p>

      <div className="mb-5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor="dose-slider" className="font-medium">
            Relative radiation dose
          </label>
          <span className="mono-tag">
            {dose}/100 · {doseBandLabel(dose)}
          </span>
        </div>
        <input
          id="dose-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={dose}
          onChange={(e) => setDose(Number(e.target.value))}
          className="hz-range"
        />
      </div>

      <div className="mb-6 space-y-3">
        {edges.map((edge) => {
          const sev = scaledSeverity(edge.weight, dose);
          return (
            <div key={edge.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{edge.source.replace(/_/g, " ")}</span>
                  <span className="text-xs text-[var(--faint)]">{edge.relation}</span>
                  <span className="font-medium">{edge.target.replace(/_/g, " ")}</span>
                </div>
                <EvidenceBadge level={edge.evidence_level} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>
                  At this dose: <strong>{sev.label}</strong> (illustrative score {sev.score.toFixed(2)})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold">Who this dose would affect most</h3>
        <p className="mb-2 text-xs text-[var(--faint)]">
          Ranked by each crew member&apos;s own modeled radiation_sensitivity trait × the dose above --
          this is this project&apos;s own synthetic crew baseline, not a prediction about any real
          person.
        </p>
        <ol className="space-y-1.5 text-sm">
          {ranked.map((r, i) => (
            <li key={r.crew.id} className="flex items-center justify-between rounded-md px-3 py-1.5" style={{ background: "var(--background-soft)" }}>
              <span>
                {i + 1}. {r.crew.display_name}{" "}
                <span className="text-xs text-[var(--faint)]">(sensitivity {r.crew.baseline.radiation_sensitivity.toFixed(2)})</span>
              </span>
              <span className="mono-tag">{r.score.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      </div>

      {shieldingCountermeasure && (
        <div className="rounded-lg border-l-2 p-4 text-sm" style={{ borderColor: "var(--tone-emerald)", background: "var(--background-soft)" }}>
          <p className="mb-1 font-semibold" style={{ color: "var(--tone-emerald)" }}>
            What the simulation models as mitigation
          </p>
          <p className="text-[var(--muted)]">{shieldingCountermeasure.description}</p>
          <ul className="mt-2 list-inside list-disc text-xs text-[var(--faint)]">
            {shieldingCountermeasure.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--faint)]">
            This is not a medical treatment -- it&apos;s a scenario countermeasure you can toggle on the{" "}
            <a href="/simulation" className="underline">
              Simulation
            </a>{" "}
            page.
          </p>
        </div>
      )}
    </section>
  );
}
