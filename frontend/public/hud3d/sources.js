// NASA and peer-reviewed references used by the HUD. Each entry was opened/checked before being added.
// "kind" groups them in the SOURCES panel; "used" says where the HUD relies on them.
export const SOURCES = {
  std3001_co2: {
    kind: 'NASA standard', short: 'NASA-STD-3001 · CO₂',
    title: 'NASA-STD-3001 Vol. 2 Rev D [V2 6004] — Nominal vehicle/habitat CO₂ levels (OCHMO-TB-004)',
    org: 'NASA Office of the Chief Health & Medical Officer', year: '2023',
    fact: 'Average one-hour CO₂ partial pressure in the habitable volume limited to ≤ 3 mmHg, set to keep headache incidence below ~1.4%. 0.5% CO₂ ≈ 3.8 mmHg.',
    url: 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/',
    used: 'CO₂ tile limit and alert colour; hypoxia / life-support scenario',
  },
  std3001_env: {
    kind: 'NASA standard', short: 'NASA-STD-3001 · ECLSS',
    title: 'NASA-STD-3001 Vol. 2 Rev D [V2 6012] — Crew health environmental limits (OCHMO-TB-002, ECLSS)',
    org: 'NASA OCHMO', year: '2023',
    fact: 'Cabin operating limit from 18 °C / 75% humidity to 27 °C / 25% humidity.',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf',
    used: 'Cabin-temperature tile range; heat-stress scenario',
  },
  std3001_atm: {
    kind: 'NASA standard', short: 'NASA-STD-3001 · O₂/pressure',
    title: 'NASA-STD-3001 Vol. 2 Rev D [V2 6003, V2 6006] — O₂ partial pressure and total pressure for crew exposure (OCHMO-TB-003)',
    org: 'NASA OCHMO', year: '2023',
    fact: 'Defines hypoxic/normoxic/hyperoxic O₂ exposure ranges and total-pressure tolerance; sea-level air is 20.95% O₂ at 14.7 psia.',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf',
    used: 'O₂ and pressure tiles; hypoxia scenario',
  },
  std3001_rad: {
    kind: 'NASA standard', short: 'NASA-STD-3001 · Radiation',
    title: 'NASA-STD-3001 Vol. 1 [V1 4030, V1 4031] — Career and solar-particle-event radiation limits (OCHMO-TB-020, Radiation Protection)',
    org: 'NASA OCHMO', year: '2022',
    fact: 'Career effective dose from spaceflight must stay below 600 mSv — universal for all ages and sexes, set at a 3% mean risk of cancer death. Exposure to a solar particle event is limited to 250 mSv per event.',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
    used: 'Genetics simulator career-limit bar and solar-event limit; MISSION tab dose-so-far',
  },
  iss_dose: {
    kind: 'Measured spaceflight data', short: 'NASA · ISS dose',
    title: 'Simonsen et al. — Radiation exposure on the ISS compared with terrestrial workers (NASA NTRS 20250006168)',
    org: 'NASA', year: '2025',
    fact: 'On the ISS, effective dose accumulates at ~0.2–0.5 mSv/day, about 40–90 mSv over a typical six-month mission.',
    url: 'https://ntrs.nasa.gov/citations/20250006168',
    used: 'Radiation tile baseline (LEO) and its normal band',
  },
  msl_rad: {
    kind: 'Measured spaceflight data', short: 'NASA MSL · RAD',
    title: 'Zeitlin et al. (2013) Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory. Science 340:1080',
    org: 'NASA MSL / SwRI', year: '2013',
    fact: 'Curiosity’s RAD measured an average GCR dose-equivalent rate of 1.8 mSv/day during cruise; ≈ 0.66 Sv for the transit phases of a round trip with current propulsion. A dose of 1 Sv is associated with about a 5% increase in fatal cancer risk. A storm shelter protects against solar particles, but galactic cosmic rays are hard to stop: even a foot of aluminium would not change their dose much.',
    url: 'https://www.swri.org/press-release/swri-led-team-calculates-radiation-exposure-associated-trip-mars',
    used: 'Mars-transit dose figures (MISSION tab), gene simulator dose and cancer-risk estimate, radiation watch band, shelter countermeasure',
  },
  hrp_bone: {
    kind: 'NASA Human Research Program', short: 'NASA HRP · Bone',
    title: 'NASA HRP — Risk of Spaceflight-Induced Bone Changes (Evidence Report, Sibonga et al., NTRS 20170004597)',
    org: 'NASA Human Research Program', year: '2017 / 2024',
    fact: 'On average bones lose 1–1.5% of their density per month during four-to-six-month missions; whether loss stabilises on longer missions is unknown.',
    url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/',
    used: 'Bone-density-loss scenario; skeletal status; evidence graph',
  },
  lang2004: {
    kind: 'Measured spaceflight data', short: 'ISS QCT · Lang 2004',
    title: 'Lang T. et al. (2004) Cortical and trabecular bone mineral loss from the spine and hip in long-duration spaceflight. J Bone Miner Res 19(6):1006–1012',
    org: 'NASA-funded ISS study', year: '2004',
    fact: '14 ISS crewmembers (4–6 months): areal BMD lost 0.9%/month at the spine and 1.4–1.5%/month at the hip.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15125798/',
    used: 'Bone-density-loss scenario (rate shown)',
  },
  hrp_muscle: {
    kind: 'NASA Human Research Program', short: 'NASA HRP · Muscle',
    title: 'NASA HRP — Risk of Impaired Performance Due to Reduced Muscle Mass, Strength & Endurance',
    org: 'NASA Human Research Program', year: '—',
    fact: 'Microgravity reduces muscle size, strength and endurance; ISS crew who adhere to exercise with adequate hardware return with minimal losses.',
    url: 'https://www.nasa.gov/directorates/esdmd/hhp/muscle-risk/',
    used: 'Muscular status; exercise countermeasure (CREW RISK)',
  },
  hrp_sans: {
    kind: 'NASA Human Research Program', short: 'NASA HRP · SANS',
    title: 'NASA HRP — Evidence Report: Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)',
    org: 'NASA Human Research Program', year: '2022',
    fact: 'Altered gravity can cause ocular and brain structural changes; NASA reports that over half of crewmembers experience one or more SANS symptoms. Driven by the headward fluid shift.',
    url: 'https://ntrs.nasa.gov/citations/20180000936',
    used: 'SANS scenario; neurological status',
  },
  hrp_cardiac: {
    kind: 'NASA Human Research Program', short: 'NASA HRP · Cardiac rhythm',
    title: 'Lee & Stenger — Evidence Report: Risk of Cardiac Rhythm Problems During Spaceflight (NTRS 20170005625)',
    org: 'NASA Human Research Program', year: '2017',
    fact: 'NASA tracks arrhythmia risk for long-duration flight. Caveat: the National Academies’ 2018 review found insufficient evidence that spaceflight itself amplifies arrhythmia risk.',
    url: 'https://ntrs.nasa.gov/citations/20170005625',
    used: 'Arrhythmia scenario (and its caveat)',
  },
  twins: {
    kind: 'Omics & datasets', short: 'NASA Twins Study',
    title: 'Garrett-Bakelman et al. (2019) The NASA Twins Study: a multidimensional analysis of a year-long human spaceflight. Science 364:eaau8650',
    org: 'NASA HRP', year: '2019',
    fact: 'Year-long ISS mission vs. identical twin on Earth: telomere elongation in flight, genome instability, gene-expression and immune changes; most returned near baseline within 6 months, but more short telomeres persisted.',
    url: 'https://doi.org/10.1126/science.aau8650',
    used: 'Genetic overview and markers (telomeres, gene expression, DNA damage response)',
  },
  osd720: {
    kind: 'Omics & datasets', short: 'NASA OSDR · OSD-720',
    title: 'OSD-720 / GLDS-699 — Long-lasting sex-specific alteration in left ventricular cardiac transcriptome after gamma and simGCRsim radiation',
    org: 'NASA Open Science Data Repository (GeneLab)', year: '2024',
    fact: 'Mouse left ventricle, n = 60, NSRL simulated galactic cosmic rays (50 cGy) or gamma (100 cGy), sampled 440–660 days later. Ground-based simulated radiation, not spaceflight.',
    url: 'https://doi.org/10.26030/ghw0-wr95',
    used: 'Radiation → cardiac / DNA-damage evidence (GENETICS, RESEARCH)',
  },
  nag9_1024: {
    kind: 'Omics & datasets', short: 'NASA grant NAG9-1024',
    title: 'Burns FJ et al. (2002) The action of a dietary retinoid on gene expression and cancer induction in electron-irradiated rat skin. J Radiat Res 43(Suppl):S229–S232 (NASA grant NAG9-1024)',
    org: 'NASA / NIEHS', year: '2002',
    fact: 'Table of 8 named genes with measured expression at 9 Gy / 18 Gy with and without vitamin A (published data, rat skin, ground accelerator).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Burns+FJ+dietary+retinoid+electron-irradiated+rat+skin',
    used: 'Radiation gene-expression table (GENETICS)',
  },
  lsda_osteo: {
    kind: 'Omics & datasets', short: 'NASA LSDA · Osteoblast',
    title: 'NASA Life Sciences Data Archive AINV0000000837 — Osteoblast gene expression in microgravity (Hughes-Fulford, STS-76/81/84)',
    org: 'NASA LSDA', year: '—',
    fact: 'Microgravity alters osteoblast gene expression within 30 minutes of activation (c-fos up, altered osteocalcin, loss of PGE2 → cox-2 induction). Cell culture, not intact bone.',
    url: 'https://lsda.jsc.nasa.gov/',
    used: 'Bone-remodelling node of the evidence graph',
  },
  genelab: {
    kind: 'Omics & datasets', short: 'NASA GeneLab',
    title: 'Ray S. et al. (2019) GeneLab: Omics database for spaceflight experiments. Bioinformatics 35(10):1753–1759',
    org: 'NASA Ames', year: '2019',
    fact: 'Describes the GeneLab platform (ISA-Tab metadata, DOI per dataset, public API) that hosts OSD-720.',
    url: 'https://doi.org/10.1093/bioinformatics/bty884',
    used: 'Data pipeline background (ingestion of OSDR datasets)',
  },
  clinical: {
    kind: 'Clinical reference (non-NASA)', short: 'AHA / CDC ranges',
    title: 'General adult resting vital-sign references (American Heart Association, CDC, standard clinical guidance)',
    org: 'AHA / CDC', year: '—',
    fact: 'Used to colour heart rate, SpO₂, temperature and respiratory rate. Not spaceflight-specific: no published in-flight vital-sign reference table was found.',
    url: 'https://www.cdc.gov/',
    used: 'Vital signs colouring (OVERVIEW, BIOMETRICS, MY VITALS)',
  },
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const chip = id => SOURCES[id] ? `<button class="src" data-src="${id}" title="${esc(SOURCES[id].title)}">${esc(SOURCES[id].short)}</button>` : '';
export const chips = ids => (ids || []).map(chip).join('');

export function openSources(focus) {
  const groups = {};
  for (const [id, s] of Object.entries(SOURCES)) (groups[s.kind] ||= []).push([id, s]);
  const order = ['NASA standard', 'Measured spaceflight data', 'NASA Human Research Program', 'Omics & datasets', 'Clinical reference (non-NASA)'];
  $('#srcBody').innerHTML = order.filter(k => groups[k]).map(k => `<h4>${esc(k.toUpperCase())}</h4>` + groups[k].map(([id, s]) => `
    <div class="srcitem" id="src-${id}"><b>${esc(s.title)}</b><span>${esc(s.org)} · ${esc(s.year)}</span>
    <p>${esc(s.fact)}</p><small>Used in: ${esc(s.used)}</small><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, ''))} ↗</a></div>`).join('')).join('');
  $('#srcModal').classList.remove('hidden');
  if (focus) { const el = document.getElementById('src-' + focus); if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'center' }); setTimeout(() => el.classList.remove('focus'), 2500); } }
  else $('#srcBody').scrollTop = 0;
}
export function initSources() {
  document.addEventListener('click', e => { const b = e.target.closest('.src'); if (b) { e.preventDefault(); openSources(b.dataset.src); } });
  $('#srcOpen').onclick = () => openSources();
  $('#srcX').onclick = () => $('#srcModal').classList.add('hidden');
  $('#srcModal').onclick = e => { if (e.target.id === 'srcModal') $('#srcModal').classList.add('hidden'); };
}
