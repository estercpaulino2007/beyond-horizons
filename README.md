# Beyond Horizons

*Beyond data. Toward safer human exploration.*

An explainable **crew digital twin** for exploratory space-health simulation, built for the NASA Space Apps
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

> **Disclaimer.** Beyond Horizons is an astronaut health-monitoring and mission-simulation platform (research prototype). It uses synthetic
> crew profiles and simulated scenarios. It does not provide medical advice and should not be used for real
> mission planning or health decisions. It is an exploratory simulator, not a diagnosis tool, and it does not
> replace a flight surgeon.
>
> **Synthetic data notice.** The crew profiles, conditions and events in this mission are synthetic and were
> created for mission simulation and research. They do not represent real astronauts and are not
> medical advice.

## What it is meant to do

Given a synthetic 180-day Mars-transit mission (**Ares-180**), the software will:

1. simulate the daily evolution of physiological and operational risk for four synthetic crew profiles;
2. compare counterfactual decisions for a critical EVA (keep, delay, or reassign with sleep recovery);
3. show an evidence graph that separates NASA-supported evidence, data associations, hypotheses and
   synthetic parameters;
4. rank hypothetical experiments by which scientific gap most limits confidence in the decision;
5. present an auditable debate between mission roles with conflicting objectives.

Every conclusion is meant to show its **evidence, uncertainty and limitations**. Real NASA data, data-derived
associations, exploratory hypotheses and synthetic parameters are always labelled differently.

## 3D Health HUD (`/hud`)

A holographic mission-control view of the same platform, built as a standalone three.js page in
`frontend/public/hud3d/` and opened from the **3D Health HUD** item in the nav (`frontend/app/hud/page.tsx`).

- **Astronaut mode / Scan mode** -- the suit turns into a translucent hologram and the body scan reveals
  skeleton, vessels, lungs, heart, abdominal organs and brain. Systems in *watch* or *alert* glow amber/red
  and are labelled on the model. Drag to rotate, scroll to zoom, right-drag to move, double-click to reset.
- **Health scenarios** (keys 1-8): nominal, hypoxia, cardiac arrhythmia, solar particle event, heat stress,
  bone-density loss, SANS, and **My vitals** (your own latest reading, evaluated by this API).
- **Tabs linked to this API**: My Vitals (`POST /api/v1/vitals/evaluate`), Crew Risk
  (`POST /api/v1/simulations/run` + countermeasure catalog), EVA Decision (counterfactual + Debate Chamber),
  Research (evidence graph + Research Navigator), Genetics (published gene-expression table).
- **Shared history** -- the HUD writes the same `beyond-horizons:vitals-history` localStorage records as the
  My Vitals page, so both show one history on the same domain. Completed body scans are logged too, and the
  history can be exported/imported as JSON.
- **Beyond AI** -- the in-app assistant (`/api/v1/assistant/ask`), grounded in the platform's data, your latest
  saved vitals and the current scan.
- **Customization** -- edit the astronaut's name, mission ID, phase, crew size and elapsed time (click the header), and create, edit and delete your own health scenarios (vitals, habitat environment, body and habitat system statuses, AI insight and actions) that run a full body scan on the hologram.
- **Genetics simulator** -- pick a situation (ISS, one year in space, Mars transit), days, solar event, storm shelter and vitamin A; see the NASA-measured dose, the cancer-risk estimate, the published NAG9-1024 gene changes and the consequences NASA found, with the affected markers lit up on the 3D DNA.
- **Opens on the 3D HUD** -- the site's home page (`/`) now opens the 3D Health HUD directly; the earlier pages (/simulation, /vitals, /genetics, /evidence, ...) stay at their own addresses.
- **Customizable Crew Risk** -- rename the crew, set their six baseline traits (sent as `crew_overrides`), and switch the scripted events on/off (`active_event_ids`) before running the simulation.
- **Mission control** -- the MISSION tab follows a profile day by day (ship position, dose so far, career total vs NASA's 600 mSv limit, timeline of Ares-180 events), shared with the genetics simulator.
- **Beating 3D heart** next to the lungs in Biometrics, and in the body scan.
- **Explorable 3D views** -- drag/scroll the ISS interior (photogrammetry), lungs, DNA and Earth-Mars transit views.
- **Offline snapshot** -- if the API is asleep, the HUD falls back to `data/snapshot.json`, a stored copy of this API's real outputs for the deterministic Ares-180 seed, and says so on screen.
- **NASA SOURCES** -- every threshold, rate and dataset the HUD relies on is tagged with a clickable source
  (NASA-STD-3001 CO2 / atmosphere / ECLSS limits, ISS dose rate, MSL RAD cruise dose, HRP bone, muscle, SANS
  and cardiac-rhythm evidence reports, the NASA Twins Study, OSDR OSD-720, NAG9-1024, LSDA osteoblast data).
  Full list with links: `docs/data-sources.md`.

The HUD reaches the backend through the `/bh-api` rewrite in `frontend/next.config.ts` (same origin, no extra
CORS). Mission readings on the HUD are simulated and labelled **SIMULATED**; the references set the limits,
rates and evidence behind them.

## Current status: Steps 0-9 + visual design system (Steps 11-13)

Implemented: everything from Steps 0-7 (monorepo, domain schemas, the deterministic Ares-180 seed, the
daily simulation engine, the missions/simulations/counterfactual/evidence API, and the dataset-ingestion
pipeline), plus the **Research Navigator**
(`backend/app/domain/research_navigator.py` + `GET /api/v1/research-navigator/rankings`): three
hypothetical follow-up experiments, each tied to a specific gap already visible in the evidence graph,
ranked by a transparent, schema-computed priority formula
(`mission_impact * uncertainty * expected_information_gain / relative_cost`). Every proposal states its own
limitations and is explicit that it is not a funded or NASA-endorsed study.
`notebooks/04_research_navigator.ipynb` shows the real computed ranking end to end, including a real
matplotlib chart.

The **Debate Chamber** (`backend/app/services/debate.py` + `GET /api/v1/debate/ares-180`) is also
implemented: four deterministic, auditable role perspectives on the real day-145 EVA decision
(mission commander, flight surgeon, science officer, and a skeptic who never recommends but always
names a real caveat) — not an LLM roleplay, each role applies one fixed, named formula. Building it
caught and fixed a real overstatement in Step 5's own documentation (see `docs/methodology.md`,
reconciliation issue #12).

The **frontend is a real, working site** (`frontend/app/`) with a dedicated visual design system
(Steps 11-13 — see `docs/architecture.md`): Mission overview, Simulation, EVA Decision, Debate
Chamber, Evidence Graph and Research Navigator pages, every one of them consuming the live API — no
mock data — each with an AI-generated scenario illustration in its header, always labelled as
synthetic, never as a real photo. A manual light/dark theme toggle (top right of the nav,
`components/ThemeToggle.tsx`) switches the whole design-token system; decorative CSS stars/moon/Mars
(`.celestial-*` in `globals.css`) have no dependency on the image-generation budget. **No server-side persistence
layer exists yet** (Step 10); history is kept per browser in localStorage. See `docs/architecture.md` for exactly what is
and isn't implemented, including a note on the scenario images' hosting.

An **in-app assistant** (the chat bubble, bottom right, `components/AssistantWidget.tsx` +
`POST /api/v1/assistant/ask`) lets you ask questions about the mission, crew and evidence graph.
It answers only from this project's own data and keeps the same synthetic/evidence-level labelling
as the rest of the app. It is **bring-your-own-key**: this project does not bundle or pay for an
API key, so the widget stays honestly "not configured" until you set `ASSISTANT_API_KEY` yourself
(see `.env.example`) — everything else works normally without it.

## Repository layout

```
beyond-horizons/
├── backend/        FastAPI + Pydantic (app/{api,core,schemas,services,domain,repositories}, tests/)
├── frontend/       Next.js + TypeScript + Tailwind (app/, components/, lib/, types/)
├── data/           raw/ (gitignored), processed/, synthetic/ (versioned)
├── docs/           architecture, data-sources, methodology, limitations, reproducibility, transparency
├── notebooks/      analysis notebooks (added in later steps)
├── scripts/        ingestion and seeding scripts (added in later steps)
├── docker-compose.yml
└── .env.example
```

## Quick start

**Fastest way to run it — one command** (needs Python 3.12 and Node 22+ already installed, no Docker required):

```bash
./run.sh
```

This creates the backend virtual environment and installs dependencies on first run (subsequent
runs are fast), starts the API, installs frontend dependencies on first run, and starts the web
UI — printing both URLs when ready. Press Ctrl+C once to stop both cleanly. Verified end to end,
including a cold start with no caches and a Ctrl+C shutdown that leaves no process behind — see
`docs/reproducibility.md`.

**Manual / step-by-step**, if you want to run each piece yourself:

```bash
# Backend (Python 3.12)
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt && pytest
uvicorn app.main:app --reload --port 8000        # API docs: http://localhost:8000/docs

# Frontend (Node 22)
cd frontend && npm ci && npm run dev             # http://localhost:3000

# Or everything with Docker
docker compose up --build
```

Details, versions and verification status: [`docs/reproducibility.md`](docs/reproducibility.md).

## Try the API

Once the backend is running (`http://localhost:8000`):

```bash
# The Ares-180 scenario: mission config, the four synthetic crew members, scripted events
curl http://localhost:8000/api/v1/missions/ares-180

# Run the simulation: per-crew daily risk trajectories, explained drivers, vulnerability windows
curl -X POST http://localhost:8000/api/v1/simulations/run -H "Content-Type: application/json" -d '{}'

# Compare the day-145 EVA decision: maintain / delay 10 days / reassign + recovery
curl -X POST http://localhost:8000/api/v1/counterfactual/compare -H "Content-Type: application/json" -d '{}'

# The evidence causal graph, as Cytoscape.js-compatible JSON
curl http://localhost:8000/api/v1/evidence/graph
```

Full interactive documentation (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs).

## Documentation

- [Architecture](docs/architecture.md)
- [Data sources and provenance](docs/data-sources.md)
- [Methodology and evidence levels](docs/methodology.md)
- [Limitations](docs/limitations.md)
- [Reproducibility](docs/reproducibility.md)
- [Hackathon transparency](docs/hackathon-transparency.md)

## License

MIT — see [LICENSE](LICENSE).
