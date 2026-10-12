# Architecture

## Target pipeline

```
NASA OSDR / GeneLab / HRP evidence reports
        |
        v
Ingestion + provenance layer
        |
        v
Normalization + scientific feature store
        |
   +----+-----------------+
   |                      |
   v                      v
Evidence causal graph   Risk & simulation engine
   |                      |
   +----------+-----------+
              |
              v
Research Navigator + Debate Chamber
              |
              v
FastAPI API  ->  Next.js interactive UI
```

## Stack

| Layer | Technology | Version installed and tested (2026-09-19) |
|---|---|---|
| Frontend | Next.js, TypeScript (strict), Tailwind CSS | Next.js 16.3.5, React 19.2.8, Tailwind 4.3.3, TypeScript 5.9.3 |
| Backend | Python, FastAPI, Pydantic | Python 3.12.3, FastAPI 0.141.1, Pydantic 2.13.5 |
| Data | NumPy, Pandas, SciPy | 2.5.3, 3.0.6, 1.18.1 |
| Graph | NetworkX (MVP) | 3.6.1 |
| Database | PostgreSQL (SQLite allowed for local demos) | postgres:17-alpine image (not yet exercised) |
| Tests | pytest | 9.1.1 |
| Infra | Docker Compose | not yet exercised (see reproducibility.md) |

Not used in the MVP, by design: Neo4j, PyTorch Geometric, Kafka, Kubernetes, deep learning.

## Implementation status

| Component | Status |
|---|---|
| Monorepo, config, Dockerfiles, compose | Done (Step 0) |
| API: `/health`, CORS, OpenAPI with mandatory notices | Done (Step 0) |
| Domain schemas (`app/schemas/`): MissionConfig, CrewProfile, DailyExposure, CountermeasurePlan, SimulationEvent, DailyCrewState, RiskResult, EvidenceRecord, CausalNode, CausalEdge, ExperimentProposal, AgentRecommendation, DebateResult | Done (Step 1) |
| Ares-180 seed (`app/domain/ares180_seed.py`, `scripts/seed_ares180.py`) — mission, 4 crew profiles, 4 events, 720 daily-exposure rows, deterministic | Done (Step 2) |
| Daily simulation engine (`app/services/simulation_engine.py`, `scripts/run_ares180_simulation.py`) — per-crew, per-day risk trajectories with explained drivers | Done (Step 3) |
| API (`app/api/`): `GET /api/v1/missions/{mission_id}`, `POST /api/v1/simulations/run` — with vulnerability-window detection, 404s for unknown missions, and full OpenAPI docs | Done (Step 4) |
| Counterfactual engine (`app/services/counterfactual.py`) + `POST /api/v1/counterfactual/compare` — A/B/C EVA decision comparison, full re-runs of the engine per alternative | Done (Step 5) |
| Evidence causal graph (`app/domain/evidence_graph.py`, NetworkX) + `GET /api/v1/evidence/graph` (Cytoscape.js JSON) | Done (Step 6) |
| Dataset ingestion (`app/services/ingestion.py`, `app/services/provenance.py`, `scripts/ingest_osdr.py`) — column-pattern-based DEG parsing, provenance tied to the evidence registry | Done (Step 7) |
| Research Navigator (`app/domain/research_navigator.py`) + `GET /api/v1/research-navigator/rankings` — ranked hypothetical experiment proposals, with a notebook showing the real computed ranking | Done (Step 8) |
| Debate Chamber (`app/services/debate.py`) + `GET /api/v1/debate/ares-180` — 4 deterministic role perspectives on the real day-145 EVA comparison | Done (Step 9) |
| Persistence | Planned |
| Frontend (`frontend/app/`) — Mission, Simulation, EVA Decision, Evidence Graph and Research Navigator pages, all consuming the real API | Functional, basic styling (ahead of Steps 10-13) |
| Dedicated visual system, polish, final report | Planned (Steps 10-13) |

### The evidence registry (Step 1)

`app/core/evidence_registry.py` is a short, hand-maintained list of sources
this project has actually verified (matches `docs/data-sources.md`). Two
schemas enforce it at validation time, not just in documentation:

- `EvidenceRecord` (source_type `nasa_dataset`/`nasa_report`) must give a
  `dataset_id` or `source_url` that starts with a registered key.
- `CausalEdge` (evidence_level `supported_evidence`/`data_supported_association`)
  must give an `evidence_reference` that starts with a registered key.

Anything not in the registry can still be modelled, but only as
`exploratory_hypothesis` or `synthetic_parameter` — which carry no
real-evidence claim and are not checked against it. When a later step
verifies a new source, add it to **both** `docs/data-sources.md` and the
registry in the same change; do not add a registry key "ahead of" actually
checking the source.

### The Ares-180 seed (Step 2)

`app/domain/ares180_seed.py` builds the scenario in memory (as validated
Pydantic objects), and `app/domain/ares180_seed_io.py` serializes it to the
four files under `data/synthetic/`. `scripts/seed_ares180.py` is a thin CLI
over that logic.

Two kinds of numbers appear in the seed, and the module's comments mark
which is which: values copied from the project's own specification
documents (crew baselines, event definitions, mission duration/comm delay),
and values this seed itself had to decide because the specification never
fixed them (the day-to-day exposure formula; which crew member was
originally assigned the day-145 EVA — this seed picks Atlas, documented in
code as a scenario-authoring choice, not a specification fact).

Determinism is load-bearing, not incidental: `build_daily_exposures` uses a
single seeded `random.Random`, consumed in a fixed order, so the same code
always produces byte-identical JSON. `tests/test_ares180_seed.py` checks
this directly, and `docs/reproducibility.md` records that two independent
runs of the CLI were diffed and found identical.

### The simulation engine (Step 3)

`app/services/simulation_engine.py` turns a mission's daily exposures into
per-crew, per-day `RiskResult`s. See `docs/methodology.md`, "Simulation
engine formulas", for the exact update rules, the chosen `operational_risk`
formula (one canonical formula, resolving the specification's three
conflicting versions), and a calibration note: the first version of the
rate constants made two state variables saturate roughly 100 days too
early, silently hiding the day-143 radiation storm's effect. That was only
caught by running the engine over the real Ares-180 seed and inspecting
the trajectory — a reminder that this project's unit tests check properties
(bounded, monotonic, disclaimer present), not "does the number look right",
and both kinds of check are needed.

### The API (Step 4)

`app/api/missions.py` and `app/api/simulations.py` expose the seed and the
engine over HTTP: `GET /api/v1/missions/{mission_id}` returns a scenario
(only `ares-180` exists — `app/domain/mission_catalog.py` is where a second
scenario would be registered), and `POST /api/v1/simulations/run` runs the
engine and adds one piece of aggregation the engine itself doesn't do:
`app/services/vulnerability.py` groups consecutive high/critical days per
crew member into named vulnerability windows, with their most frequent
risk drivers. Both routes 404 cleanly on an unknown `mission_id`, and the
run endpoint returns 500 (not a raw traceback) if the engine ever raises —
defensive, since the seed data should never actually trigger this.

### The counterfactual engine (Step 5)

`app/services/counterfactual.py` compares the three EVA-decision
alternatives (spec section 12) by fully re-running the Step-3 engine per
alternative — not by adjusting the baseline trajectory after the fact. See
`docs/methodology.md`, "Counterfactual engine", for the exact formulas and
comparison window.

Worth reading in full: the module's docstring documents a genuine finding
from running it on the real numbers — alternative B ("delay 10 days") does
not reduce peak operational risk the way the specification's own
illustrative example assumes, because the delay lands the EVA immediately
after the exercise-module failure ends, when the crew's musculoskeletal
recovery is at its lowest. This was kept as-is, not adjusted to match the
assumption (see reconciliation issue #12) — the specification's own event
timing forces this outcome, and it is a better demonstration of the
simulator actually modelling something than a result engineered to match
expectations would be.

### The evidence graph (Step 6)

`app/domain/evidence_graph.py` builds the causal graph with NetworkX and
`app/services/evidence_graph_service.py` converts it to Cytoscape.js JSON
for `GET /api/v1/evidence/graph`. See `docs/methodology.md`, "Evidence
graph", for the node/edge counts and evidence-level breakdown.

Worth reading in full: this graph is smaller than the specification's own
example (which cited sources — GLDS-473/388, and the original
`Evidence/reports/Bone.pdf`/`CV.pdf` files — this project could never
open). `CausalEdge`'s registry check (Step 1) enforces at construction
time that an edge cannot claim real evidence without a verified source. A
second, targeted search pass specifically for concrete accessible NASA
sources (rather than the blocked legacy PDFs) found real backing for the
bone, muscle and EVA edges via `nasa.gov/directorates/esdmd/hhp/`
reference pages, raising the real-evidence count from 5 to 8 of 12 edges;
the remaining 4 stay honestly labelled `exploratory_hypothesis` rather
than being stretched to match the specification's unearned citations.

### Dataset ingestion (Step 7)

`app/services/ingestion.py` reads a processed differential-expression CSV
(the kind GeneLab/OSDR publishes), detects its gene-ID/log2FC/p-value/
adjusted-p-value columns **by name pattern**, not a hardcoded literal
header, validates types, filters DEGs, and produces a small deterministic
summary. `app/services/provenance.py` wraps `EvidenceRecord` construction
so every ingested dataset's source/URL/organism/tissue/condition/
limitations are registered the same way, and rejected the same way (via
the Step-1 evidence registry) if the `dataset_id` isn't actually verified.
`scripts/ingest_osdr.py` is the CLI, and never downloads or ingests
anything without an explicit `--input` or `--url` from the person running
it.

Honesty note: this project has still never obtained OSD-720/GLDS-699's
actual processed files (the OSDR file browser needs manual interaction
this project's tooling can't do — see `docs/data-sources.md`). The
pipeline is tested against `tests/fixtures/synthetic_test_fixture_differential_expression.csv`,
which mimics GeneLab's real column-naming convention (confirmed from a
different, real dataset's file listing, and cross-checked against Ray et
al. 2019's description of the platform) but contains entirely fabricated
gene IDs and values, clearly marked as such. The pipeline is built and
ready to run against the real file the moment someone downloads it.

This step also deliberately does **not** implement the specification's
gene-to-pathway categorisation (inflammatory/DNA-damage/bone/muscle by
substring match) — that was flagged as unreliable in reconciliation issue
#4 and requires a real gene-mapping resource this project hasn't verified.
Turning ingested DEGs into a causal-graph edge stays a separate,
human-reviewed step, same as every edge already in `evidence_graph.py`.

### The Research Navigator (Step 8)

`app/domain/research_navigator.py` turns gaps already visible in the
evidence graph (Step 6) into three hypothetical follow-up experiment
proposals (`ExperimentProposal`, Step 1's schema): radiation+sleep+
cognition, microgravity+muscle+bone, and isolation+circadian+performance.
Each proposal names the specific exploratory_hypothesis edge it would
help resolve and states explicitly, in its own `limitations`, that it is
not a funded or NASA-endorsed study.

`priority` is never a number this module sets directly — it is the
schema's own `computed_field`
(`mission_impact * uncertainty * expected_information_gain / relative_cost`,
reconciliation issue #7), so a proposal's displayed priority can never
disagree with its own inputs. `rank_research_proposals()` sorts
descending by that computed value, with ties broken by `id` for a fully
deterministic order — verified by actually running it twice and diffing
the two orderings in the test suite, not assumed.

`GET /api/v1/research-navigator/rankings` exposes this, along with the
exact formula text and a language note repeating that these are this
project's own hypothetical proposals. `notebooks/04_research_navigator.ipynb`
shows the real ranking end to end: every number in its outputs (the
per-proposal inputs, the ranked list, and the bar chart) was produced by
actually importing and calling this module — hand-assembled as nbformat
JSON, since no Jupyter kernel is available in this build environment, but
with genuinely executed output, not typed-in placeholders.

### The Debate Chamber (Step 9)

`app/services/debate.py` derives four deterministic, auditable perspectives on the real day-145
EVA counterfactual comparison (Step 5) -- **not an LLM roleplay**. Each non-skeptic role applies
one fixed, named formula over the same three real `AlternativeComparison` results:

| Role | Formula | Framing |
|---|---|---|
| `mission_commander` | `eva_completion_probability - peak_operational_risk` | Mission success |
| `flight_surgeon` | `-(0.5*peak_cognitive_risk + 0.5*peak_musculoskeletal_risk)` | Crew health only, ignores completion |
| `science_officer` | `eva_completion_probability - mean_uncertainty` | Data quality / usable outcome |

The `skeptic` role never recommends an alternative (enforced by `AgentRecommendation`'s own
validator, Step 1) and instead names a **real, computed** caveat: it checks every tracked metric
against the roles' consensus pick and reports the first metric where the consensus pick does not
actually win, with the real numbers, rather than a generic disclaimer.

On the real Ares-180 numbers, all three non-skeptic roles land on alternative C -- a genuine
finding, not a coincidence of similar formulas, since each formula weighs a different subset of
the same five metrics. Building this module is also what caught a real overstatement in Step 5's
own documentation: its docstring claimed C wins "on every metric", but C does not have the lowest
`peak_musculoskeletal_risk` (B does, 0.561 vs C's 0.594, because C's reassigned crew member trades
a cognitive vulnerability for a musculoskeletal one). That docstring, `docs/methodology.md`'s
reconciliation log (issue #12), and `tests/test_counterfactual.py`'s docstring were all corrected
in the same step this was found, with a new regression test
(`test_reassign_and_recovery_is_not_better_on_every_metric`) pinning the real numbers so the
overstatement cannot silently return. The skeptic role's whole first branch exists specifically to
surface findings like this one automatically, going forward.

`GET /api/v1/debate/ares-180` exposes the result; `frontend/app/debate/page.tsx` renders all four
roles' cards with their real utility, confidence and justification text.

### The frontend (ahead of schedule, requested out of order)

Originally the frontend was deferred until Steps 10-13, after the backend was solid. At the
user's request, a functional (not yet fully designed) frontend was built early so the project
is a real, clickable site rather than just an API:

- `app/page.tsx` — mission overview: destination, duration, crew cards, scripted events. Server
  component, fetches `GET /api/v1/missions/ares-180` directly.
- `app/simulation/page.tsx` — client component; a button runs `POST /api/v1/simulations/run` and
  renders the real per-crew operational-risk trajectory (a hand-written inline-SVG line chart,
  `components/RiskTrendChart.tsx` — no charting library dependency), the real band-day counts, and
  the real vulnerability windows.
- `app/counterfactual/page.tsx` — client component; a button runs `POST /api/v1/counterfactual/compare`
  and renders the real A/B/C comparison table, including the honestly-reported finding that B does
  not beat A on peak risk (reconciliation issue #12).
- `app/evidence/page.tsx` — fetches `GET /api/v1/evidence/graph` and renders it two ways: a
  deterministic inline-SVG diagram (`components/EvidenceGraphDiagram.tsx`, nodes positioned purely
  by category, not a hand-placed picture of this specific graph) and a full edge-by-edge list with
  evidence-level badges, references and limitations.
- `app/research-navigator/page.tsx` — fetches `GET /api/v1/research-navigator/rankings` and
  renders the real ranked proposals with their real computed priority and inputs.

Every number on every page comes from a real `fetch()` call to the backend (`lib/api.ts`), with
`cache: "no-store"` so nothing is ever served stale; there is no mock data path. `types/api.ts` is a
hand-maintained mirror of the backend's Pydantic response shapes (not code-generated), kept in sync
by hand when a backend schema changes. Verified: `npm run lint` clean, `tsc --noEmit` clean,
`npm run build` succeeds, and a real `uvicorn` + `next start` pair was booted together and every
page's HTML was inspected via `curl` to confirm it contains the actual values the backend computed
(crew names, evidence-level counts, the three research proposals' real priorities), not placeholder
markup — see `docs/reproducibility.md`.

### Visual design system + scenario imagery (Steps 11-13)

The frontend runs a single, fixed dark "deep space" theme (`frontend/app/globals.css`) instead of a
light/dark toggle — CSS custom properties for color, a `panel`/`panel-interactive` surface system
with hover elevation, a `hero-backdrop` component (nebula gradients + scrim) used for every page
header, a consistent `eyebrow` + `display-title` heading pattern, and `.btn-primary`/`.btn-ghost`
buttons. `prefers-reduced-motion` disables the entrance and starfield animations.

Every page header is illustrated with an AI-generated concept-art image of what that scenario might
look like (a Mars-transit habitat, an EVA, crew sleep quarters, the Debate Chamber, the spacecraft
itself) — `frontend/lib/scenario-images.ts`. These are **synthetic illustrations, not real NASA
photography**, and every one of them is labelled as such directly on the image
(`<ScenarioCaption />`, `components/Banner.tsx`) — the same "nothing is presented as real unless it
is verified" rule the rest of this project applies to data and evidence, applied to imagery too.

**What this is not**: the images are currently hotlinked to the CDN they were generated on
(Higgsfield), because this build environment's outbound network policy blocks downloading from that
host into the repository. For a fully self-hosted / offline-capable build, download the five URLs
listed in `scenario-images.ts`, save them under `frontend/public/images/`, and switch each path in
that file from the CDN URL to `/images/<name>.jpg`. Until that's done, those five images require the
viewer's browser to reach that CDN — everything else in the app still works with zero external
dependency.

### One-command local start (`run.sh`)

`run.sh` at the repo root sets up and starts both the backend and frontend
with a single command, no Docker required — see `docs/reproducibility.md`
for exactly what was verified (cold start, warm start, and a clean
`Ctrl+C` shutdown with no leftover processes, checked with `ps aux` rather
than assumed). It deliberately avoids `lsof` (not guaranteed to be on
every machine, and not on this project's own build environment) in favor
of capturing the backend's real PID directly via bash's `$!`.

## Repository layout

See the tree in the root `README.md`. Backend code is layered: `api/` (routes), `schemas/` (Pydantic),
`services/` (use cases), `domain/` (pure logic), `repositories/` (persistence), `core/` (config, notices).
