# Beyond Horizons

*Beyond data. Toward safer human exploration.*

An astronaut health-monitoring console and explainable **crew digital twin**, built for the **NASA Space Apps Challenge 2026** challenge *"Create Health Monitoring Software for Astronauts on Space Missions"*. It watches a crew member's vital signs, the habitat environment and long-term spaceflight risks, shows **where in the body** a problem is on a 3D hologram, simulates a whole crew on a Mars mission, and explains every result with its NASA evidence, uncertainty and limitations.

## ▶ Open the app: https://estercpaulino2007.github.io/beyond-horizons/

This is the main link — the full 3D Health HUD, live-connected to the Beyond Horizons API (DATA LINK **ONLINE**) and to Beyond AI.

| Link | What it is |
|------|------------|
| **https://estercpaulino2007.github.io/beyond-horizons/** | **Main link.** The 3D Health HUD on GitHub Pages, published from `frontend/public/hud3d` by `.github/workflows/hud-pages.yml` |
| https://beyond-horizons-ruddy.vercel.app/ | The same HUD inside the Next.js web app (also hosts the earlier pages and the `/bh-api` proxy to the backend) |

> **Disclaimer.** Beyond Horizons is an astronaut health-monitoring and mission-simulation platform (research prototype). Mission readings and crew profiles are synthetic or simulated and are labelled **SIMULATED** / **SYNTHETIC** everywhere in the interface. NASA standards, measurements and datasets set the limits, rates and evidence behind them. It does not provide medical advice, should not be used for real mission planning or health decisions, and does not replace a flight surgeon.
>
> **Synthetic data notice.** The crew profiles, conditions and events of the Ares-180 mission are synthetic and were created for mission simulation and research. They do not represent real astronauts.

---

## How the project is organised

| Part | Where | What it does |
|------|-------|--------------|
| **3D Health HUD** | `frontend/public/hud3d/` (static three.js page; published to GitHub Pages — the main link — and also served by the Next.js app at `/hud3d/index.html`, where the home page `/` redirects to it) | The main interface: holographic body scan, live monitoring, scenarios, My Vitals, Genetics, Crew Risk, EVA, Research, Mission, Beyond AI |
| **Web app** | `frontend/` (Next.js + TypeScript + Tailwind) | Hosts the HUD and the earlier pages (`/simulation`, `/vitals`, `/genetics`, `/counterfactual`, `/debate`, `/evidence`, `/research-navigator`); proxies the API through `/bh-api` |
| **API and simulation engine** | `backend/` (FastAPI + Pydantic) | Deterministic Ares-180 simulation, counterfactual EVA comparison, Debate Chamber, evidence graph, Research Navigator, vitals evaluation, Beyond AI assistant |
| **Data** | `data/` | Synthetic Ares-180 seed (crew, events, daily exposures) and processed datasets |
| **Docs** | `docs/` | Architecture, data sources, methodology, limitations, reproducibility, transparency |

---

## What you can do in the app

### 1. Real-time health monitoring (Overview)
- **Vital signs** with live waveforms: heart rate (ECG trace), SpO₂ (pleth), core temperature, blood pressure and respiratory rate. Each reading turns amber (*watch*) or red (*alert*) when it leaves its reference range, with the trend arrow of the last seconds.
- **Habitat environment**: O₂, CO₂ (in mmHg, against the NASA-STD-3001 limit of 3 mmHg), cabin pressure, cabin temperature (18–27 °C limit) and radiation dose rate (mSv/day, against the ISS baseline).
- **Systems status**: life support, thermal control, radiation shielding and communication.
- **Body scan, neural activity, genetic overview, mission clock and AI insights**, all updating together.

### 2. Astronaut mode and Scan mode
- **Astronaut mode** shows the crew member in a normal suit.
- **Scan mode** turns the suit into a translucent hologram; a scan line sweeps from feet to head and reveals the skeleton, arteries and veins, lungs, heart (beating at the current heart rate), abdominal organs and brain.
- Body systems on *watch* or *alert* glow amber or red, pulse, and are labelled on the model (LUNGS, HEART, BRAIN…), while healthy organs dim so the problem stands out.
- Drag to rotate, scroll to zoom, right-drag to move, double-click (or **RESET VIEW**) to reset.

### 3. Health scenarios — built-in and your own
Built-in scenarios (keys `1`–`7`), each tied to NASA references:

| # | Scenario | What changes |
|---|----------|--------------|
| 1 | Nominal | Baseline LEO operations |
| 2 | Hypoxia — cabin O₂ drop | SpO₂ falls, lungs alert, life support fault |
| 3 | Cardiac arrhythmia | Irregular, fast ECG; heart alert |
| 4 | Solar particle event | Dose rate = the GENETICS situation + the solar-event dose you set there; bone marrow / digestive (GI) watch; genetics watch |
| 5 | Heat stress | Core temperature and heart rate rise; thermal control fault |
| 6 | Bone density loss | −1.2 %/month trend (NASA: 1–1.5 %/month) |
| 7 | SANS — headward fluid shift | Neuro-ocular changes flagged |

**Create your own scenarios** (SCENARIOS tab → **+ CREATE SCENARIO**): set name, description, every vital sign, irregular rhythm, habitat O₂ / CO₂ / temperature / radiation, and each body and habitat system (or leave it on *Auto* to derive it from the readings). Optional custom AI insight and recommended actions. Your scenarios are saved, can be edited or deleted, and run a full body scan on the hologram. While you type, a preview says what the scan will show (if every value is inside its normal range the result is NOMINAL, so change a value to see an alert). Give it an optional **mission day** and it appears on the MISSION timeline and is applied when the mission reaches that day.

### 4. My Vitals — your own readings and history
- Enter heart rate, rhythm, SpO₂, temperature, respiratory rate, sleep, sleep quality, stress, activity, hydration and body mass.
- The Beyond Horizons API evaluates every metric against general adult resting ranges and returns status, insights and suggested actions (if the API is unreachable, the same rules run in the browser).
- **Show on the hologram**: your reading becomes the *My vitals* scenario and the 3D body scan shows your own flagged systems.
- **History**: every saved reading is listed with date and status, can be re-displayed on the hologram or deleted, and is charted as a personal trend (heart rate, SpO₂, temperature, respiratory rate, sleep).
- **Body scan log**: every completed scan is recorded automatically with scenario, status and vitals.
- **Export / Import** the whole history as JSON to move it between devices or between this site and the full platform.

### 5. Crew Risk — Ares-180 simulation (customizable)
Runs the platform's simulation engine for the four crew members of the 180-day Ares-180 Mars-transit mission, day by day.
- **You in the crew**: by default you take one crew seat (Mission Specialist; choose another in EDIT CREW) under the astronaut name you set in the header, so you see your own daily risk, peak, drivers and vulnerability windows, also on day 145 in the EVA tab. Uncheck *Put me in the crew* to use the original crew.
- **Edit the crew**: rename each member and set their six traits — radiation sensitivity, bone-loss susceptibility, sleep resilience, muscle recovery, cognitive resilience, inflammatory baseline (sent to the engine as `crew_overrides`). Your crew is saved and is also used by the Genetics simulator.
- **Mission**: destination, duration, communication delay.
- **Events**: switch on/off the scripted events — solar particle event (day 143), exercise-module failure (days 143–154), 22-minute communication delay, critical EVA (day 145).
- **Countermeasures**: enhanced exercise, radiation shielding, sleep & cognitive-load protocol.
- **Results**: daily operational risk per crew member, vulnerability windows, days per risk band, each person's peak risk and top drivers. Custom crew/events/mission need the live data link; offline, the stored default run is shown and the screen says so.

### 6. EVA Decision and Debate Chamber
An **EVA** (extravehicular activity) is a spacewalk — the most demanding task of a mission. In Ares-180 a critical EVA is planned for **day 145**, two days after a **solar storm (day 143)** and while the **exercise module is broken (days 143–154)**, so the assigned astronaut is tired, sleep-deprived and carries extra radiation. Three options are simulated:
- **A · Maintain** — Atlas does the EVA on day 145 as planned.
- **B · Delay** — same astronaut, 10 days later (day 155).
- **C · Reassign + recovery** — Nova does it on day 145, with a sleep-recovery protocol.

For each option the tab shows the chance the EVA is completed and the peak operational, cognitive and musculoskeletal risk. The **Debate Chamber** then shows four roles, each with one fixed formula: the mission commander (get it done safely), the flight surgeon (crew health only), the science officer (usable result, low uncertainty) and a skeptic who never votes but points out what the winner does worse.

**Linked to the rest of the app:** the EVA tab opens with a *Mission link* box — the current day from the MISSION tab (how many days until the spacewalk), each crew member's operational risk on day 145 from your last Crew Risk run (with your custom names), and the astronaut's current Overview scan turned into an EVA readiness flag (GO / CAUTION / NO-GO). Crew names in the options and the debate follow your edited crew.

### 7. Research — evidence graph and Research Navigator
An interactive causal graph (radiation, microgravity, sleep debt, cognitive load, bone, muscle, operational error…) where every link is coloured by evidence level — supported evidence, data-supported association, exploratory hypothesis, synthetic parameter. Click a node or link to see its source and limitations. The Research Navigator ranks the next experiments by `mission_impact × uncertainty × information_gain / cost`.

### 8. Genetics — radiation → gene alteration simulator
- **Choose who and what**: the astronaut (you, or one of the Ares-180 crew with their radiation sensitivity), the situation (ISS, a one-year ISS mission as in the NASA Twins Study, Mars transit or round trip), days in space, dose from previous missions, a **solar particle event** with its dose, and a **vitamin A (retinoid) diet** countermeasure.
- **Career dose vs. NASA's limit**: previous + this mission compared with NASA-STD-3001's 600 mSv career limit (same for all ages and sexes, 3% mean risk of cancer death) and the 250 mSv per-solar-event limit.
- **HOW IT'S CALCULATED** explains every step and marks which parts are measured, calculated, published data or display rules.
- The result also appears on the Overview (Genetic overview panel and AI insights) and drives the MISSION tab.
- **Radiation dose** from NASA measurements (ISS 0.2–0.5 mSv/day; Curiosity RAD 1.8 mSv/day in deep-space cruise), its dose band, the added fatal-cancer risk (≈5% per Sv, NASA/SwRI) and the crew members most affected.
- **Which genes change and by how much**: the published gene-expression table of NASA grant NAG9-1024 (Burns et al. 2002) — control vs. 9 Gy vs. 18 Gy, and how vitamin A partly reverses the change — with each gene's role.
- **Consequences — what NASA found**: cancer risk, DNA damage and genome instability (Twins Study, OSDR OSD-720), telomeres, gene-expression drift over time, inflammation and immune genes, and countermeasures. The ones that apply light up.
- **Genomic markers** (telomeres, DNA damage response, expression drift, immune, oxidative stress, mitochondria) follow both the health scenario and the simulator; markers in watch/alert light up on the 3D DNA, and clicking one explains it.

### 9. Mission control and habitat
Pick the mission profile (shared with the genetics simulator) and move through it day by day or press play: the ship moves on the 3D Earth–Mars (or ISS orbit) view, and the panel shows the phase, dose so far, career total against NASA's limit and the timeline of events (including the Ares-180 solar storm and critical EVA). Plus an explorable **ISS interior** (photogrammetry): drag to look around, scroll to move through the module, double-click for the automatic tour.

**Everything follows the selected mission day:** with *Astronaut status follows the mission* on, the Overview scan changes with the mission events (solar storm → solar particle event scenario; exercise-module failure → bone-loss scenario) and with your own scenarios that have a mission day. Click any timeline item to jump to it; the EVA item opens the EVA decision. The Crew Risk chart shows the current mission day and the EVA day as markers.

### 10. Beyond AI
An embedded assistant (**ASK BEYOND AI**, or **Ask AI** in the AI Insights panel) that answers questions about the crew, the current scan, your saved vitals and the evidence behind each risk, grounded in the platform's own data. It answers the question first, in the language you write in, explains what your numbers show and what you can do, responds with care when you are worried (calming steps and the warning signs that need real help), and ends with one short line on the limits (simulated mission data, self-reported vitals, not a doctor). It never invents numbers or citations. The conversation is saved in the browser.

### 11. Customization
- Click **MISSION** or **ASTRONAUT** in the header to set the astronaut's name, mission ID, mission phase, crew size and mission elapsed time.
- **A− / A+** (bottom of the screen) makes the whole interface bigger; the **?** button opens a guide to every tab.
- Custom scenarios, vitals history, scan log and chat are all saved locally in the browser.

### 12. Everything is linked
- **Habitat radiation follows GENETICS / MISSION**: the RADIATION tile on the Overview uses the situation you choose (ISS 0.2–0.5 mSv/day, deep space 1.8 mSv/day). In the *Solar particle event* scenario it adds the solar-event dose you set in GENETICS. Click the tile to open GENETICS.
- **Specific AI summary** for your own readings: each flagged value with its number, normal range, what it can mean, which organ is highlighted on the scan and what to do; a warning when several values are out of range together, and a hint when a value looks like a typing mistake.
- **GENETICS shows on the body**: once you use the GENETICS simulator (with *Show effects on the body scan* on and the astronaut set to you), the situation lights up the body scan — radiation ≥ 100 mSv or a solar event → bone marrow (skeletal) and digestive (GI) watch; 90+ days in weightlessness → bone and muscle watch (NASA HRP: 1–1.5 % bone loss per month); 180+ days → neurological watch (SANS). The AI insights say why.
- **Your name everywhere**: the astronaut name you set in the header is used in GENETICS, the AI and the reports.
- **Research sources**: every link of the evidence graph shows its NASA source as a clickable tag (HRP Behavioral Health, Radiation Carcinogenesis, Bone, Muscle, EVA; OSDR OSD-720; NAG9-1024; LSDA osteoblast data).
- **DIGESTIVE (GI)** label: GI = gastrointestinal tract (stomach and intestines). It is highlighted for radiation (one of the most radiation-sensitive tissues) and for low hydration.

---

## NASA data and references

Every limit, rate and dataset has a clickable green source tag, and the **NASA SOURCES** button lists them all with links and where each one is used:

| Area | Reference |
|------|-----------|
| CO₂ limit (≤ 3 mmHg) | NASA-STD-3001 Vol. 2 Rev D [V2 6004], OCHMO-TB-004 |
| Cabin temperature / humidity | NASA-STD-3001 Vol. 2 Rev D [V2 6012], OCHMO-TB-002 (ECLSS) |
| O₂ and total pressure | NASA-STD-3001 Vol. 2 Rev D [V2 6003, V2 6006], OCHMO-TB-003 |
| ISS radiation dose (0.2–0.5 mSv/day) | NASA NTRS 20250006168 |
| Deep-space dose (1.8 mSv/day in cruise) | Zeitlin et al. 2013, Science — Curiosity MSL RAD |
| Bone loss (1–1.5 %/month) | NASA HRP Bone risk / Evidence Report; Lang et al. 2004 (ISS QCT) |
| Muscle loss | NASA HRP Muscle risk |
| SANS | NASA HRP Evidence Report: Spaceflight Associated Neuro-ocular Syndrome |
| Cardiac rhythm | NASA HRP Evidence Report (with the National Academies 2018 caveat) |
| Cognition, sleep, workload | NASA HRP Behavioral Health risk — Evidence book NTRS 20250001454 |
| Spacewalk (EVA) risk | NASA HRP Risk of Injury and Compromised Performance due to EVA Operations |
| Radiation cancer risk | NASA HRP Radiation Carcinogenesis risk; NASA-STD-3001 Vol. 1 career limit 600 mSv (OCHMO-TB-020) |
| Genomics | NASA Twins Study (Garrett-Bakelman et al. 2019, Science); NASA OSDR OSD-720 / GLDS-699; NAG9-1024; NASA LSDA osteoblast data; GeneLab (Ray et al. 2019) |
| Vital-sign ranges | AHA / CDC general adult references (labelled as non-NASA) |

Full provenance notes for every source: [`docs/data-sources.md`](docs/data-sources.md).

---

## How to use the HUD

| Action | How |
|--------|-----|
| Toggle Astronaut / Scan mode | Buttons above the hologram, or `M` |
| Change scenario | Dropdown above the hologram, SCENARIOS tab, or keys `1`–`9` |
| Rotate / zoom / move the model | Drag / scroll / right-drag; double-click to reset |
| Explore 3D views (ISS, lungs, DNA, transit) | Drag and scroll on the view |
| Open a source | Click any green tag, or **NASA SOURCES** |
| Customize names | Click MISSION or ASTRONAUT in the header |
| Direct links | e.g. https://estercpaulino2007.github.io/beyond-horizons/?mode=scan&s=2&tab=biometrics (`mode` = astronaut/scan, `s` = scenario number starting at 0 (0 Nominal, 1 Hypoxia, 2 Arrhythmia, 3 Solar particle event, 4 Heat stress, 5 Bone loss, 6 SANS), `tab` = overview, biometrics, myvitals, genetics, simulations, crew, eva, research, mission) |

The **DATA LINK** indicator shows the connection to the API: **ONLINE** (live), **WAIT** (the server is waking up — the free Render plan sleeps, the first request can take about a minute) or **SNAPSHOT** — the tabs then use `frontend/public/hud3d/data/snapshot.json`, a stored copy of this API's real outputs for the deterministic Ares-180 seed, so everything still works. Live-only features (custom crew / events / mission parameters, Beyond AI) say so on screen when the link is offline.

---

## The simulation engine (backend)

Given the synthetic 180-day Mars-transit mission **Ares-180** (four crew: Atlas, Nova, Lyra, Orion), the engine:

1. simulates the daily evolution of physiological and operational risk for each crew member, with explained drivers and vulnerability windows;
2. compares counterfactual decisions for the critical day-145 EVA (maintain, delay 10 days, reassign with sleep recovery);
3. builds an evidence graph that separates NASA-supported evidence, data associations, exploratory hypotheses and synthetic parameters;
4. ranks hypothetical follow-up experiments by which scientific gap most limits confidence in the decision (`mission_impact × uncertainty × expected_information_gain / relative_cost`);
5. presents an auditable Debate Chamber: mission commander, flight surgeon, science officer and a skeptic, each applying one fixed, named formula (not an LLM role-play);
6. evaluates self-reported vitals against general adult resting ranges;
7. answers questions through **Beyond AI**, grounded only in the platform's own data (bring-your-own-key: set `ASSISTANT_API_KEY`).

### API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness check |
| `GET /api/v1/missions/ares-180` | Mission config, the four synthetic crew profiles, scripted events |
| `POST /api/v1/simulations/run` | Daily risk trajectories. Optional body: `countermeasures`, `crew_overrides` (`id`, `display_name`, `baseline` with the six traits 0–1), `mission_overrides` (`destination`, `duration_days` 10–1095, `communication_delay_minutes` 0–1200, `gravity_g`), `active_event_ids` (`null` = all, `[]` = none) |
| `GET /api/v1/countermeasures/catalog` | Countermeasure catalog |
| `POST /api/v1/counterfactual/compare` | EVA alternatives A / B / C |
| `GET /api/v1/debate/ares-180` | Debate Chamber |
| `GET /api/v1/evidence/graph` | Evidence graph (Cytoscape.js-compatible JSON) |
| `GET /api/v1/evidence/gene-expression` | Published gene-expression data (NAG9-1024) |
| `GET /api/v1/research-navigator/rankings` | Next experiments |
| `POST /api/v1/vitals/evaluate` | Evaluate a self-reported reading |
| `GET /api/v1/assistant/status` · `POST /api/v1/assistant/ask` | Beyond AI (configured or not; ask a question) |

Interactive documentation (Swagger UI) at `/docs` when the backend is running.

```bash
curl http://localhost:8000/api/v1/missions/ares-180
curl -X POST http://localhost:8000/api/v1/simulations/run -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8000/api/v1/simulations/run -H "Content-Type: application/json" \
  -d '{"crew_overrides":[{"id":"nova","display_name":"Ester","baseline":{"radiation_sensitivity":0.9}}],"active_event_ids":["evt_radiation_storm","evt_eva_critical"]}'
curl -X POST http://localhost:8000/api/v1/counterfactual/compare -H "Content-Type: application/json" -d '{}'
curl http://localhost:8000/api/v1/evidence/graph
```

---

## Deployment

| Service | Setting | Value |
|---------|---------|-------|
| **Vercel** (this repo) | `NEXT_PUBLIC_API_BASE_URL` | Address of the Render backend, no slash at the end |
| **Render** (backend) | `CORS_ORIGINS` | `https://beyond-horizons-ruddy.vercel.app,https://estercpaulino2007.github.io` (comma-separated, no spaces, no trailing slash) — required for the GitHub Pages link |
| **Render** | `ASSISTANT_API_KEY` (and provider settings, see `.env.example`) | Needed only for Beyond AI |

**GitHub Pages (main link):** the workflow `.github/workflows/hud-pages.yml` publishes `frontend/public/hud3d` to https://estercpaulino2007.github.io/beyond-horizons/ on every push that changes the HUD (one-time setup: Settings → Pages → Source: *GitHub Actions*). The page reaches the API through the Vercel app's `/bh-api` proxy (see `frontend/public/hud3d/config.js`), so Render's `CORS_ORIGINS` must include `https://estercpaulino2007.github.io`.

The HUD inside this app calls the API through the `/bh-api` rewrite in `frontend/next.config.ts`, so it needs no extra CORS. Pushing to `main` redeploys Vercel automatically. Test the link at `https://beyond-horizons-ruddy.vercel.app/bh-api/health`.

---

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

## Run it locally

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

The HUD alone can also be served without the backend: `cd frontend/public/hud3d && python -m http.server 8080` (it then runs on the offline snapshot).

---

## Documentation

- [Architecture](docs/architecture.md)
- [Data sources and provenance](docs/data-sources.md)
- [Methodology and evidence levels](docs/methodology.md)
- [Limitations](docs/limitations.md)
- [Reproducibility](docs/reproducibility.md)
- [Hackathon transparency](docs/hackathon-transparency.md)

## Limitations
- Mission readings and crew profiles are simulated/synthetic; vital-sign ranges are general adult resting references, not spaceflight-specific thresholds.
- The evidence graph has 14 factors and 13 links (7 supported evidence, 2 data-supported associations, 4 exploratory hypotheses); the hypotheses are what the Research Navigator proposes to test next.
- History is stored per browser (localStorage); there is no server-side account or database yet.
- Several datasets come from ground-based or animal studies (labelled as such in the SOURCES panel).
- See [`docs/limitations.md`](docs/limitations.md) for the full list.

## Use of AI (Super Intelligence) tools

Use of Super Intelligence (SI) tools:

Claude supported code development, debugging, translating and interface refinement. Project direction, feature selection and final integration remained the creator's responsibility. Beyond AI is the project's user-facing assistant, helping users understand the information presented by the platform. Simulation outputs are generated by the project's deterministic engine, not by the AI assistant.

- Beyond AI, the project's user-facing assistant, uses an Anthropic API integrated through the project's backend. It helps users understand and navigate the information presented by the platform. Simulation outputs are generated by the project's deterministic engine, not by the AI assistant.

The application is deployed using GitHub Pages for the frontend, Vercel for the proxy layer, and Render for the backend services.

No NASA logos or branding were used or generated.

## Credits
Built by the Beyond Horizons team for the NASA Space Apps Challenge 2026.

### Libraries and services
three.js (MIT), FastAPI, Pydantic, Next.js, Tailwind CSS, gltf-transform. Hosting: GitHub Pages, Vercel, Render.

## License
MIT for the project's own code — see [LICENSE](LICENSE). Third-party 3D models keep their own licences (see Credits).
