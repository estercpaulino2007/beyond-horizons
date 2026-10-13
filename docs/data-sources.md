# Data sources and provenance

> **Rule of this project:** nothing is presented as NASA data unless a specific NASA
> source is registered here. Everything else is labelled `SYNTHETIC` or `HYPOTHESIS`.

## Verification legend

| Status | Meaning |
|---|---|
| **Verified** | Primary source opened or pasted in full (study page, grant report, published paper) and checked against the project's use of it. |
| **Verified (listing)** | ID and title confirmed via an official NASA index, but the source's own detail page has not been opened. |
| **Corrected** | The ID or claim in the original specification was wrong; the corrected value is given. |
| **Candidate** | Found, plausible for the project, not yet checked in detail. |
| **Unverified** | Could not be confirmed. Must not be cited or shown in the UI until checked by a person on the official page. |

---

## Real NASA / peer-reviewed sources

### OSD-720 (GLDS-699) — Verified
Full study page provided by the user (osdr.nasa.gov/bio/repo/data/studies/OSD-720), version 2.

- **Title:** Long-lasting sex-specific alteration in left ventricular cardiac transcriptome following gamma and simGCRsim radiation
- **GeneLab ID:** GLDS-699 (the specification's "GLDS-473/388/306" guesses were wrong; this is the real, confirmed ID for OSD-720)
- **DOI:** 10.26030/ghw0-wr95 · **Related study:** OSD-825 · **Source accession:** GSE272168
- **Submitted:** 2024-07-12 · **Initial release:** 2024-07-17 · **Version 2 updated:** 2026-04-22
- **Organism:** *Mus musculus* (C57BL/6J) · **Tissue:** left ventricle · **n = 60 samples**
- **Factors:** Ionizing Radiation (mixed radiation = NSRL simplified galactic cosmic ray simulation, 50 cGy; cesium-137 gamma, 100 cGy; sham-irradiated, 0 cGy), Sex, Time of sample collection after treatment (440, 550 or 660 days)
- **Condition: ground-based simulated space radiation, not spaceflight.** Mice were irradiated at Brookhaven National Laboratory / NASA Space Radiation Laboratory and held for over a year before tissue collection.
- **Assay:** RNA-Seq, Illumina NovaSeq 6000, paired-end 150 bp, NEBNextUltraII library kit; GeneLab standard processing pipeline (STAR/RSEM)
- **Real processed-file names** (for the ingestion pipeline, replacing the spec's assumed `log2FoldChange`/`padj` columns):
  `GLDS-699_rna_seq_differential_expression_GLbulkRNAseq.csv`, `..._rRNArm_GLbulkRNAseq.csv`, `GLDS-699_rna_seq_Normalized_Counts_GLbulkRNAseq.csv`, `..._contrasts_GLbulkRNAseq.csv`, `..._SampleTable_GLbulkRNAseq.csv`.
  Because this study contrasts irradiation groups (not spaceflight vs. ground control), the `contrasts` file will name comparisons such as *mixed radiation vs. sham* or *gamma vs. sham* — the ingestion code must read the contrast names from this file rather than assume a spaceflight/ground-control pair.
- **Publication:** Zakharyan R, Hakobyan S, Brojakowska A, et al. (2025). *Long-lasting sex-specific alteration in left ventricular cardiac transcriptome following gamma and simGCRsim radiation.* Scientific Reports. DOI: 10.1038/s41598-025-89815-2 · PMID: 39966642
- **Funding:** NASA Human Research Program grants 80NSSC19K1079 and 80NSSC21K0549 (PI: David A. Goukassian)
- **How used:** the only real dataset currently planned for the gene-expression pipeline (Step 7/8). Supports the radiation -> DNA-damage / inflammatory-signaling edges as `data_supported_association`, tagged with `condition: ground_based_simulated_radiation` (not `spaceflight`).
- **Limitations:** ground-based simulated radiation, not spaceflight; long post-exposure timepoints (440–660 days) unlike an acute in-mission event; mouse, not human; cardiac tissue only.

### AINV0000000837 — Osteoblast gene expression in microgravity (Hughes-Fulford lab) — Verified
Life Sciences Data Archive "Data Type Inventory" form, provided by the user as `MHFOsteoData.doc`, saved at `docs/source-material/ainv0000000837/`.

- **Investigator:** Millie Hughes-Fulford, NASA-funded osteoblast (MC3T3-E1) spaceflight experiments (ESA BioRack, Shuttle missions STS-76, STS-81, STS-84)
- **What it shows:** microgravity alters osteoblast gene expression within 30 minutes of activation — upregulation of the immediate-early gene *c-fos*, altered *osteocalcin* expression, and loss of the normal PGE2 -> *cox-2* feed-forward induction; no change in total RNA synthesis or fibronectin mRNA/protein.
- **Backing publications (cited in the document):**
  1. Fitzgerald J, Hughes-Fulford M (1996). *Gravitational loading of a simulated launch alters mRNA expression in osteoblasts.* Exp Cell Res 228:168-171.
  2. Tjandrawinata RR, Vincent VL, Hughes-Fulford M (1997). *Vibrational force alters mRNA expression in osteoblasts.* FASEB J 11:493-497.
  3. Hughes-Fulford M, Gilbertson V (1999). *Osteoblast fibronectin mRNA, protein synthesis, and matrix are unchanged after exposure to microgravity.* FASEB J 13:S121-127.
  4. Fitzgerald J, Dietz TJ, Hughes-Fulford M (2000). *Prostaglandin E2-induced up-regulation of c-fos mRNA is primarily mediated by cAMP in MC3T3-E1 osteoblasts.* Endocrinology 141:291-298.
- **Organism/system:** mouse osteoblast cell line (MC3T3-E1), cell culture — not whole-animal or human.
- **How used:** candidate cellular-level evidence for the bone-remodeling node of the causal graph, as `supported_evidence` for "microgravity alters osteoblast gene expression" specifically — not for whole-body bone density loss, which stays sourced to the HRP Bone risk report once that is verified (see below).
- **Limitations:** cell culture, not intact bone; mouse cell line; short exposure (hours), not a multi-month mission; document is an internal LSDA form, not a peer-reviewed paper itself (the four citations above are the peer-reviewed backing).
- **Note:** the identical file (same MD5 checksum) is also catalogued under LSDA investigation ID **AINV0000000839**, saved at `docs/source-material/ainv0000000839/`. Same document, same content, indexed twice in NASA's archive — not a second, independent source.

### NAG9-1024 — Radiation-induced skin cancer + dietary retinoid countermeasure (Burns lab) — Verified
NASA grant progress report and the resulting published paper, both provided by the user, saved at `docs/source-material/nag9-1024/`.

- **Grant:** NAG9-1024, *Cancer Induction by Repeated Doses of High-LET Radiation*, NYU School of Medicine, PI Fredric J. Burns (funded by NASA and NIEHS)
- **Published paper:** Burns FJ, Chen S, Xu G, Wu F, Tang MS (2002). *The Action of a Dietary Retinoid on Gene Expression and Cancer Induction in Electron-irradiated Rat Skin.* J Radiat Res 43(Suppl):S229-S232.
- **What it shows:** rat skin irradiated with electrons or high-LET ⁵⁶Fe ions shows altered expression of stress-response, immune/inflammation and DNA-repair genes; dietary retinyl acetate (vitamin A) reverses part of this signature and has chemopreventive activity, primarily by affecting proliferation-related genes.
- **Organism/system:** rat, whole-animal skin irradiation; ground-based (Brookhaven AGS accelerator for the ⁵⁶Fe beam).
- **How used:** candidate `data_supported_association` evidence that radiation exposure alters DNA-damage-response and inflammatory gene expression, and that a countermeasure can partially reverse it — supports the radiation -> DNA-damage-response edge, and is a real (non-invented) example of a "countermeasure changes the gene-expression signature" pattern, useful for the Research Navigator's framing. Also the source for `GET /api/v1/evidence/gene-expression` (`app/domain/gene_expression_table.py`) -- the paper's own Table 1, transcribed verbatim (8 named genes, their measured expression levels at 9 Gy/18 Gy with and without vitamin A, and a computed fold-change). This is the only place in the project that names specific genes; it is presented as exactly what it is (one study's rat-skin results), never generalized into a dose-response model for arbitrary radiation levels.
- **Limitations:** rat skin carcinogenesis, not human or astronaut-relevant tissue; ground accelerator exposure, not spaceflight; long-term cancer endpoint (months), not an operational-risk timescale.

### NASA HRP risk pages — pasted by the user (not yet independently fetched) — Verified (content), URL not re-confirmed
Three risk pages from the legacy `humanresearchroadmap.nasa.gov/risks/risk.aspx` interface were pasted directly by the user. Their content is used as given; this project has not re-fetched the same page over the network (some NASA pages block automated access — see Step 0 notes), so the exact numeric URL parameter is not repeated here to avoid guessing it.

1. **Behavioral Health risk** (short title "Behavioral Health"; formally *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-Mission Health and Performance and Long-Term Health Effects*). Element: Human Factors and Behavioral Performance (HFBP). Point of contact: Sheena Dev. Last published: 2025-05-13.
   - This **replaces** the earlier "Cog.pdf" placeholder that could not be found. It is the current, correct source for the sleep -> cognitive-load and cognitive-load -> cognitive-performance-risk edges (gap BMed-101 lists the Barger/Czeisler ISS sleep studies), and for radiation -> cognitive-risk framing (gap BMed-102, sex- and dose-dependent CNS radiation effects).
   - Cross-checked against the official evidence book: NASA NTRS 20250001454, *Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-Mission Health and Performance and Long-Term Health Effects* — <https://ntrs.nasa.gov/citations/20250001454> — title and content match.
2. **Radiation Carcinogenesis risk** (short title "Carcinogenesis"). Element: Space Radiation (SR). Point of contact: Janice Zawaski. Last published: 2026-08-17.
   - Real HRP risk page, formally tracking a long-term, population-level cancer risk from cumulative radiation exposure. Used for the `radiation_exposure -> cancer_risk` edge in the evidence graph (Step 6), `supported_evidence` -- but only as a qualitative "this risk category is tracked" claim, since the page gives no per-individual dose-response figure this project could honestly turn into a number. The NAG9-1024 work above sits under this risk's research portfolio.
3. **Host-Microorganism Interactions risk** ("Microhost"). Element: Human Health Countermeasures (HHC). Point of contact: Mark Ott. Last published: 2025-05-13.
   - Real HRP risk, but **out of the MVP's three core risks** (musculoskeletal, radiation, cognitive-operational). Kept here as a verified candidate for a future extension (immune/infectious-disease risk), not used in the current causal graph.

### NASA ground sleep-medication study — Verified, data access restricted
- **Title:** *Operational Ground Testing Protocol to Optimize Astronaut Sleep Medication Efficacy and Individual Effects.* PI: Smith Johnston; co-investigators include Mathias Basner and David Dinges. Johnson Space Center. DOI: 10.83263/2p33-rp27.
- **What it shows:** randomized, blinded, placebo-controlled trials of zolpidem and zaleplon on cognitive performance (PVT, descending subtraction task, sleepiness/fatigue ratings) after an abrupt, alarm-based awakening.
- **Status:** real NASA study, but its data is **restricted-access** (available only via a formal data request through the Life Sciences Data Archive) — it cannot be downloaded and ingested the way the OSD-720 files can.
- **How used:** citation only, to document that NASA has real operational sleep research; not a data source for the pipeline. Do not claim to have "used" this dataset unless a data request is actually filed and granted.

### Ray et al. (2019) — GeneLab platform description — Verified
PDF provided by the user, saved at `docs/source-material/genelab-paper/ray-2019-genelab.pdf`.

- **Citation:** Ray S, Gebre S, Fogle H, Berrios DC, Tran PB, Galazka JM, Costes SV (2019). *GeneLab: Omics database for spaceflight experiments.* Bioinformatics 35(10):1753-1759. DOI: 10.1093/bioinformatics/bty884
- **What it is:** the peer-reviewed paper describing the GeneLab platform itself (GLDS) — not a biological dataset, but the infrastructure OSD-720/GLDS-699 (and any future dataset this project ingests) comes from.
- **Useful confirmed facts:** GeneLab curates metadata in ISA-Tab format; datasets follow MIAME (microarray), ENCODE Consortium Guidelines (RNA-seq) or MIAPE (proteomics); each published dataset gets a GeneLab accession number and a DOI; ~40% of GeneLab's holdings (as of the paper's 2018 count) are radiation-related data, alone or combined with microgravity, ground- or spaceflight-based; a public RESTful API exists at `api.nasa.gov/api.html#genelab`; processed and raw files are both provided per dataset.
- **How used:** background/methodological citation for `docs/data-sources.md` and `scripts/ingest_osdr.py` (Step 7) — explains *why* the ingestion pipeline expects ISA-Tab-adjacent, DOI-bearing, accession-numbered processed files, and why radiation data specifically is well-represented in GeneLab (relevant to this project's OSD-720/NAG9-1024 radiation edges). Not itself a source of any causal-graph edge.
- **Limitations:** describes the platform as of ~2018; some interface/workflow details (search UI, ISAcreator tool) may have changed since.


- **Reference page:** <https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/> (accessible; not blocked, unlike the legacy `Evidence/reports/Bone.pdf`)
  - **Quote (paraphrased):** on average, astronauts lose 1-1.5% of bone density per month during four-to-six-month missions; this can cause susceptibility to fractures and premature osteoporosis. Exercise is described as essential to reducing postflight bone-density deficits.
  - Formal risk name: "Risk of bone fracture due to spaceflight-induced changes to bone."
- **Full evidence report:** Sibonga JD, Evans HJ, Smith SA, et al. (2017, updated 2024). *Evidence Report: Risk of Bone Fracture due to Spaceflight-induced Changes to Bone.* NASA Human Research Program. NTRS 20170004597 (2017) and NTRS 20240005190 (2024 update). <https://ntrs.nasa.gov/citations/20170004597>, <https://ntrs.nasa.gov/citations/20240005190>
  - Confirms the same 1-1.5%/month figure and notes it is unclear whether bone mineral density stabilizes or keeps declining on longer missions; the 2024 update reports an increased hip/spine fracture incidence rate after longer-duration flights.
- **How used:** `bone_remodeling_alteration -> bone_loss_risk` in the evidence graph (Step 6), `supported_evidence`.
- **Limitations:** population-level astronaut data (DXA scans before/after missions), not the specific Ares-180 crew; long-duration (beyond 6 months) trend is explicitly uncertain per the source itself.

### HRP-MUSCLE-RISK — Verified
- **URL:** <https://www.nasa.gov/directorates/esdmd/hhp/muscle-risk/> (accessible)
- **Quote (paraphrased):** microgravity causes muscle size, strength and endurance to decline; ISS data show that crew who adhere to the exercise schedule and have adequate exercise-countermeasure equipment return with only minimal losses. The page cautions that new exploration countermeasure systems (for missions beyond the ISS) may not have the same capability.
- Formal risk name: "Risk of Reduced Physical Performance Capabilities Due to Reduced Muscle Size, Strength, and Endurance (Muscle Risk)."
- **How used:** `exercise_availability -> muscle_recovery` in the evidence graph (Step 6), `supported_evidence`.
- **Limitations:** the "minimal losses" finding is specifically tied to ISS-era exercise hardware; the source itself flags that exploration-mission hardware may differ. No specific quantitative effect size is given (this project's own rate constants in `simulation_engine.py` remain `synthetic_parameter`).

### HRP-EVA-RISK — Verified, with an important caveat
- **URL:** <https://www.nasa.gov/directorates/esdmd/hhp/eva-operations-risk/> (accessible)
- **Quote (paraphrased):** NASA formally tracks a "Risk of Mission Impacting Injury and Compromised Performance and Long-Term Health Effects due to EVA Operations." The page states plainly that training injury data exists, **but injury mechanisms and individual risk factors (sex, anthropometry, fitness, etc.) are not yet understood**, and that planetary (non-microgravity) EVA physiological demands are characterized only for a limited number of Lunar/Mars analogue sites.
- **How used:** `eva_load -> operational_error_risk` in the evidence graph (Step 6), `supported_evidence` for the qualitative claim that EVA carries a real, officially tracked injury/performance risk — but with high uncertainty and a limitation that quotes the source's own admission that mechanisms are not understood. This is not stretched into a quantitative or mechanistic claim.
- **Limitations:** the source explicitly says individual risk factors and injury mechanisms are an open gap; do not cite this page for anything more specific than "EVA carries a recognized risk of injury/performance decrement."

### Real sources found but not yet used
- **Risk of Cardiovascular Adaptations** (nasa.gov/directorates/esdmd/hhp/, same accessible pattern as the three above) exists and was seen in a search result listing, but was not fetched: cardiovascular risk is outside the project's three MVP risk categories (musculoskeletal, radiation, cognitive-operational). Fetch and register it the same way as the three above if the project's scope ever expands to include it.

## Items from the original specification that are still NOT verified

Do not cite or display any of these until a person confirms them on the official page.

- **GLDS-473, GLDS-388, GLDS-306**: still not found under those IDs. The project no longer needs them — OSD-720/GLDS-699 above is the verified real dataset for gene-expression work.
- **OSD-876 ("Zfp697")**: listing confirmed in a prior pass, detail page not opened.
- RadLab reference doses (ISS, Mars transit): not yet checked against `https://radlab.nasa.gov/`. Not required — the mission's radiation values are synthetic scenario parameters regardless.
- Article citations "Mao et al. (2021)" and "Grigoriev et al. (2021)" from the original spec: still not found. (A *different*, unrelated 2016 Mao et al. paper on radiation and mouse brain oxidative damage turned up during searches — do not conflate the two.)
- The table of "typical log2FC per gene" in the gene-expression note: still no source. **Never display as data.**

## Real vs synthetic (current state)

| Kind | Content | Label in UI/API |
|---|---|---|
| Real NASA data — molecular/cellular | OSD-720/GLDS-699 (cardiac, ground radiation); AINV0000000837 (osteoblast, microgravity, cell culture); NAG9-1024 (rat skin, ground radiation) | `NASA DATA`, with `condition` set precisely (see each entry above) |
| Real NASA evidence — narrative/risk | Behavioral Health, Radiation Carcinogenesis, Host-Microorganism, Bone, Muscle, EVA Operations risk pages | `supported_evidence`, cited by risk short title |
| Synthetic | crew profiles, mission events, daily exposures, all model coefficients (built in later steps) | `SYNTHETIC` / `synthetic: true` |
| Hypothesis | causal-graph relations not backed by a registered source | `HYPOTHESIS` |

## Template for each dataset

```markdown
## Dataset: <name>
**Source:** NASA OSDR / GeneLab / HRP / LSDA
**URL:** <study page actually opened, or "pasted by user, URL not re-confirmed">
**Dataset IDs:** OSD-XXX and GLDS-XXX (both, when known)
**Accessed at:** YYYY-MM-DD
**Organism / tissue / assay / condition:** ...
**Files downloaded:** ...
**How used in Beyond Horizons:** <which node/edge/feature; evidence level>
**Limitations:** ...
**Citation:** <as given by the dataset page>
```
