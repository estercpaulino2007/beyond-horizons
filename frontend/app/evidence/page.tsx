import { ApiError, getEvidenceGraph } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, SyntheticDataBanner, ScenarioCaption } from "@/components/Banner";
import EvidenceBadge from "@/components/EvidenceBadge";
import EvidenceGraphDiagram from "@/components/EvidenceGraphDiagram";
import type { EvidenceLevel } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";
import HeroCelestial from "@/components/HeroCelestial";

export default async function EvidencePage() {
  let data;
  let error: string | null = null;
  try {
    data = await getEvidenceGraph();
  } catch (e) {
    error = e instanceof ApiError ? e.message : "Unknown error.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[200px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.spacecraftExterior})` }}
      >
        <HudFrame />
        <HeroCelestial
          textureSrc="/textures/mars_1024.jpg"
          size={86}
          glowColor="#c9622f"
          top="16%"
          right="11%"
        />
        <ScenarioCaption text="Ares-180 in Mars transit · synthetic illustration, not a real mission photo" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Provenance</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">Evidence causal graph</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Every edge below is labelled by how it is actually backed. Only an edge whose
            reference is in the project&apos;s verified source registry can claim
            &quot;supported evidence&quot; or &quot;data-supported association&quot; — enforced at the
            schema level, not just in writing.
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

          <section className="panel panel-interactive p-6">
            <EvidenceGraphDiagram nodes={data.elements.nodes.map((n) => n.data)} edges={data.elements.edges.map((e) => e.data)} />
          </section>

          <section className="panel panel-interactive p-6">
            <h2 className="mb-3 text-lg font-semibold">Evidence level legend</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(data.evidence_level_legend).map(([level, description]) => (
                <div key={level} className="flex items-start gap-3">
                  <EvidenceBadge level={level as EvidenceLevel} />
                  <dd className="text-sm text-[var(--muted)]">{description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              All edges ({data.elements.edges.length}) — {data.elements.edges.filter((e) => e.data.evidence_level === "supported_evidence" || e.data.evidence_level === "data_supported_association").length} backed by a verified source
            </h2>
            <div className="panel divide-y divide-[var(--border)]">
              {data.elements.edges.map((edge) => (
                <div key={edge.data.id} className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{edge.data.source}</span>
                    <span className="text-xs text-[var(--faint)]">{edge.data.relation}</span>
                    <span className="font-medium">{edge.data.target}</span>
                    <EvidenceBadge level={edge.data.evidence_level} />
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    <span className="font-medium">Reference:</span> {edge.data.evidence_reference}
                  </p>
                  <ul className="list-inside list-disc text-xs text-[var(--faint)]">
                    {edge.data.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
