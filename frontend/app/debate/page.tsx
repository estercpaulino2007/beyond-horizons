import { ApiError, getDebate } from "@/lib/api";
import { DisclaimerBanner, ErrorBanner, ScenarioCaption } from "@/components/Banner";
import type { DebateRole } from "@/types/api";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";

const ROLE_LABELS: Record<DebateRole, string> = {
  mission_commander: "Mission Commander",
  flight_surgeon: "Flight Surgeon",
  science_officer: "Science Officer",
  skeptic: "Skeptic",
};

const ROLE_FRAMING: Record<DebateRole, string> = {
  mission_commander: "Mission success: completion probability vs. peak operational risk.",
  flight_surgeon: "Crew health only: ignores mission completion entirely.",
  science_officer: "Data quality: completion probability vs. shared uncertainty.",
  skeptic: "Never recommends — names a real caveat in the other roles' consensus.",
};

export default async function DebatePage() {
  let data;
  let error: string | null = null;
  try {
    data = await getDebate();
  } catch (e) {
    error = e instanceof ApiError ? e.message : "Unknown error.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-8 flex min-h-[220px] flex-col justify-end px-6 py-8 sm:px-10"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.debateChamber})` }}
      >
        <HudFrame />
        <ScenarioCaption text="Debate Chamber · four mission roles · synthetic illustration, not a real mission photo" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Four roles, one decision</p>
          <h1 className="display-title mt-1 text-2xl sm:text-3xl">Debate Chamber — day-145 EVA decision</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Four deterministic perspectives on the same real counterfactual comparison — not an
            LLM roleplay. Each role applies one fixed, named formula; the skeptic never
            recommends, only critiques.
          </p>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && (
        <div className="space-y-6">
          <DisclaimerBanner text={data.disclaimer} />

          {data.disagreement_summary ? (
            <p className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm">
              <strong className="font-semibold">The roles disagree:</strong> {data.disagreement_summary}
            </p>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm">
              <strong className="font-semibold">Consensus.</strong> Every recommending role picked the
              same alternative — see the skeptic&apos;s card below for the caveat that still applies.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.recommendations.map((rec) => (
              <div key={rec.role} className="panel panel-interactive p-6">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{ROLE_LABELS[rec.role]}</h2>
                  {rec.recommendation && (
                    <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-0.5 text-sm font-medium text-[var(--accent)]">
                      recommends {rec.recommendation}
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs italic text-[var(--faint)]">{ROLE_FRAMING[rec.role]}</p>

                {rec.utility !== null && (
                  <p className="mb-2 font-mono text-sm">
                    utility <span className="font-semibold">{rec.utility.toFixed(3)}</span>
                    {rec.confidence !== null && (
                      <span className="text-[var(--faint)]"> · confidence {rec.confidence.toFixed(3)}</span>
                    )}
                  </p>
                )}

                <p className="mb-3 text-sm text-[var(--foreground)]/80">{rec.justification}</p>

                <ul className="list-inside list-disc text-xs text-[var(--faint)]">
                  {rec.limitations.map((l) => (
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
