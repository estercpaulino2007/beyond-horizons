# Reproducibility

## Environment used to build and test Step 0
Python 3.12.3, Node 22.22.2, npm 10.9.7, Linux. Dependency versions are pinned in
`backend/requirements*.txt` and `frontend/package-lock.json`.

## Fastest path: `./run.sh`

```bash
./run.sh
```

One command, no Docker required. Verified in this project's build environment:

| Check | Result |
|---|---|
| Cold start (no `.venv`, no `node_modules`) | Backend healthy at `/health` within 30s of starting; frontend serves `/` with HTTP 200 |
| Warm start (caches present) | Ready in ~12s |
| `Ctrl+C` (SIGINT) once | Both the backend (`uvicorn`) and frontend (`next dev`, including its child `next-server`) process are gone afterward — checked with `ps aux`, not assumed |
| Second `Ctrl+C`/duplicate cleanup | Runs the stop logic exactly once (guarded), not twice |

`lsof` is **not** used to find the backend process to stop (it isn't installed in this project's
own build environment, and may not be on every machine either) — the script captures the real
`uvicorn` PID directly via bash's `$!` when it starts the process, which is a hard dependency)
free way to do it.

## Run locally (without Docker), step by step

```bash
# Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload --port 8000     # http://localhost:8000/docs

# Frontend (second terminal)
cd frontend
npm ci
npm run dev                                    # http://localhost:3000
```

## Run with Docker Compose

```bash
cp .env.example .env        # optional: every variable has a default
docker compose up --build   # UI :3000, API :8000, PostgreSQL :5432 (localhost only)
```

## Verification status (what was actually executed)

| Check | Result | Date |
|---|---|---|
| `pytest` (backend) | 160 passed (5 infra + 49 domain-schema + 13 Ares-180 seed + 13 simulation-engine + 10 API + 12 counterfactual + 10 evidence graph + 19 ingestion + 10 research navigator + 11 debate chamber + 4 API debate) | 2026-10-05 |
| Real `uvicorn` boot: `GET /api/v1/debate/ares-180` | 200, 4 roles present, skeptic has `recommendation: null`, real justification text referencing `peak_musculoskeletal_risk` | 2026-10-05 |
| `nbformat.validate()` on `notebooks/04_research_navigator.ipynb` | Valid, no warnings (cell ids present); real executed stdout and a real matplotlib PNG, no hand-typed output | 2026-10-05 |
| Real `uvicorn` boot: `GET /api/v1/research-navigator/rankings` | 200, 3 proposals sorted descending by priority (0.1760 / 0.1750 / 0.1462) | 2026-10-05 |
| Frontend `npm run lint`, `npx tsc --noEmit`, `npm run build` (production, Turbopack) | All clean/OK | 2026-10-05 |
| Real `uvicorn` (port 8000) + real `next start` (port 3000), booted together | Both healthy; `/` 200 | 2026-10-05 |
| `curl`'d every real page's HTML against the live pair above | `/` contains the real crew names (Atlas/Nova/Lyra/Orion) and mission name; `/evidence` contains the real evidence-level badge counts (14 supported_evidence / 6 data_supported_association / 10 exploratory_hypothesis / 2 synthetic_parameter across legend+edges); `/research-navigator` contains the real proposal titles and real priorities (0.1760/0.1750/0.1462); `/simulation` and `/counterfactual` serve their client-side shell correctly (data loads on click, verified against the same live backend) | 2026-10-05 |
| `scripts/seed_ares180.py`, run twice to independent output directories | Byte-identical output (`diff -r` clean, matching MD5 checksums) | 2026-09-22 |
| `scripts/run_ares180_simulation.py` | Ran successfully; wrote `data/processed/ares180_simulation_result.json` (gitignored, derived) | 2026-09-22 |
| Real `uvicorn` boot: `/docs` 200, `/openapi.json` valid and lists all 5 routes, `GET /api/v1/evidence/graph` 200 with 13 nodes / 12 edges | OK | 2026-09-22 |
| `scripts/ingest_osdr.py`, run against the synthetic test fixture | Succeeds for a registered `dataset_id` (6/10 DEGs detected); fails cleanly (no raw traceback, exit 1) for an unregistered one | 2026-09-24 |
| `pip check` | no broken requirements | 2026-09-19 |
| Real `uvicorn` boot: `/health` 200, `/docs` 200, CORS allows only local frontend origins | OK | 2026-09-19 |
| `npm run lint` | clean | 2026-09-19 |
| `tsc --noEmit` | clean | 2026-09-19 |
| `npm run build` (production) | OK | 2026-09-19 |
| Standalone server (`node server.js`) after copying `public` and `.next/static`, as the Dockerfile does | `/` 200, unknown route 404 | 2026-09-19 |
| `docker compose up --build` and both Dockerfile builds | **NOT executed** — Docker was unavailable in the authoring environment. The compose file was checked only for valid YAML and existing build contexts. | — |

If the Docker path fails on your machine, report the error; do not assume it works.

## Data
No real dataset is downloaded automatically. Real data is added only from a URL or file provided by a
person (Step 7) and registered in `docs/data-sources.md`.

The synthetic Ares-180 scenario under `data/synthetic/` **is committed to the repository** (per the
project's file layout: `raw/` is gitignored, `synthetic/` is versioned) so a clone works without running
anything first. It is also fully reproducible on demand:

```bash
cd backend && source .venv/bin/activate   # or however you installed backend/requirements-dev.txt
python ../scripts/seed_ares180.py         # regenerates data/synthetic/*.json
```

Re-running it always reproduces the same four files, byte-for-byte (see the verification table above) —
so if you ever edit `app/domain/ares180_seed.py`, re-run the script and commit the regenerated files
together with the code change, rather than hand-editing the JSON.
