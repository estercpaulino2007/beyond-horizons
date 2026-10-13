"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, getMission } from "@/lib/api";
import { ErrorBanner, SyntheticDataBanner, ScenarioCaption, CustomScenarioBanner } from "@/components/Banner";
import { SCENARIO_IMAGES } from "@/lib/scenario-images";
import HudFrame from "@/components/HudFrame";
import HeroCelestial from "@/components/HeroCelestial";
import RealEvidenceStrip from "@/components/RealEvidenceStrip";
import { useCustomScenario } from "@/lib/useCustomScenario";
import type { CrewProfile, MissionConfig, MissionResponse } from "@/types/api";

const DESTINATION_LABELS: Record<string, string> = {
  low_earth_orbit: "Low Earth Orbit",
  lunar_orbital: "Lunar Orbital",
  lunar_orbital_surface: "Lunar Orbital + Surface",
  mars_transit: "Mars Transit",
  mars_surface: "Mars Surface",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  radiation_storm: "Radiation storm",
  equipment_failure: "Equipment failure",
  communication_delay: "Communication delay",
  eva: "EVA",
  other: "Other",
};

export default function Home() {
  const [data, setData] = useState<MissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { scenario, reset } = useCustomScenario();

  useEffect(() => {
    getMission()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Unknown error."));
  }, []);

  // Scripted events are always the canonical catalog (independent of crew
  // customization); only the mission parameters and crew traits shown below
  // reflect a customized scenario, mirroring exactly what was simulated
  // (see lib/scenarioStore.ts).
  const mission: MissionConfig | undefined = scenario?.mission ?? data?.mission;
  const crewProfiles: CrewProfile[] | undefined = scenario?.crew_profiles ?? data?.crew_profiles;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <section
        className="hero-backdrop enter mb-10 flex min-h-[420px] flex-col justify-end px-6 py-10 sm:px-10 sm:py-14"
        style={{ backgroundImage: `url(${SCENARIO_IMAGES.heroHabitat})` }}
      >
        <HudFrame />
        <HeroCelestial
          textureSrc="/textures/moon_1024.jpg"
          size={120}
          glowColor="#c9d4e8"
          top="12%"
          right="8%"
        />
        <ScenarioCaption text="Ares-180 habitat, days 1–180 · synthetic illustration, not a real mission photo" />
        <div className="hero-content max-w-2xl">
          <p className="eyebrow">Health monitoring software for astronauts</p>
          <h1 className="display-title mt-2 text-4xl sm:text-5xl">Beyond Horizons</h1>
          <p className="mt-4 max-w-xl text-base text-[var(--muted)] sm:text-lg">
            Track your own cardiac, respiratory, sleep, activity and hydration vitals, then see how
            spaceflight stressors act on them in an explainable, evidence-backed simulation — with
            every conclusion showing its evidence, uncertainty and limits. Ares-180 below is one
            illustrative 180-day Mars-transit scenario, not the point of the app.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/vitals" className="btn-primary">
              Record my vitals →
            </Link>
            <Link href="/simulation" className="btn-ghost">
              Run a health simulation
            </Link>
            <Link href="/debate" className="btn-ghost">
              See the Debate Chamber
            </Link>
          </div>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {data && mission && crewProfiles && (
        <div className="space-y-8">
          <div className="enter flex flex-col gap-3">
            <SyntheticDataBanner text={data.synthetic_data_notice} />
            {scenario && <CustomScenarioBanner savedAt={scenario.saved_at} onReset={reset} />}
          </div>

          <RealEvidenceStrip />

          <div className="enter flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--faint)]">
              Example scenario
            </h2>
            <p className="text-xs text-[var(--faint)]">
              One illustrative simulation — not the only way to use this app. Prefer your own numbers?{" "}
              <Link href="/vitals" className="underline">
                Go to My Vitals
              </Link>
              .
            </p>
          </div>

          <section className="panel enter enter-delay-1 p-6">
            <h2 className="text-lg font-semibold">{mission.mission_name}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Destination" value={DESTINATION_LABELS[mission.destination] ?? mission.destination} />
              <Stat label="Duration" value={`${mission.duration_days} days`} />
              <Stat label="Crew size" value={String(mission.crew_size)} />
              <Stat
                label="Comm. delay"
                value={`${mission.communication_delay_minutes} min`}
              />
            </dl>
          </section>

          <section className="enter enter-delay-2">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Crew</h2>
              <p className="text-xs text-[var(--faint)]">
                Four fixed synthetic archetypes by default — on{" "}
                <Link href="/simulation" className="underline">
                  Simulation
                </Link>
                , customize any slot, including seeding one from your own vitals.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {crewProfiles.map((crew) => (
                <div key={crew.id} className="panel panel-interactive flex flex-col gap-2 p-5">
                  <div>
                    <p className="font-semibold">{crew.display_name}</p>
                    <p className="text-sm text-[var(--muted)]">{crew.role}</p>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">Primary vulnerability:</span>{" "}
                    {crew.primary_vulnerability}
                  </p>
                  {crew.characteristics.length > 0 && (
                    <ul className="list-inside list-disc text-xs text-[var(--faint)]">
                      {crew.characteristics.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="enter enter-delay-2">
            <h2 className="mb-3 text-lg font-semibold">Scripted mission events</h2>
            <div className="panel divide-y divide-[var(--border)]">
              {data.events.map((event) => (
                <div key={event.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="shrink-0 font-mono text-xs text-[var(--faint)]">
                    day {event.day_start}
                    {event.day_end !== event.day_start ? `–${event.day_end}` : ""}
                  </span>
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--accent-strong)]">
                    {EVENT_TYPE_LABELS[event.type] ?? event.type}
                  </span>
                  <span className="text-sm text-[var(--foreground)]">{event.description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--faint)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
