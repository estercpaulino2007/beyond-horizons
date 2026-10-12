import { ApiError, getEvidenceGraph } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, SyntheticDataBanner, ScenarioCaption } from "@/components/Banner";
import EvidenceBadge from "@/components/EvidenceBadge";
import type { CausalEdgeData } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";
import HeroCelestial from "@/components/HeroCelestial";
import DnaHelix from "@/components/DnaHelix";

// Which already-verified-or-labelled edges from the evidence graph belong in
// each section of this page. This page introduces no new claims and no new
// data -- it only regroups edges already served by GET /api/v1/evidence/graph
// (see docs/data-sources.md for what is actually verified vs. synthetic).
const GENE_CELL_EDGE_IDS = [
  "radiation_exposure->dna_damage_response",
  "dna_damage_response->inflammatory_signaling",
  "microgravity->bone_remodeling_alteration",
  "bone_remodeling_alteration->bone_loss_risk",
];

const OPEN_QUESTION_EDGE_IDS = ["radiation_exposure->cognitive_performance_risk"];

const SOLUTION_EDGE_IDS = ["exercise_availability->muscle_recovery"];

function EdgeCard({ edge }: { edge: CausalEdgeData }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{edge.source}</span>
        <span className="text-xs text-[var(--faint)]">{edge.relation}</span>
        <span className="font-medium">{edge.target}</span>
        <EvidenceBadge level={edge.evidence_level} />
      </div>
      <p className="text-xs text-[var(--muted)]">
        <span className="font-medium">Reference:</span> {edge.evidence_reference}
      </p>
      {edge.limitations.length > 0 && (
        <ul className="list-inside list-disc text-xs text-[var(--faint)]">
          {edge.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function GeneticsPage() {
  let data;
  let error: string | null = null;
  try {
    data = await getEvidenceGraph();
  } catch (e) {
    error = e instanceof ApiError ? e.message : "Unknown error.";
  }

  const edges = data?.elements.edges.map((e) => e.data) ?? [];
  const byId = (ids: string[]) => edges.filter((e) => ids.includes(e.id));
  const geneCellEdges = byId(GENE_CELL_EDGE_IDS);
  const openQuestionEdges = byId(OPEN_QUESTION_EDGE_IDS);
  const solutionEdges = byId(SOLUTION_EDGE_IDS);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[200px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.spacecraftExterior})` }}
      >
        <HudFrame />
        <HeroCelestial
          textureSrc="/textures/moon_1024.jpg"
          size={70}
          glowColor="#c9d4e8"
          top="14%"
          right="10%"
        />
        <ScenarioCaption text="Radiation and gravity stress at the cellular level · illustrative, not a real mission photo" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Molecular &amp; cellular</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">Genetics, radiation &amp; countermeasures</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            How deep-space radiation and microgravity are hypothesized to act on crew at the
            cellular level, what is actually backed by a verified source today, what remains an
            open research question, and which countermeasures the simulation currently models.
          </p>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && (
        <div className="space-y-8">
          <div className="flex flex-col gap-3">
            <DisclaimerBanner text={data.disclaimer} />
            <SyntheticDataBanner text={data.synthetic_data_notice} />
          </div>

          <section className="panel p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <DnaHelix className="mx-auto shrink-0 sm:mx-0" />
              <div className="space-y-3 text-sm text-[var(--muted)]">
                <p>
                  Radiation exposure in deep space is a leading biological concern for Mars-class
                  missions: unlike low-Earth orbit, transit outside the magnetosphere removes most
                  shielding from galactic cosmic rays and solar particle events. At the cellular
                  level, the pathway this page follows is: radiation damages DNA → the cell&apos;s
                  damage-response machinery activates → that response is linked to downstream
                  inflammatory signaling, which the rest of the simulation treats as a contributor
                  to operational and cognitive risk.
                </p>
                <p className="text-xs text-[var(--faint)]">
                  The diagram is a decorative illustration of a double helix, not a rendering of
                  any specific gene or sequence referenced in the evidence graph below.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-lg font-semibold">Genes &amp; cell biology</h2>
            <p className="mb-3 text-xs text-[var(--faint)]">
              How radiation and microgravity are modeled as acting on cells and tissue —
              {" "}
              {geneCellEdges.filter((e) => e.evidence_level === "supported_evidence" || e.evidence_level === "data_supported_association").length} of {geneCellEdges.length} edges below are backed by a verified source; the rest are explicitly labelled as such.
            </p>
            <div className="panel divide-y divide-[var(--border)]">
              {geneCellEdges.map((edge) => (
                <EdgeCard key={edge.id} edge={edge} />
              ))}
            </div>
            {geneCellEdges.some((e) => e.evidence_reference.includes("NAG9-1024")) && (
              <div className="panel mt-3 border-l-2 p-4 text-xs text-[var(--muted)]" style={{ borderColor: "var(--tone-amber)" }}>
                <span className="font-medium" style={{ color: "var(--tone-amber)" }}>
                  Note on reference NAG9-1024:
                </span>{" "}
                the registered source for the radiation/DNA-damage edge above (rat skin, ground-based
                radiation) also tested a retinoid-based countermeasure. It is mentioned here for
                transparency about what that reference covers — the simulation itself does not model
                a retinoid countermeasure.
              </div>
            )}
          </section>

          {openQuestionEdges.length > 0 && (
            <section>
              <h2 className="mb-1 text-lg font-semibold">Open research question</h2>
              <p className="mb-3 text-xs text-[var(--faint)]">
                Explicitly NOT yet supported by data — the simulation surfaces this as a
                hypothesis to flag the gap, never as an established effect.
              </p>
              <div className="panel divide-y divide-[var(--border)]">
                {openQuestionEdges.map((edge) => (
                  <EdgeCard key={edge.id} edge={edge} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-1 text-lg font-semibold">Countermeasures &amp; solutions</h2>
            <p className="mb-3 text-xs text-[var(--faint)]">
              What the simulation currently models as mitigating the effects above.
            </p>
            <div className="panel divide-y divide-[var(--border)]">
              {solutionEdges.map((edge) => (
                <EdgeCard key={edge.id} edge={edge} />
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
