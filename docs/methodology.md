# Methodology

*Status: Step 0. Formulas are documented here when they are implemented (Steps 3-9).*

## Evidence levels (used on every data record and graph edge)

| Level | Meaning |
|---|---|
| `supported_evidence` | Supported by a documented public source (e.g. an HRP evidence report or peer-reviewed paper) that is registered in `data-sources.md`. |
| `data_supported_association` | Association observed in a processed dataset registered in `data-sources.md`. |
| `exploratory_hypothesis` | Hypothesis used in the simulation; not an established effect. |
| `synthetic_parameter` | Value created for the demonstration scenario. |

An edge may only claim `supported_evidence` or `data_supported_association` if its source appears in
`data-sources.md` with status **Verified**.

## Language rules
Use: exploratory simulation, data association, hypothesis, uncertainty estimate, research priority.
Do not use: diagnosis, recommended treatment, clinical prediction, proof of causation in humans.

## Simulation engine formulas (Step 3)

Implemented in `backend/app/services/simulation_engine.py`. This resolves reconciliation
issues #2 and #3 above: one canonical `operational_risk` formula is used (from the main
implementation guide, section 11), and every state-update rule is a **saturating** update
that is bounded to [0, 1] by construction, not by an after-the-fact clamp.

### operational_risk

```
z = 0.30 * radiation_burden
  + 0.25 * sleep_debt
  + 0.20 * (1 - cognitive_resilience)
  + 0.15 * eva_load
  + 0.10 * (1 - muscle_recovery)

operational_risk = sigmoid_centered_steepened(z)
```

`sigmoid_centered_steepened` is `1 / (1 + exp(-6 * (z - 0.5)))` — centered at 0.5 and
steepened (steepness=6), rather than the raw logistic function, so the score actually
spans the low/moderate/high/critical bands (`app/domain/risk_bands.py`) instead of
compressing into a narrow middle range. This centering/steepening is this engine's own
calibration choice (`synthetic_parameter`), not a NASA-sourced formula.

### State updates (all `synthetic_parameter`, all saturating)

| State | Update pattern | Rate constants |
|---|---|---|
| `radiation_burden` | Monotonic saturating accumulation: `new = old + (1-old) * rate * sensitivity * pressure`. Never decreases (radiation exposure does not reverse — docs/limitations.md). | `RADIATION_ACCUMULATION_RATE=0.12`, `RADIATION_DAILY_DOSE_REFERENCE=0.20` (normalises `DailyExposure.radiation_dose` to a 0-1 "pressure"), sensitivity = `0.5 + 0.5 * baseline.radiation_sensitivity` |
| `sleep_debt` | Two-branch saturating accumulate/recover around a need threshold. | `SLEEP_NEED_HOURS=7.5`, `SLEEP_DEBT_ACCUMULATION_RATE=0.10`, `SLEEP_DEBT_RECOVERY_RATE=0.35` |
| `muscle_recovery` | Saturating gain when exercise occurred; saturating decay when the module is unavailable or EVA load is high. | `MUSCLE_RECOVERY_GAIN_RATE=0.30`, `MUSCLE_RECOVERY_DECAY_RATE=0.12`, `MUSCLE_EXERCISE_DURATION_REFERENCE_MIN=120` |
| `bone_risk` | Saturating accumulation without exercise (rate scaled by `0.5 + 0.5*baseline.bone_loss_susceptibility`); slow saturating recovery with exercise — recovery rate is deliberately much smaller than accumulation, matching the spec's own note that bone recovery is slow. | `BONE_RISK_ACCUMULATION_RATE=0.05`, `BONE_RISK_RECOVERY_RATE=0.02` |
| `cognitive_resilience` | Exponential move toward a target set by baseline, sleep debt, radiation burden and any active event's cognitive pressure (storm, EVA). | `COGNITIVE_RESILIENCE_ADAPTATION_RATE=0.40`, target weights `0.35` (sleep_debt), `0.15` (radiation_burden) |
| `uncertainty` | `BASE_UNCERTAINTY=0.12` plus fixed bumps while a radiation storm (+0.15), equipment failure (+0.05) or EVA (+0.10) is active. | — |

### Calibration note

The first version of these constants (a naive `RADIATION_DAILY_DOSE_REFERENCE=0.01` and
`SLEEP_NEED_HOURS=8.0` with a high accumulation rate) made `radiation_burden` and
`sleep_debt` saturate to ~1.0 by roughly day 40 of the 180-day mission — well before the
day-143 radiation storm, which made the storm's effect on `radiation_burden` invisible
(both before and during the storm the value simply read 1.000). This was caught by
actually running the engine over the full Ares-180 seed and inspecting the trajectory,
not by unit tests alone (the bounded-output tests all still passed). The constants above
were re-tuned so that, on the real seed: the storm day's single-day increase in
`radiation_burden` is about 3.4x an ordinary day's increase (matching the event's 3.5x
dose multiplier); `radiation_burden` and `sleep_debt` still have meaningful room to rise
for the rest of the mission after day 143; and the day-145 EVA produces a visible,
temporary peak in `operational_risk` for the assigned crew member only. See
`backend/tests/test_simulation_engine.py` for the exact assertions.

### Countermeasures (partial, Step 3)

`simulate_mission` accepts an optional list of `CountermeasurePlan`s, applied for the
*entire* simulated period (no activation window yet — that is added when counterfactuals,
Step 5, need to turn a countermeasure on partway through a run). Each plan's `target_risk`
multiplies the relevant rate constants above (e.g. a `radiation` countermeasure multiplies
`RADIATION_ACCUMULATION_RATE` by 0.7). These multipliers are this engine's own scenario
design, not sourced numbers — the qualitative direction ("exercise reduces but does not
eliminate bone loss") comes from the HRP evidence reports; the specific multiplier does not.

## Counterfactual engine (Step 5)

Implemented in `backend/app/services/counterfactual.py`. Compares three alternatives for the
Ares-180 day-145 EVA decision by fully re-running the Step-3 engine (not adjusting numbers
after the fact) over a scenario rebuilt from the Step-2 seed generator for each alternative:

| | Alternative | EVA crew member | EVA day | Countermeasure |
|---|---|---|---|---|
| A | Maintain | Atlas (original) | 145 | none |
| B | Delay 10 days | Atlas (original) | 155 | none |
| C | Reassign + Recovery | Nova (`synthetic_parameter` choice, see code) | 145 | sleep-recovery protocol, mission-wide |

For each alternative, over a shared comparison window (days 143-160, chosen to bracket the
storm through 15 days after the original EVA -- not fixed by the specification):

```
peak_operational_risk        = max(operational_risk) in the window
peak_cognitive_risk          = max(1 - cognitive_resilience) in the window
peak_musculoskeletal_risk    = max(0.5*bone_risk + 0.5*(1-muscle_recovery)) in the window
mean_uncertainty             = mean(uncertainty) in the window
eva_completion_probability   = clamp(1 - 0.5*operational_risk - 0.5*(1-cognitive_resilience)
                                      on the EVA day itself, 0.05, 0.99)
```

`musculoskeletal_risk` and the completion-probability formula are this module's own reporting
heuristics (`synthetic_parameter`), not values the simulation engine computes for its own
`operational_risk` score.

**A genuine finding, not a designed outcome:** on the real numbers, alternative B does not
reduce peak operational risk relative to A (0.596 vs 0.549) -- see reconciliation issue #12
below for why, and why this was kept rather than adjusted.

## Evidence graph (Step 6)

Built with NetworkX in `backend/app/domain/evidence_graph.py`, exposed as Cytoscape.js-compatible
JSON at `GET /api/v1/evidence/graph`. 13 nodes, 12 edges, all validated by `CausalEdge`'s own
registry check (app/core/evidence_registry.py) at construction time -- an edge cannot claim
`supported_evidence` or `data_supported_association` unless it names a source registered in
"Real NASA / peer-reviewed sources" above.

A first pass (checking only sources already on hand) found real backing for 5 of the 12 edges.
A second, targeted search pass -- specifically looking for concrete, accessible NASA sources for
the edges that started out as `exploratory_hypothesis` -- found three more: the NASA Human Health
and Performance reference pages for bone, muscle and EVA risk (`nasa.gov/directorates/esdmd/hhp/`,
not blocked, unlike the legacy `humanresearchroadmap.nasa.gov/Evidence/reports/*.pdf` files). That
raised the real-evidence count to 8 of 12:

| Evidence level | Edges | Backed by |
|---|---|---|
| `supported_evidence` | 6 | HRP Behavioral Health risk page (sleep→cognitive load, cognitive load→performance risk); AINV0000000837 (microgravity→bone remodeling); HRP-BONE-RISK (bone remodeling→bone loss risk); HRP-MUSCLE-RISK (exercise availability→muscle recovery); HRP-EVA-RISK (EVA load→operational error risk, claim kept narrow -- see its own limitations) |
| `data_supported_association` | 2 | OSD-720/GLDS-699 + NAG9-1024 (radiation→DNA damage response, DNA damage→inflammatory signaling) |
| `exploratory_hypothesis` | 4 | radiation→cognitive performance risk; EVA load→muscle recovery; muscle recovery→operational error risk; cognitive performance risk→operational error risk -- each has its own `limitations` explaining exactly what real source, if any, is still missing |

Still smaller than the specification's own example evidence graph, which cited sources this
project could never verify (GLDS-473/GLDS-388, and the original `Evidence/reports/Bone.pdf` /
`CV.pdf` files specifically, which are blocked -- their content was found instead via the
reference pages above, not the blocked PDFs themselves). Every edge this project still cannot
back with a registered source stays honestly labelled `exploratory_hypothesis` — see the module
docstring in `evidence_graph.py` for the full reasoning, including the EVA edge's deliberately
narrow claim (the source itself says injury mechanisms are not yet understood).

## Dataset ingestion pipeline (Step 7)

Implemented in `backend/app/services/ingestion.py`. Detects a differential-expression CSV's
columns by **name pattern**, not a hardcoded literal header, because GeneLab names its
statistics columns after the specific contrast tested (e.g. `Log2fc_(mixed radiation)v(sham-irradiated)`
for OSD-720, but `Log2fc_(Space Flight)v(Ground Control)` for a spaceflight study):

| Column | Pattern (case-insensitive) |
|---|---|
| Gene ID | first column in the file, whatever it is named |
| log2 fold change | contains `log2fc` |
| Raw p-value | contains `p.value`/`p_value`/`pvalue`, and does NOT also match the adjusted-p-value pattern |
| Adjusted p-value | contains `p.adj`/`padj`/`fdr`/`q.value` |

If zero or more than one column matches a pattern, ingestion fails with an error listing the
actual columns found, rather than guessing.

DEG filtering uses `padj < 0.05` and `|log2FC| > 0.5` by default — a standard, widely used
convention in differential-expression analysis (not invented for this project), overridable by
the caller. The resulting summary explicitly notes that DEG status is a `data_supported_association`
(a statistical association observed in the processed data), never a causal or clinical claim, and
that connecting any gene to a physiological risk in the evidence graph is a separate, human-reviewed
step this pipeline does not do automatically.

**Not implemented, on purpose:** the specification's gene-to-pathway categorisation (matching
gene symbols like `'CAT'` against short hardcoded lists for "inflammatory", "bone", etc.) — see
reconciliation issue #4. A real gene-to-pathway mapping resource would be needed to do this
honestly, and this project has not verified one.

## Research Navigator (Step 8)

Implemented in `backend/app/domain/research_navigator.py`. Each `ExperimentProposal` names a
specific `exploratory_hypothesis` edge already present in the evidence graph (Step 6) that it
would help resolve, rather than proposing experiments disconnected from what the graph already
says is uncertain:

| Proposal | Gap it targets | mission_impact | uncertainty | info_gain | relative_cost | priority |
|---|---|---|---|---|---|---|
| Radiation + Sleep + Cognition | No dataset measures radiation dose and sleep debt together on cognition | 0.80 | 0.55 | 0.60 | 1.5 | 0.1760 |
| Isolation + Circadian Rhythm + Performance | Behavioral-health edges cover isolation broadly, not circadian misalignment specifically | 0.60 | 0.70 | 0.50 | 1.2 | 0.1750 |
| Microgravity + Muscle + Bone | Bone and muscle are each backed individually, never jointly, over a long-duration timeline | 0.75 | 0.60 | 0.65 | 2.0 | 0.1462 |

`priority` is reconciliation issue #7's formula
(`mission_impact * uncertainty * expected_information_gain / relative_cost`), implemented as a
Pydantic `computed_field` on `ExperimentProposal` itself (`app/schemas/research.py`) — it cannot be
passed in as a constructor argument, so a proposal's displayed priority can never drift from its
own stated inputs. The four input scores are this project's own qualitative judgment calls, not
measurements; every proposal's `limitations` says so explicitly, alongside a reminder that none of
these are funded or NASA-endorsed studies.

The ranking is close between the top two proposals (0.1760 vs 0.1750) — both are judged nearly
equally worth investigating next. The third proposal ranks lower mainly because of its higher
`relative_cost` (a longitudinal combined bone+muscle study costs more to run than a shorter ground
analog), not because its underlying gap matters less.

## Specification reconciliation log

Issues found in the source specification documents on 2026-09-19 and how the project resolves them.
Checks below were computed, not assumed.

| # | Issue | Resolution |
|---|---|---|
| 1 | Post-flight recovery examples do not match the stated formula `1 - exp(-k*t)`. With the documented rates and t = 30 days: inflammatory (k=0.15) -> 98.9% (doc says 88.6%); bone (k=0.03) -> 59.3% (doc says 28.6%); muscle (k=0.08) -> 90.9% (doc says 70%). | Outputs are always computed from the formula. Example numbers in the spec are never reused. |
| 2 | Three different `operational_risk` formulas (main guide, gene-expression note, full-simulator note). | One formula, in one place, chosen in Step 3 and documented here. |
| 3 | State variables declared in [0, 1] but the update rules (e.g. `sleep_debt += 8 - hours`) grow without bound. | All state updates are bounded/normalised and tested for the [0, 1] range. |
| 4 | Gene annotation by substring match (`'CAT' in gene_id`) over-matches; real GeneLab files use Ensembl IDs. | Exact-symbol matching after ID mapping; file columns read from the real file, not assumed. |
| 5 | Real GeneLab differential-expression files name columns like `Log2fc_(Space Flight)v(Ground Control)` and `P.value_(...)`, not `log2FoldChange`/`padj`. | Ingestion adapts to the actual file downloaded. |
| 6 | Statement "no variable was invented" conflicts with the many coefficients that are scenario parameters. | Every coefficient is registered as `synthetic_parameter` or `exploratory_hypothesis`. |
| 7 | Placeholder outputs (e.g. `expected_risk_reduction: 0.18`) shown as if they were results. | Never displayed. Only computed values are shown. |
| 8 | Dataset IDs GLDS-473/388/306 named in the spec could not be confirmed (2026-09-19). | Resolved by using a different, user-verified real dataset instead: OSD-720/GLDS-699 (see `data-sources.md`). Radiation condition is ground-based simulated radiation, not spaceflight — labelled accordingly, not as "spaceflight vs. ground control". |
| 9 | The spec's assumed differential-expression CSV columns (`log2FoldChange`, `padj`) do not match GeneLab's real file naming. | Confirmed from the real OSD-720 file list; ingestion code (Step 7) reads the actual `_differential_expression_GLbulkRNAseq.csv` and its `_contrasts_` file for comparison names, rather than assuming spaceflight vs. ground control. |
| 10 | "Cog.pdf" (cited for sleep, isolation, workload and radiation effects on cognition) does not exist as a single file. | Resolved: the correct current source is the HRP "Behavioral Health" risk page (formally *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders...*), cross-checked against NASA NTRS 20250001454. See `data-sources.md`. |
| 11 | Naive first-pass calibration of the simulation engine's rate constants made `radiation_burden` and `sleep_debt` saturate to ~1.0 around day 40, hiding the day-143 storm's effect entirely. | Caught by running the engine end-to-end over the real Ares-180 seed (not by unit tests alone) and re-tuning the constants; see "Simulation engine formulas" above and `backend/tests/test_simulation_engine.py`. |
| 12 | The spec's own illustrative example for the counterfactual comparison ("B claramente reduz risco imediato mas atrasa a missão") does not hold on the actual simulated numbers: delaying the EVA by exactly 10 days (spec value) lands it on day 155, one day after the exercise-module failure ends (spec value, day 154) -- exactly when `muscle_recovery` is at its lowest. B's peak operational risk (0.596) is *higher* than A's (0.549), not lower. This is forced by the specification's own day numbers, not a modelling choice. | Not adjusted to match the assumption. Documented in `backend/app/services/counterfactual.py`'s module docstring and tested directly in `tests/test_counterfactual.py`, which asserts the consistency property that actually holds (risk and EVA completion probability always move together) instead of the specification's example outcome. C (reassign + recovery) comes out ahead on peak_operational_risk, peak_cognitive_risk and eva_completion_probability -- but not on peak_musculoskeletal_risk, where B is marginally lower (0.561 vs C's 0.594), because C's reassigned crew member (Nova) trades a cognitive vulnerability for a musculoskeletal one. Fixed 2026-10-05 after the Debate Chamber (Step 9) build re-derived these numbers and caught the overstatement. |
