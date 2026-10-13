"use client";

/**
 * Lets the user customize crew traits, mission parameters, which scripted
 * events are active, and which countermeasures are applied, before running
 * the simulation engine -- rather than always running the fixed Ares-180
 * seed scenario. Every control here is initialized from the mission's own
 * seed defaults (GET /api/v1/missions/ares-180) and, when touched, is sent
 * as an override in the POST /api/v1/simulations/run request body (see
 * backend/app/domain/scenario_builder.py for how the backend applies it).
 *
 * All of this stays synthetic/exploratory data -- customizing a slider does
 * not turn a value into a measured quantity; see the SyntheticDataBanner
 * shown on both /simulation and here.
 *
 * "Simulate as yourself" (below) lets a crew slot start from the person's
 * own latest My Vitals entry instead of one of the four fixed archetypes --
 * see lib/vitalsToTraits.ts for exactly how, and which traits honestly have
 * no vitals-derived proxy. It only ever seeds; every slider stays manually
 * adjustable afterward, same as any other crew member.
 */
import Link from "next/link";
import { useId, useState } from "react";
import { loadVitalsHistory } from "@/lib/vitalsStore";
import { VITALS_NEUTRAL_TRAITS, vitalsToCrewBaseline } from "@/lib/vitalsToTraits";
import type {
  CountermeasurePlan,
  CrewBaselineOverride,
  CrewProfile,
  Destination,
  MissionResponse,
  SimulationRunRequestBody,
} from "@/types/api";

const TRAIT_FIELDS: { key: keyof CrewBaselineOverride; label: string }[] = [
  { key: "radiation_sensitivity", label: "Radiation sensitivity" },
  { key: "bone_loss_susceptibility", label: "Bone loss susceptibility" },
  { key: "sleep_resilience", label: "Sleep resilience" },
  { key: "muscle_recovery", label: "Muscle recovery" },
  { key: "cognitive_resilience", label: "Cognitive resilience" },
  { key: "inflammatory_baseline", label: "Inflammatory baseline" },
];

const DESTINATION_LABELS: Record<Destination, string> = {
  low_earth_orbit: "Low Earth orbit",
  lunar_orbital: "Lunar orbital",
  lunar_orbital_surface: "Lunar surface",
  mars_transit: "Mars transit",
  mars_surface: "Mars surface",
};

const SURFACE_DESTINATIONS: Destination[] = ["lunar_orbital_surface", "mars_surface"];

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs">
      <span className="flex items-center justify-between text-[var(--muted)]">
        <span>{label}</span>
        <span className="mono-tag">{value.toFixed(2)}</span>
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="hz-range"
      />
    </label>
  );
}

function initialTraits(crew: CrewProfile[]): Record<string, CrewBaselineOverride> {
  return Object.fromEntries(crew.map((c) => [c.id, { ...c.baseline }]));
}

function initialNames(crew: CrewProfile[]): Record<string, string> {
  return Object.fromEntries(crew.map((c) => [c.id, c.display_name]));
}

export default function SimulationCustomizer({
  mission,
  catalog,
  onRun,
  loading,
}: {
  mission: MissionResponse;
  catalog: CountermeasurePlan[];
  onRun: (payload: SimulationRunRequestBody) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [traits, setTraits] = useState(() => initialTraits(mission.crew_profiles));
  const [names, setNames] = useState(() => initialNames(mission.crew_profiles));
  const [destination, setDestination] = useState<Destination>(mission.mission.destination);
  const [durationDays, setDurationDays] = useState(mission.mission.duration_days);
  const [commDelay, setCommDelay] = useState(mission.mission.communication_delay_minutes);
  const [gravity, setGravity] = useState(mission.mission.gravity_g);
  const [activeEventIds, setActiveEventIds] = useState<Set<string>>(
    new Set(mission.events.map((e) => e.id)),
  );
  const [countermeasureIds, setCountermeasureIds] = useState<Set<string>>(new Set());
  const [youCrewId, setYouCrewId] = useState<string | null>(null);
  const [selfSeedCrewId, setSelfSeedCrewId] = useState(mission.crew_profiles[0]?.id ?? "");
  const hasVitals = loadVitalsHistory().length > 0;

  const isSurface = SURFACE_DESTINATIONS.includes(destination);

  function simulateAsYourself() {
    const history = loadVitalsHistory();
    const latest = history[history.length - 1];
    if (!latest || !selfSeedCrewId) return;
    setTraits((prev) => ({ ...prev, [selfSeedCrewId]: vitalsToCrewBaseline(latest.entry) }));
    setYouCrewId(selfSeedCrewId);
  }

  function clearSelf(crewId: string) {
    const original = mission.crew_profiles.find((c) => c.id === crewId);
    if (original) {
      setTraits((prev) => ({ ...prev, [crewId]: { ...original.baseline } }));
    }
    setYouCrewId((prev) => (prev === crewId ? null : prev));
  }

  function resetToDefaults() {
    setTraits(initialTraits(mission.crew_profiles));
    setNames(initialNames(mission.crew_profiles));
    setDestination(mission.mission.destination);
    setDurationDays(mission.mission.duration_days);
    setCommDelay(mission.mission.communication_delay_minutes);
    setGravity(mission.mission.gravity_g);
    setActiveEventIds(new Set(mission.events.map((e) => e.id)));
    setCountermeasureIds(new Set());
    setYouCrewId(null);
  }

  function toggleEvent(id: string) {
    setActiveEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCountermeasure(id: string) {
    setCountermeasureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRun() {
    const payload: SimulationRunRequestBody = {
      mission_id: mission.mission.mission_id,
      countermeasures: catalog.filter((c) => countermeasureIds.has(c.id)),
      crew_overrides: mission.crew_profiles.map((c) => ({
        id: c.id,
        display_name: names[c.id],
        baseline: traits[c.id],
      })),
      mission_overrides: {
        destination,
        duration_days: durationDays,
        communication_delay_minutes: commDelay,
        gravity_g: isSurface ? gravity : undefined,
      },
      active_event_ids: Array.from(activeEventIds),
    };
    onRun(payload);
  }

  return (
    <section className="panel p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-semibold">Customize before running</h2>
          <p className="mt-1 text-xs text-[var(--faint)]">
            Choose crew traits, mission parameters, active events and countermeasures — or leave
            everything as the Ares-180 default and just run it.
          </p>
        </div>
        <span className="btn-ghost shrink-0 text-xs">{open ? "Hide" : "Customize"}</span>
      </button>

      {open && (
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold">Crew</h3>

            <div className="mb-4 rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--background-soft)" }}>
              <p className="mb-2 font-medium">Simulate as yourself</p>
              {hasVitals ? (
                <>
                  <p className="mb-2 text-[var(--faint)]">
                    Seed one crew slot&apos;s sleep, muscle-recovery, cognitive and inflammatory baseline from your
                    latest My Vitals entry — radiation sensitivity and bone-loss susceptibility have no honest vitals
                    proxy, so they stay at a neutral 0.50. Every slider stays adjustable afterward.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selfSeedCrewId}
                      onChange={(e) => setSelfSeedCrewId(e.target.value)}
                      className="hz-input !w-auto"
                    >
                      {mission.crew_profiles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {names[c.id] ?? c.display_name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={simulateAsYourself} className="btn-primary !px-3 !py-1.5 text-xs">
                      Apply my vitals
                    </button>
                    {youCrewId && (
                      <button type="button" onClick={() => clearSelf(youCrewId)} className="btn-ghost !px-2 !py-1.5 text-xs">
                        Clear
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[var(--faint)]">
                  Record a{" "}
                  <Link href="/vitals" className="underline">
                    My Vitals
                  </Link>{" "}
                  entry first to seed a crew slot from your own numbers instead of a fixed archetype.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mission.crew_profiles.map((crew) => (
                <div key={crew.id} className="panel p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <input
                      value={names[crew.id] ?? crew.display_name}
                      onChange={(e) => setNames((prev) => ({ ...prev, [crew.id]: e.target.value }))}
                      className="hz-input w-full font-semibold"
                      maxLength={80}
                    />
                    {youCrewId === crew.id && (
                      <span className="mono-tag shrink-0" style={{ color: "var(--accent)" }}>
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-[var(--faint)]">{crew.role}</p>
                  <div className="space-y-2">
                    {TRAIT_FIELDS.map((field) => (
                      <Slider
                        key={field.key}
                        label={
                          youCrewId === crew.id && VITALS_NEUTRAL_TRAITS.includes(field.key)
                            ? `${field.label} (no vitals proxy)`
                            : field.label
                        }
                        value={traits[crew.id]?.[field.key] ?? crew.baseline[field.key]}
                        onChange={(value) =>
                          setTraits((prev) => ({
                            ...prev,
                            [crew.id]: { ...prev[crew.id], [field.key]: value },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Mission parameters</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Destination
                <select
                  value={destination}
                  onChange={(e) => {
                    const next = e.target.value as Destination;
                    setDestination(next);
                    if (!SURFACE_DESTINATIONS.includes(next)) setGravity(0.0);
                    else if (gravity === 0.0) setGravity(next === "mars_surface" ? 0.38 : 0.166);
                  }}
                  className="hz-input"
                >
                  {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Duration (days)
                <input
                  type="number"
                  min={10}
                  max={1095}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="hz-input"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Comm delay (minutes)
                <input
                  type="number"
                  min={0}
                  max={1200}
                  step={0.5}
                  value={commDelay}
                  onChange={(e) => setCommDelay(Number(e.target.value))}
                  className="hz-input"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Surface gravity (g)
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={gravity}
                  disabled={!isSurface}
                  onChange={(e) => setGravity(Number(e.target.value))}
                  className="hz-input disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Mission events</h3>
            <div className="space-y-2">
              {mission.events.map((event) => (
                <label key={event.id} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={activeEventIds.has(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="hz-checkbox mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{event.description}</span>{" "}
                    <span className="text-[var(--faint)]">
                      (day {event.day_start}
                      {event.day_end !== event.day_start ? `–${event.day_end}` : ""}, {event.severity})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Countermeasures</h3>
            <div className="space-y-2">
              {catalog.map((plan) => (
                <label key={plan.id} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={countermeasureIds.has(plan.id)}
                    onChange={() => toggleCountermeasure(plan.id)}
                    className="hz-checkbox mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{plan.name}</span>{" "}
                    <span className="text-[var(--faint)]">— {plan.description}</span>
                  </span>
                </label>
              ))}
              {catalog.length === 0 && (
                <p className="text-xs text-[var(--faint)]">No countermeasure catalog loaded.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={resetToDefaults} className="btn-ghost text-xs">
              Reset to defaults
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={handleRun} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Running simulation..." : "Run simulation"}
        </button>
      </div>
    </section>
  );
}
