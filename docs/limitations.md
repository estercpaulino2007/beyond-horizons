# Limitations

Beyond Horizons is an **exploratory decision-support and research simulator**. It is not a medical
diagnosis tool and does not replace a flight surgeon.

## Scientific
- **Crew, events and exposures are synthetic.** They do not represent real astronauts.
- **Model coefficients are scenario parameters**, not physiological constants. They are labelled
  `synthetic_parameter` or `exploratory_hypothesis` and were not calibrated against individual humans.
- **Association is not causation.** Relations classified as `data_supported_association` come from processed
  datasets and do not establish causality in humans.
- **Animal-to-human extrapolation.** OSDR holds mostly model-organism data (per the OSDR FAQ). Findings in
  mice, including ground-based irradiation studies such as OSD-720, do not transfer directly to astronauts.
- **Small human cohorts.** Real human spaceflight transcriptomics involves few individuals.
- **Deep-space data is sparse.** No long-duration Mars-transit human data exists; scenario estimates lean on
  low-Earth-orbit and analogue evidence.
- **Not modelled:** any factor not listed in the causal graph (for example genetics, medication, diet in detail,
  psychosocial dynamics beyond the simplified terms).

## Technical
- Deterministic simulation with simplified update rules; uncertainty is a modelled quantity, not a statistical
  confidence interval.
- Research-navigator scores depend on configured weights and are a prioritisation heuristic.
- No authentication, payments, chat or user profiles by design.

## Ethical
- Results must be described as *exploratory simulation*, *data association*, *hypothesis*, *uncertainty estimate*
  and *research priority*. Terms such as diagnosis, recommended treatment, clinical prediction or proof of
  causation in humans are not used.
- No identifiable personal or health data is stored.

*This file is extended as each step adds features. Current step: 0 (foundation).*
