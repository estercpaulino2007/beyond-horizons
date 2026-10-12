import { ApiError, getResearchNavigatorRankings } from "@/lib/api";
import { ErrorBanner, LanguageNoteBanner, ScenarioCaption } from "@/components/Banner";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";

export default async function ResearchNavigatorPage() {
  let data;
  let error: string | null = null;
  try {
    data = await getResearchNavigatorRankings();
  } catch (e) {
    error = e instanceof ApiError ? e.message : "Unknown error.";
  }

  const maxPriority = data ? Math.max(...data.proposals.map((p) => p.priority)) : 1;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[200px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.heroHabitat})` }}
      >
        <HudFrame />
        <ScenarioCaption text="Ares-180 habitat · synthetic illustration, not a real mission photo" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Future work, ranked</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">Research Navigator</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Hypothetical follow-up experiments, each tied to a specific gap in the evidence
            graph, ranked by a transparent formula.
          </p>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && (
        <div className="space-y-6">
          <LanguageNoteBanner text={data.language_note} />
          <p className="font-mono text-xs text-[var(--faint)]">{data.priority_formula}</p>

          <div className="space-y-4">
            {data.proposals.map((proposal, idx) => (
              <div key={proposal.id} className="panel panel-interactive p-6">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    <span className="mr-2 text-[var(--faint)]">#{idx + 1}</span>
                    {proposal.title}
                  </h2>
                  <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                    priority {proposal.priority.toFixed(4)}
                  </span>
                </div>

                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(proposal.priority / maxPriority) * 100}%` }}
                  />
                </div>

                <p className="mb-3 text-sm text-[var(--muted)]">{proposal.gap_description}</p>

                <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Mission impact" value={proposal.mission_impact} />
                  <Metric label="Uncertainty" value={proposal.uncertainty} />
                  <Metric label="Info. gain" value={proposal.expected_information_gain} />
                  <Metric label="Relative cost" value={proposal.relative_cost} />
                </dl>

                <ul className="list-inside list-disc text-xs text-[var(--faint)]">
                  {proposal.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--faint)]">{label}</dt>
      <dd className="font-mono text-sm">{value.toFixed(2)}</dd>
    </div>
  );
}
