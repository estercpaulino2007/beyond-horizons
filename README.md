# Beyond Horizons

*Beyond data. Toward safer human exploration.*

An explainable **crew digital twin** for exploratory space-health simulation, built for the NASA Space Apps
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

> **Disclaimer.** Beyond Horizons is an educational and research demonstration platform. It uses synthetic
> crew profiles and simulated scenarios. It does not provide medical advice and should not be used for real
> mission planning or health decisions. It is an exploratory simulator, not a diagnosis tool, and it does not
> replace a flight surgeon.
>
> **Synthetic data notice.** The crew profiles, conditions and events in this mission are synthetic and were
> created for educational purposes and exploratory simulation. They do not represent real astronauts and are not
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
(`.celestial-*` in `globals.css`) have no dependency on the image-generation budget. **No persistence
layer exists yet** (Step 10, not built in this pass). See `docs/architecture.md` for exactly what is
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
