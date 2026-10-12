const SOURCES = [
  {
    tag: "NASA HRP · Verified",
    title: "Risk of Bone Fracture due to Spaceflight-Induced Changes to Bone",
    detail: "Evidence Report, NASA Human Research Program. 1–1.5% bone density loss/month on long-duration missions.",
    href: "https://ntrs.nasa.gov/citations/20170004597",
    citation: "NTRS 20170004597 (2017, updated NTRS 20240005190, 2024)",
  },
  {
    tag: "NASA HRP · Verified",
    title: "Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders",
    detail: "Evidence Report, Human Factors and Behavioral Performance element — backs the sleep-debt → cognitive-load edges.",
    href: "https://ntrs.nasa.gov/citations/20250001454",
    citation: "NTRS 20250001454 (last published 2025-05-13)",
  },
  {
    tag: "GeneLab / OSDR · Verified",
    title: "Sex-specific cardiac transcriptome alteration after simulated GCR + gamma radiation",
    detail: "OSD-720 / GLDS-699, RNA-Seq, mouse left ventricle, NASA Space Radiation Laboratory.",
    href: "https://doi.org/10.1038/s41598-025-89815-2",
    citation: "OSD-720 · DOI 10.1038/s41598-025-89815-2",
  },
] as const;

/**
 * Surfaces, by name and with a real link, the specific NASA / peer-reviewed
 * sources that are actually registered and checked in docs/data-sources.md —
 * as opposed to the project's own synthetic crew, synthetic scenario and
 * simulated physiology, which are not real data and are labelled as such
 * everywhere else in the app. This section exists so "backed by real NASA
 * data" means exactly these citations, not a vague claim.
 */
export default function RealEvidenceStrip() {
  return (
    <section className="panel enter enter-delay-1 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Grounded in real NASA evidence</h2>
        <a href="/evidence" className="mono-tag text-[var(--accent-strong)] hover:underline">
          see every source in the evidence graph →
        </a>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-[var(--muted)]">
        The crew, the 180-day scenario and every simulated score in this app are synthetic — built for
        this demo, not real astronauts. What <em>is</em> real: specific edges in the evidence graph are
        backed by the NASA sources below, each independently verified and cited with a DOI or NTRS ID
        before being allowed to claim &quot;supported evidence&quot; anywhere in the app (enforced in code,
        see <code className="font-mono text-xs">app/core/evidence_registry.py</code>).
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SOURCES.map((s) => (
          <a
            key={s.title}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="panel panel-interactive flex flex-col gap-2 p-4"
          >
            <span className="verified-tag w-fit">{s.tag}</span>
            <p className="text-sm font-semibold leading-snug">{s.title}</p>
            <p className="text-xs text-[var(--muted)]">{s.detail}</p>
            <p className="mono-tag mt-auto">{s.citation}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
